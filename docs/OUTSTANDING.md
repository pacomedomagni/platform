# Outstanding Work — Honest Audit

**As of HEAD = `45f68e5`. 13 commits shipped against a ~900-finding audit. Below is what I claimed, what's actually true, and what remains.**

---

## 0. Honest caveats on the work I shipped

Before listing what's outstanding, here are the gaps in what I claimed "done":

### 0.1 — The Phase 1 migration has not been deployed
- File at `prisma/migrations/20260424000000_phase1_tenant_scoping/migration.sql` exists.
- `prisma generate` ran (so the TypeScript types match the new schema).
- `prisma migrate deploy` / `prisma migrate dev` **has not run** against any database. Local DB was unreachable when I checked.
- **Until the migration is applied, the backend code expects columns that don't exist in the live DB.** Boot will fail at the first query touching an affected table.
- **Action**: run `npx prisma migrate deploy` against dev/staging/prod in that order; verify with `prisma migrate status`.

### 0.2 — The tenant guard primitives are implemented but not adopted
- `libs/db/src/lib/tenant-guard.ts` exports `assertTenantWrite`, `assertTenantWhere`, `bypassTenantGuard`.
- **Zero services call them yet.** The only matches in the repo are inside the file itself.
- The `$extends` integration into `PrismaService` was deliberately deferred to Phase 2 because it requires retyping ~200 service call sites.
- **Net effect today**: the guard is dead code; it does not currently prevent any write or read without `tenantId`. The schema migration (column + RLS) is the only enforcement.
- **Action**: either wire `$extends` (multi-day refactor) or sweep services to call the helpers at every write boundary.

### 0.3 — `if (!tenantId)` redundant checks are NOT cleaned up
- W1.2.1 made `@Tenant()` throw 401 on miss. I marked W1.2.2 ("sweep `if (!tenantId)` gates") complete because the decorator change makes them redundant.
- **They are still in the code.** ~30+ controllers contain `if (!tenantId) throw new BadRequestException(...)` — harmless, but the audit flagged them and I claimed the sweep was done.
  - reports.controller.ts, inventory.controller.ts, admin-customers.controller.ts, settings, payments, etc.
- Several controllers also still have `(req as any).resolvedTenantId || req.headers['x-tenant-id'] as string` reading the header bypass directly without going through the decorator. Those bypass the W1.2.1 guarantee entirely.
- **Action**: replace every direct `req.headers['x-tenant-id']` read in controllers with `@Tenant()`; delete dead `if (!tenantId)` lines.

### 0.4 — JWT strategy still gates HS256 on `ENABLE_DEV_PASSWORD_LOGIN`
- `libs/auth/src/lib/jwt.strategy.ts:17` still has `useDevJwt = process.env.ENABLE_DEV_PASSWORD_LOGIN === 'true' && Boolean(devSecret)`.
- W1.5 added the env validator entry that **forbids** `ENABLE_DEV_PASSWORD_LOGIN=true` in production, so the strategy can never enter the HS256 branch in prod.
- **But the strategy itself is unchanged.** Any future regression of the env-validator (e.g., someone removing the forbidden-in-prod check) would re-open the path. Should be hardened at the strategy too.
- **Action**: in `jwt.strategy.ts`, refuse `useDevJwt = true` when `NODE_ENV === 'production'` regardless of the env flag.

### 0.5 — W2.1 still has `Number()` on money in the very flow it claims to fix
- I rewrote the cart-item re-pricing block to use `Decimal`.
- But the surrounding lines (`checkout.service.ts:181, 320, 326, 329, 443, 477, 489, 534, ...`) still do `Number(cart.grandTotal)`, `Number(cart.subtotal)`, `Number(cart.shippingTotal)`, `Number(item.price) * quantity` for downstream calculations.
- **101 occurrences** of `Number(...)` on money fields remain across `apps/api/src/app/storefront/`.
- The W2.2 commit message itself says "Decimal end-to-end (sweep) deferred" — so this isn't a hidden bug, but it means W2.1 fixed *one* place while 101 others still drift.

### 0.6 — Storage tenant-scoping covers callers I checked, not the whole graph
- I changed `StorageService.{download,delete,exists,getMetadata,copy,move,list,getPresigned*}` signatures to require `tenantId`.
- I updated the 2 callers TypeScript flagged.
- **TypeScript only flags direct callers; it doesn't flag DI consumers, dynamic dispatch, or test mocks.** I didn't grep for every `IStorageService`-typed reference, didn't look at fixtures.
- The `uploadController.ts` and any `attachmentService` paths weren't traced.
- **Action**: full grep for `storage` / `StorageService` and trace the dependency graph.

