# eBay Integration — Developer Architecture

Architectural reference for the eBay marketplace integration. Read this before
modifying anything under `marketplace-integrations/ebay/`.

For tenant-facing docs see
[../../../../../../docs/ebay-integration-guide.md](../../../../../../docs/ebay-integration-guide.md).
For the full eBay API design study (used during initial scoping) see
[../../../../../../docs/research/ebay-integration.md](../../../../../../docs/research/ebay-integration.md).

---

## Module shape

The integration is a single NestJS module
([`ebay.module.ts`](./ebay.module.ts)) bundling 39 providers. Each surface
area of eBay's API has its own service (and usually a controller). The
high-leverage ones, in rough call-graph order:

| Service | Responsibility |
|---|---|
| `EbayAuthService` | OAuth 2.0 authorization-code flow, scope assertion, state CSRF |
| `EbayStoreService` | Connection CRUD, token refresh, eBay client cache, business-policy fetch, vacation mode |
| `EbayClientService` | Low-level eBay API client wrapper, EPS image upload, rate limiting |
| `EbayListingsService` | Create / publish / update / end listings, multi-variation, OOS control |
| `EbayOrderSyncService` | Order ingestion (cron + on-demand), inventory sync (cron), fulfillment push, refunds |
| `EbayWebhookService` | ECDSA signature verify, challenge response, account-deletion handler |
| `EbayNotificationService` | Routes verified notifications to the right downstream sync |
| `EbayTaxonomyService` | Category tree, item-aspect lookup |
| `EbayMediaService` | Product image fetch from MinIO for EPS upload |
| `EbayPolicyService` | Lazy clone-and-modify of fulfillment policies for per-listing shipping overrides |

Other services (`promotions`, `campaigns`, `email-campaigns`, `analytics`,
`finances`, `disputes`, `negotiations`, `inquiries`, `feedback`,
`compliance`, `cross-border`, `bulk`, `messaging`, `returns`,
`cancellations`, `shipping`, `keywords`, `catalog`, `store-categories`,
`inventory-locations`) are CRUD-style wrappers around their respective eBay
endpoints. Their controllers are conventional and don't need special review.

---

## Persona model

Two personas use this integration; they don't share a code path:

- **Tenant** (Persona A): platform admin / operator. Connects eBay via OAuth
  in [`apps/web/src/app/app/marketplace`](../../../../../web/src/app/app/marketplace).
  Every controller in this module is gated by `AuthGuard` + `RolesGuard`.