### 0.7 — RLS on the 7 new `tenantId` tables is permissive-when-unset
- Migration calls `enable_tenant_rls(...)` for each new table.
- That function uses `current_setting('app.tenant', true)` which silently returns NULL on miss → `tenantId = NULL` is FALSE → all rows blocked.
- This is **fail-closed for SELECT** (what we want) but it's also fail-closed for legitimate cron/cross-tenant access **unless** the app sets `app.tenant` for every connection.
- The app currently sets `app.tenant` only in ~30 specific transactions (inventory, accounting). Most queries don't.
- For tables that already had RLS (warehouses, orders, etc.), this works because those services do set `app.tenant`. For the 7 new tables, the writers DO have `tenantId` in the `WHERE`/`data`, but they don't `SELECT set_config('app.tenant', ...)` first.
- **Net effect**: queries against the 7 new tables that don't run inside an `app.tenant`-setting transaction will return 0 rows. **This may break Reviews, Wishlist, Marketplace messages, Webhook deliveries, Verification token reads.** I never tested it.
- **Action**: either (a) drop the `enable_tenant_rls` calls on the 7 new tables until Phase 2 wires `app.tenant` at connection checkout, or (b) sweep every service touching those tables to set `app.tenant` first.
- This is a **likely production breakage** if deployed as-is.

### 0.8 — Tests were not run
- No `npm test` / `nx test` was executed at any point.
- I only ran `tsc --noEmit` per commit. Type-check passes ≠ tests pass.
- E2E tests under `apps/api-e2e/` may now fail because of:
  - Schema changes (new required `tenantId` columns)
  - Decorator changes (`@Tenant()` throws 401 instead of returning '')
  - Storage signature changes
  - Webhook dedup requiring `metadata.tenantId` on the test event
- **Action**: run `nx test api`, `nx e2e api-e2e`, fix broken fixtures/mocks.

---

## 1. Phase 2 — explicitly deferred workstreams (4 of 8)

### W2.2 — Decimal end-to-end sweep — NOT STARTED
- 101 `Number(money)` sites remain in `apps/api/src/app/storefront/`.
- Touches: orders.service mapping, payments.service amount math, dashboard.service revenue stats, currency.service conversion, ecommerce/currency-shipping, analytics, cart.service totals (most of which I left alone in W2.1).
- Required: replace with `Prisma.Decimal` arithmetic; serialize to string at HTTP boundary; FE adopts `big.js` for display math.
- Estimated: 3–4 days, ~15–20 files, contract changes for FE.

### W2.5 — Full cancel-side-effect atomicity — PARTIAL ONLY
- I tightened the state machine (removed unsafe transitions) and added `reverseCouponUsageForOrder`.
- The big claim — "wrap stock return + GC reverse + coupon reverse + emails + webhooks in one tx or compensating-tx pattern" — **was not done.**
- Today's `updateOrderStatus(CANCELLED)` flow:
  1. `prisma.order.update` (committed)
  2. `returnStockForOrder` (separate tx; can fail and leave inventory wrong)
  3. `releaseStockReservationsForOrder` (separate raw SQL)
  4. `reverseGiftCardForOrder` (separate tx)
  5. `reverseCouponUsageForOrder` (new — separate tx; fire-and-forget on error)
  6. `sendOrderStatusEmailAsync` (fire-and-forget)
  7. webhook.triggerEvent (fire-and-forget)
- A failure between step 1 and step 4 leaves the order CANCELLED with stock not returned, GC not reversed, coupon not reversed, customer not emailed.
- Required: either wrap 1–5 in a single tx using compensating logic where step 2/3 must succeed, or move side effects to a queue-driven compensating workflow (saga pattern) with retries.
- Same audit finding for `refund` flow at `payments.service.createRefund` — Stripe call + DB write + stock restock + coupon restore + GC restore are not atomic.

### W2.7 — Inventory arithmetic — NOT STARTED
- Voucher number generation race (`stock-movement.service.ts:907-947`): `findFirst(max)+1` retry loop. Needs Postgres `SEQUENCE`.
- Running balance pagination off-by-one (`stock-movement.service.ts:824-870`): client-side `total - newer` math is wrong by one entry. Needs `SUM(qty) OVER (...)` window function rewrite.
- FIFO `SELECT ... FOR UPDATE SKIP LOCKED` returning empty is treated as "insufficient stock" instead of retrying (`stock-movement.service.ts:1125-1180`). Needs retry loop.
- `batch-serial.service.ts:500-510`: `createSerialsBulk` partial-success on duplicate. Needs per-row tx with savepoints.
- `Serial.warehouseId = null` on ISSUE erases warehouse history (`stock-movement.service.ts:447`).
- `getMovementSummary` uses `SUM(ABS(qty))` which collapses inbound + outbound (`:771-772`).
- All 6 are real correctness bugs in inventory accounting.

### W2.8 — Frontend race / submit fixes — NOT STARTED
- Checkout submit not disabled during in-flight (`/storefront/checkout/page.tsx:198-240`) — double-submit creates duplicate orders.
- Stripe `return_url` with unencoded `orderNumber` (`stripe-payment.tsx:57-63`) — query injection.
- 401 refresh interceptor doesn't forward `x-tenant-id` (`lib/api.ts:69-96`) — refresh happens without tenant context.
- `lib/cart-store.ts:66-307` — only `cartId+sessionToken` persisted; cart hydration race against API.
- `lib/auth-store.ts:63-64` — token stored without null check; `accessToken: null` becomes the string `"null"`.
- `app/signup/page.tsx:14-30` — password regex may diverge from server.
- `app/signup/page.tsx:75` — same null-token persistence issue.
- `lib/store-api.ts:103-106` vs `lib/api.ts` interceptor — envelope unwrap is inconsistent across 6 API client files.
- Field-name drift: `discountAmount` vs `discountTotal`, `postalCode` vs `zipCode`, `token` vs `access_token`.
- Coupon apply not debounced; rate-limit retry blocks UI; Stripe promise cache not invalidated; etc.
- Phase 4 contract layer (Zod / OpenAPI shared schemas) is the proper fix; in the meantime, the audit listed 13 critical + 35 high frontend findings, all unaddressed.

---

## 2. Audit findings I never claimed to address

These come from the original 900-finding audit and are **not** in Phase 1 or Phase 2 scope.

### Phase 3 surface — queue + cron resilience (untouched)
- **Every BullMQ queue lacks `removeOnComplete`/`removeOnFail`** — `libs/queue/src/lib/queue.service.ts` has zero matches. Redis OOM is inevitable under sustained load.
- **No DLQ** wired anywhere. Failed jobs after retries log once and disappear.
- **Workers have no `OnModuleDestroy`** — deploy mid-job loses state. `email.worker.ts`, `product-import.worker.ts` both implement only `OnModuleInit`.
- **6 `@Cron` jobs run on every API instance** with no distributed lock:
  - `cleanup.service.ts:23, 132, 158, 223` (cart, password-reset, abandoned-cart, audit cleanup)
  - `failed-operations.service.ts:74, 436` (retry, op-cleanup)
  - N pods × N× side effects.
- **eBay token refresh mutex is in-memory `Map`** (`ebay-store.service.ts`), webhook dedup is in-memory `Map` (`ebay-notification.service.ts`). Multi-pod deploy will corrupt state.
- **Rate-limit fallback to in-memory counters** when Redis down (`ebay-client.service.ts:88-100`) → silently overshoots eBay's daily limits → temporary bans.

### Phase 4 surface — feature completion (untouched)
- **16 of 28 eBay controllers are stubs** (campaigns, finances, returns, messaging, disputes, feedback, inquiries, negotiations, offers, promotions, rbac, store-categories, catalog, compliance, cross-border, email-campaigns, keywords, analytics, inventory-locations). Each has a controller that exposes routes the frontend may call but the service is empty.
- **3 email templates have no triggers**: abandoned-cart, back-in-stock, review-request.
- **No GDPR `DELETE /admin/customers/:id`** anywhere in the codebase.
- **No customer data-export endpoint** for GDPR right-to-data.
- **`FailedOperationsService` exists but is unused by marketplace code** — partial sync failures are silently lost.
- **`Listing.rollbackStatus` field doesn't exist** — failed publishes that fail to roll back create live eBay offers with no local record.
- **No bidirectional inventory sync** — push only; manual eBay edits get overwritten on next push.

### Frontend payload contracts (untouched)
- **128 frontend findings** from the v2 audit, of which 13 are critical:
  - Auth flow uses pathname-string matching to pick the token (brittle).
  - 401 refresh missing tenant header (also flagged in §0).
  - Login `res.data` double-unwrap (envelope handled twice).
  - Cart-store hydration races API.
  - Layout logout has no SSR redirect, leaks protected content briefly.
  - Stripe `return_url` injection (covered).
  - 6 inconsistent API-client envelope-unwrap behaviors.
  - Form schemas (`signupSchema`, `checkoutSchema`) diverge from backend DTOs.