- **Storefront customer** (Persona B): never reaches this module. Storefront
  lives at [`apps/api/src/app/storefront`](../../storefront) and does not
  import any marketplace symbols. Storefront and eBay communicate
  exclusively through `WarehouseItemBalance` (see [Inventory model](#inventory-model)).

If you find yourself adding an eBay import to a storefront file, or vice
versa, stop and reconsider — the boundary is intentional.

---

## OAuth flow

```
┌─────────┐   1. GET /auth/connect    ┌──────────┐
│ Tenant  │──────────────────────────▶│  API     │
│ Browser │   redirect→ eBay          │          │
└─────────┘◀──────────────────────────└──────────┘
     │
     │ 2. Approve on eBay
     ▼
┌─────────┐   3. GET /auth/callback   ┌──────────┐
│ Tenant  │──────────────────────────▶│  API     │ 4. exchange code → tokens
│ Browser │◀──────────────────────────│          │ 5. assertGrantedScopes
└─────────┘   redirect→ /connections  │          │ 6. fetchAndSaveBusinessPolicies
                                       └──────────┘
```

Key files:

- [`ebay-auth.controller.ts`](./ebay-auth.controller.ts) — `connect` + `callback` endpoints.
- [`ebay-auth.service.ts`](./ebay-auth.service.ts) — state generation,
  callback handling, scope assertion (E-9 fix).
- [`ebay-store.service.ts`](./ebay-store.service.ts) — token persistence,
  refresh, revocation (E-2 fix).

### Scope assertion (E-9)

`EbayAuthService.assertGrantedScopes` checks that eBay returned the minimum
required scopes (`sell.inventory`, `sell.fulfillment`, `sell.account`) before
storing tokens. If the user de-selects a scope on the consent screen, eBay
silently omits it from the token response and downstream API calls fail
opaquely. We fail fast at OAuth time with a clear message.

### Sandbox URL handling (E-8)

`EbayWebhookService.getPublicKey` and the auth/API services honor
`EBAY_SANDBOX=true` for *every* eBay endpoint (auth, API, public-key fetch,
revocation). The webhook public-key URL was previously hardcoded to prod and
papered over by mock mode.

### Token refresh (Phase 3 W3.4)

`EbayStoreService.getClient` serializes refresh via a Redis distributed lock
keyed `ebay:tokenRefresh:{connectionId}`. Without it, two pods could both
refresh the same connection's access token and race on the DB write,
producing intermittent 401s when one pod's cached token gets overwritten
by the other's stale write.

### Token revocation (E-2)

`disconnectConnection` POSTs to `/identity/v1/oauth2/revoke` with the
encrypted refresh token *before* nulling the local DB columns. Best-effort:
local credentials are always cleared even if the remote revoke fails. The
alternative — leaving a stale refresh token in the DB after a tenant-initiated
disconnect — is worse than failing to invalidate it remotely.

---

## Listing publish

[`ebay-listings.service.ts:publishListing`](./ebay-listings.service.ts) is the
hot path. The shape is intentional and worth preserving:

1. **Optimistic status lock** — `updateMany({ where: { status: in [DRAFT, APPROVED] }, data: { status: PUBLISHING } })`.
   If `count === 0`, another request already moved the listing; throw 409.
2. **Connection readiness check** — fulfillment / payment / return policy IDs and
   `locationKey` all present.
3. **EPS image upload** — `uploadImagesToEps` downloads each photo from MinIO
   and uploads the binary to eBay Picture Services. eBay requires
   EPS-hosted URLs for full listing features (zoom, 24-image cap, …).
4. **Inventory item create** — `createOrReplaceInventoryItem` (PUT — idempotent).
5. **Offer create** — `createOffer` returns an offer ID.
6. **Offer publish** — `publishOffer` returns the public listing ID.
7. **DB commit** — write external IDs, payloads, status `PUBLISHED`.

If any step after #4 fails, the catch block runs the rollback in reverse:
withdraw the offer, then delete the inventory item. Rollback is best-effort
(failures are logged), but the platform never persists an `ERROR` status
without first attempting to clean up the eBay side.

The only field we do *not* roll back is `inventoryItemPayload` itself — once
that record exists in eBay's inventory it's idempotent on retry, and deleting
it would race against a parallel republish.

---

## Inventory model

This is the central design point and worth understanding before changing
anything that touches stock.

```
                    ┌─────────────────────────┐
                    │  WarehouseItemBalance   │
                    │  (actualQty, reservedQty)│
                    └──────────┬──────────────┘
                               │ both read here
              ┌────────────────┴────────────────┐
              ▼                                 ▼
    ┌─────────────────┐              ┌─────────────────────┐
    │ Storefront      │              │ MarketplaceListing  │
    │ checkout        │              │ + 30-min sync cron  │
    │ (immediate      │              │ (push to eBay       │
    │  reserve)       │              │  offer)             │
    └─────────────────┘              └─────────────────────┘
              │                                 │
              ▼                                 ▼
    ┌─────────────────┐              ┌─────────────────────┐
    │ Storefront      │              │ eBay buyer          │
    │ customer        │              │ (Persona B for      │
    │ (Persona B for  │              │  another tenant)    │
    │  this tenant)   │              │                     │
    └─────────────────┘              └─────────────────────┘
```

**The contract:**

1. `MarketplaceListing.warehouseId` is **per-listing**. The tenant chooses
   it at create time.
2. `MarketplaceConnection.autoSyncInventory` (default true) controls whether
   the 30-min cron pushes quantity to eBay for that connection's listings.
3. eBay's "available quantity" = `WarehouseItemBalance.actualQty -
   reservedQty` for `(tenantId, itemId, warehouseId)`.
4. Storefront checkout reserves stock against the same table atomically
   (see [`storefront/checkout/checkout.service.ts`](../../storefront/checkout/checkout.service.ts)).
   It does not push to eBay synchronously.

**The trade-off** the tenant accepts when they share a warehouse: stock
changes propagate to eBay on the cron tick, so a brief overselling window
exists between a storefront sale and the next sync. Tenants who can't tolerate
this allocate a dedicated warehouse for eBay listings (different
`warehouseId`, different `WarehouseItemBalance` row, no cross-channel
contention).

If we ever want to close the window for shared-warehouse tenants, the
cleanest extension is to dispatch a SKU-level inventory-sync job from the
storefront checkout transaction — gated by a new
`MarketplaceConnection.syncOnStorefrontSale` flag so we don't impose the
extra eBay traffic on tenants who haven't asked for it.

### Distributed locks

Two layers:

- `ebay:order-sync` (TTL 600s) — gates the order-sync cron across pods.
- `ebay:inventory-sync` (TTL 1200s) — gates the inventory-sync cron.
- `ebay:sku:{connectionId}:{sku}` (TTL 30s) — per-SKU during inventory push,
  prevents two cron runs on overlapping schedules from updating the same
  listing simultaneously.

All implemented via [`shared/distributed-lock.service.ts`](../shared/distributed-lock.service.ts)
which wraps `ioredis` `SET NX EX`.

---

## Order sync

[`ebay-order-sync.service.ts:syncOrders`](./ebay-order-sync.service.ts) is
the entry point. Triggers:

- Cron: `setInterval(syncAllActiveConnections, 15 * 60 * 1000)` in
  `onModuleInit`. Disabled when `ENABLE_SCHEDULED_TASKS=false`.
- Webhook: `EbayNotificationService.processNotification('ORDER_CREATED', …)`.
- Manual: `POST /api/v1/marketplace/orders/sync` from the admin UI.

### Incremental sync (H3 + Phase 3 W3.5)

- Filter: `lastmodifieddate:[lastSyncAt-5min..]` for incremental, falls back
  to a 30-day window by `creationdate` on initial sync.
- Pages of 50.
- `pageCheckpoint` tracks the latest `lastModifiedDate` seen in the *current*
  sync run.
- After all pages process (success or partial), `connection.lastSyncAt`
  advances to `pageCheckpoint`.
- The 5-minute backwards overlap absorbs eBay clock skew and lets failed
  orders be retried on the next tick without replaying everything.

### Failed orders

Per-order errors are routed to
[`workers/failed-operations.service.ts`](../../workers/failed-operations.service.ts)
with the full `ebayOrder` payload preserved for retry. The watermark still
advances, so one bad order doesn't block the rest of the window.

### NoSlag Order creation

When an eBay order is `paid` and not yet linked, `createNoSlagOrder` runs in
a Postgres transaction with `SELECT … FOR UPDATE` on the `marketplace_orders`
row to prevent two parallel sync runs from creating duplicate orders.
Atomic order-number generation uses
`UPDATE tenants SET nextOrderNumber = nextOrderNumber + 1 RETURNING …`.

---

## Webhooks

[`ebay-webhook.controller.ts`](./ebay-webhook.controller.ts):

- `GET /webhooks/account-deletion` and `GET /webhooks/notifications` —
  challenge handshakes, return `SHA-256(challengeCode + verificationToken +
  endpoint)` per eBay spec.
- `POST /webhooks/account-deletion` — responds 200 OK *immediately* per
  eBay's spec, then verifies signature and processes async.
- `POST /webhooks/notifications` — verifies signature synchronously, returns
  200, processes async.

### Signature verification

ECDSA over `SHA-256(body + timestamp + endpoint + verificationToken)`.
Public key fetched from `commerce/notification/v1/public_key/{kid}` and
cached in-memory for 1 hour.

**⚠️ Known fragility:** [`ebay-webhook.controller.ts`](./ebay-webhook.controller.ts)
re-stringifies `req.body` if it's already a parsed object:

```ts
const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
```

ECDSA verification is byte-exact. If Express parses the body before our
handler sees it, our `JSON.stringify` may produce a different byte sequence
than eBay sent (key reordering, whitespace, unicode escaping), and
verification will fail. In prod we should mount `express.raw({ type: 'application/json' })`
on the webhook routes so we always have the original bytes. Mock mode
sidesteps this in dev/test, which is why it hasn't blown up yet.

### Account deletion

Cross-tenant scan (`bypassTenantGuard`) for matching connections, then
per-tenant anonymization (`runWithTenant(match.tenantId, …)`) so RLS
satisfies for the update.

**Currently broken:** the lookup matches on
`platformConfig.ebayUserId / userId / username` JSONB paths, but no part of
the OAuth callback writes any of those keys. So the handler logs "No matching
connection" for every notification. Fix: in
[`ebay-auth.service.ts:148`](./ebay-auth.service.ts) (after token save), call
`commerce.identity.getUser` and persist `userId` to `platformConfig`.

---

## Multi-tenancy & RLS

The module relies on three patterns from
[`@platform/db`](../../../../../../libs/db):

- **`ClsService.get('tenantId')`** — populated by `TenantMiddleware` from the
  authenticated user, host header, or (dev only) `x-tenant-id`. All
  request-scoped service methods read tenant from CLS.
- **`runWithTenant(tenantId, fn)`** — pins tenant context for code paths
  outside an HTTP request (cron jobs, webhooks). Inner Prisma calls run with
  RLS satisfied for that tenant.
- **`bypassTenantGuard(fn)`** — reserved for legitimately cross-tenant
  reads / writes. Used by:
  - The order-sync cron (scans every active connection across tenants).
  - The inventory-sync cron (same).
  - The OAuth state lookup (state ID is the only key we have until we know
    which tenant it belongs to).
  - Webhook account-deletion (cross-tenant cleanup of matching connections).

Cron jobs always wrap `bypassTenantGuard` (to fetch the connection list)
around `runWithTenant` (to do per-tenant work). Don't mix the two — every
mutation should run inside `runWithTenant`.

---

## Tests

- `*.spec.ts` (unit): four files under this dir — `ebay-client`,
  `ebay-taxonomy`, `ebay-messaging`, `ebay-media`. Adding more is welcome;
  every service that constructs eBay payloads should have unit coverage of
  the payload shape.
- E2E: [`apps/api-e2e/src/api/14-ebay-full-flow.spec.ts`](../../../../../api-e2e/src/api/14-ebay-full-flow.spec.ts)
  exercises OAuth → list → order in mock mode.
- Mock mode: `MOCK_EXTERNAL_SERVICES=true` short-circuits every outbound
  fetch / SDK call. Keep the mock branches tight — they exist so tests run
  hermetically, not as an alternate code path with its own bugs.

---

## Configuration

Env vars (see `.env.example` and the `EnvValidator`):

| Var | Purpose | Required |
|---|---|---|
| `EBAY_SANDBOX` | Use sandbox endpoints | yes |
| `EBAY_APP_ID` | OAuth client ID | yes |
| `EBAY_CERT_ID` | OAuth client secret | yes |
| `EBAY_DEV_ID` | Trading API dev ID | optional |
| `EBAY_RU_NAME` | OAuth redirect URI | yes |
| `EBAY_VERIFICATION_TOKEN` | Webhook signature verification | for webhooks |
| `EBAY_WEBHOOK_ENDPOINT` | Public webhook URL | for webhooks |
| `MOCK_EXTERNAL_SERVICES` | Skip real eBay calls | dev/test |
| `ENABLE_SCHEDULED_TASKS` | Enable cron jobs | yes |
| `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` | Distributed locks | yes |

---

## Open issues

Tracked in [`docs/audit/CRITICAL_PATCHES.md`](../../../../../../docs/audit/CRITICAL_PATCHES.md);
calling out the integration-specific ones here for future readers:

- **H1** — eBay sale doesn't reserve `WarehouseItemBalance.reservedQty` in
  the same transaction as `createNoSlagOrder`. Same overselling window as
  the storefront-side equivalent (which is the documented trade-off of the
  shared-warehouse strategy).
- **H2** — `ebayUserId` not persisted on connect; account-deletion handler
  can't find connections to anonymize. See [Webhooks › Account deletion](#account-deletion).
- **M1** — Order-sync filter excludes `FULFILLED` status. Post-fulfillment
  status changes (refund, dispute resolution) don't sync back.
- **M3** — No notification-ID dedup on inbound webhooks. eBay retries on
  timeout; verify `EbayNotificationService.processNotification` is
  idempotent or add a dedup table.
- **M4** — Webhook signature verifies against re-stringified body. See
  [Webhooks › Signature verification](#signature-verification).
- **M6** — `issueRefund` has no row lock or status guard. Two parallel
  refunds can fire two eBay calls.

---

## Conventions

- **Services accept explicit `tenantId` when called from cron / webhook
  context**, fall back to `ClsService` for HTTP-request context. Look at any
  service method that takes `tenantId?: string` — that signature exists
  precisely to support both.
- **Encrypt anything sensitive at rest** via `EncryptionService`. Refresh
  tokens, access tokens. The DB column type is `Bytes`, not `String`.
- **Audit log privileged actions** via `MarketplaceAuditService` —
  connect, disconnect, listing publish, listing end. Audit failures are
  non-blocking; wrap in try/catch with a no-op fallback.
- **Throttle controllers** with `@Throttle({ short, medium })`. Defaults
  vary by endpoint sensitivity (auth gets stricter limits than read-only
  list endpoints).
- **Don't introduce a new `setInterval` cron** without using
  `DistributedLockService.withLock`. We have multi-instance deployments;
  ungated cron jobs will double-process.