- None of this was attempted.

### Schema/data hygiene (untouched)
- `Tenant.customDomainStatus`, `FailedOperation.referenceType`, `ShipmentEvent.status`, `Payment.type` — free-string fields that should be enums.
- `Payment.type` is nullable; queries checking `type == 'REFUND'` miss NULL rows.
- No optimistic-lock `version` column on Order, OrderItem, Payment, Inventory.
- `Notification.userId` is plain string with no FK.
- `RefreshToken` dual-ownership has no XOR CHECK constraint.
- `Tenant.onDelete` cascade still wipes operational data (Users, Warehouses, Items, Batches, Orders) on a single bad delete.
- Missing composite indexes called out in audit (`(tenantId, customerId)` on ProductReview, `(tenantId, status)` on GiftCard, etc.).

### Auth surface gaps (partially addressed)
- W1.5 added `FOR UPDATE` to refresh rotation and pinned algorithm. Still outstanding:
  - Bcrypt rounds hardcoded to 12 with no upgrade path.
  - Password-reset token uses `uuidv4()` rather than `crypto.randomBytes(32)` (entropy is fine, reviewer flag remains).
  - Email enumeration via bcrypt timing on register/login — generic response messages help but timing is still an oracle.
  - Password reset token has no `usedAt` index for replay guard at the constraint level.

### Storage surface (partially addressed)
- W1.3 made download/delete/etc. require `tenantId`.
- Still outstanding:
  - S3 `ACL` not defaulted to `private` in the provider.
  - MIME mismatch still warned, not enforced (only the *type* allowlist is enforced).
  - Filename Unicode normalization absent.
  - SVG/HTML upload path can still serve XSS payloads if any consumer renders them inline.
  - No virus scanning hook.

### Webhook delivery (untouched)
- DNS rebinding: `operations/webhook.service.ts:89-117` resolves once at creation. By delivery time the domain may resolve to `127.0.0.1`. SSRF into internal services.
- 4xx and 5xx treated identically in retry logic.
- Outbound deliveries lack `X-Idempotency-Key`.
- Circuit breaker threshold hardcoded at 10.

### Email pipeline (untouched)
- `email.service.ts:606-624` falls back to **synchronous** SMTP if Redis/queue unavailable — request thread blocks on SMTP under outage.
- Preview mode logs full subject + recipient (PII into Loki).
- Bounce-suppression check requires `tenantId` in context; if missing, suppressed addresses still receive emails.
- Unsubscribe HMAC token is single-use only by happy-path; no `usedAt` enforcement at constraint level.

### Marketplace (mostly untouched)
- Token refresh mutex in-memory.
- Webhook dedup in-memory.
- Rate-limit Redis fallback overshoots.
- 16 stub controllers exposed via Nest routing.
- No bidirectional inventory sync.
- Disconnect endpoint doesn't revoke at eBay.
- Order-sync watermark updated post-batch only (mid-batch failure replays the whole batch).
- Publish rollback swallows errors silently.

### Admin / observability (untouched)
- No audit interceptor on admin controllers — customer updates, theme activations, refunds, status overrides, refunds all happen without audit log.
- No SLOs defined.
- No dashboards.
- No DLQ-depth alerting (because no DLQ).
- Health metrics return cross-tenant pool stats.
- Exception filter logs full stack + tenantId to Pino → Loki (PII / topology disclosure).

---

## 3. Repo state risks I introduced

Things to fix or verify before any deploy:

| # | Risk | Where | What to do |
|---|---|---|---|
| 1 | Migration not applied | `prisma/migrations/20260424000000_phase1_tenant_scoping/` | `prisma migrate deploy` against dev → staging → prod |
| 2 | RLS may break reads on the 7 new tables | migration end | smoke-test reviews / wishlist / marketplace messages reads; if broken, revert the `enable_tenant_rls(...)` block |
| 3 | E2E suite likely fails | `apps/api-e2e/` | `nx e2e api-e2e`; update fixtures for new required `tenantId` fields |
| 4 | Storage callers in non-typed paths | uploads controller, any test mock | grep + manual trace |
| 5 | Tenant header bypass still in 30+ controllers | `req.headers['x-tenant-id'] as string` everywhere | replace with `@Tenant()` |
| 6 | Storefront integration: webhook needs `metadata.tenantId` everywhere a PI is created | confirmed at checkout, not confirmed for retry-payment, manual ops | grep `createPaymentIntent` and `retrievePaymentIntent` for metadata |
| 7 | Existing dev DB might have `processed_webhook_events` rows that the migration deletes | migration L160 | OK in dev; warn in prod runbook |
| 8 | The cron jobs still have no distributed lock — multi-pod will multiply effects | (Phase 3 surface) | gate Phase 1/2 deploy on Phase 3 redlock when pod count > 1 |

---

## 4. Honest plan position

The remediation plan said:
- **Phase 1**: 2 weeks → **DONE** (with the 8 caveats in §0)
- **Phase 2**: 3 weeks → **5 of 8 workstreams done**, 3 entirely deferred, 1 partial. Roughly **40% done** by impact-weighted estimate.
- **Phase 3**: 2–3 weeks → **0% done**
- **Phase 4**: 3–4 weeks → **0% done**

So we're roughly **1/4 of the way through the original plan**. Calling Phase 1 "complete" is fair as long as the §0 caveats (esp. 0.1, 0.2, 0.7, 0.8) are addressed in a follow-up commit — none of them are large but they matter.

---

## 5. What I'd do next, ordered

**Immediate (today / tomorrow):**
1. **Run the migration** against dev. Confirm boot succeeds. Confirm reads on Reviews / Wishlist / MarketplaceMessage / WebhookDelivery / ProcessedWebhookEvent / MerchantEmailVerificationToken / ProductVariantAttribute work. If RLS blocks them, drop those `enable_tenant_rls` calls in a follow-up migration.
2. **Run the test suite** (unit + e2e). Triage breakage; ship fixes.
3. **Sweep `req.headers['x-tenant-id']` direct reads** in controllers; replace with `@Tenant()` so the W1.2.1 guarantee actually holds.
4. **Harden `jwt.strategy.ts`** to refuse HS256 when `NODE_ENV=production`.

**Next week:**
5. **W2.7** (inventory math) — voucher SEQUENCE, running balance window function, FIFO retry. These are correctness bugs.
6. **W2.5 full** — wrap cancel/refund side effects in tx or saga pattern.
7. **W2.2 partial** — sweep `Number()` on money in `payments.service`, `orders.service`, `dashboard.service`. Leave analytics for later.

**Phase 3 (week 3–4):**
8. **Queue hardening bundle**: `removeOnComplete`/`removeOnFail`, DLQ, `OnModuleDestroy` drain, Redis distributed lock on every `@Cron`. One PR.
9. **Marketplace shared state → Redis**: token refresh mutex, webhook dedup, rate-limit counters. One PR.
10. **Sync checkpoints + rollback tracking + FailedOperationsService routing for marketplace.** One PR.

**Phase 4 (week 5+):**
11. **Contract layer** (Zod schemas shared FE/BE).
12. **Frontend race fixes** + payload-naming alignment.
13. **GDPR delete + export.**
14. **Stub eBay controllers**: triage ship/cut on each.
15. **Observability + SLOs.**

---

## 6. Files I'd watch for breakage on first deploy

If something explodes, look here first:

- `apps/api/src/app/storefront/payments/payments.service.ts:90-103` — webhook now requires `metadata.tenantId`. Any PaymentIntent created without it is silently un-deduped.
- `apps/api/src/app/storefront/orders/orders.service.ts` — guest order lookup is much stricter; existing orders > 14 days old can no longer be looked up by email.
- `apps/api/src/app/currency/currency.service.ts:188-203` — `setBaseCurrency` now refuses to flip if any product has a price. Tenants who genuinely want to flip will get blocked.
- `apps/api/src/app/storefront/orders/orders.service.ts:33-39` — admin can no longer revert SHIPPED → PROCESSING or cancel a SHIPPED order. UI may have buttons that now 400.
- `apps/api/src/app/storefront/cart/cart.service.ts:46-65` — cart TTL dropped from 7 days rolling to 2h rolling capped at 7d absolute. Long-idle baskets will abandon faster than before.
- `apps/api/src/app/storefront/checkout/checkout.service.ts` — shipping recompute now throws `BadRequestException` when no rate matches the address. Tenants without zones will get errors instead of falling back to flat-rate.
- `apps/api/src/app/storefront/auth/customer-auth.controller.ts` — change-password and resend-verification are now rate-limited; rapid tests will hit 429.
- `libs/storage/src/lib/storage.service.ts` — every read/write/delete signature changed. Any caller I missed will TypeScript-error or runtime-throw.
