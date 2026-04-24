# Platform Remediation Plan — 4 Phases

Companion to [SYSTEM_AUDIT.md](./SYSTEM_AUDIT.md). Groups the ~900 audit findings into four executable phases with exit criteria, task lists, and dependencies. Phases are ordered so each unblocks the next.

## Phases at a glance

| Phase | Theme | Goal | Target duration | Exit gate |
|---|---|---|---|---|
| 1 | **Stop the bleeding** | Close security-critical and tenant-isolation blockers. | 2 weeks | No default-secret fallbacks in prod path; no cross-tenant data reachable; no unencrypted credentials at rest. |
| 2 | **Make commerce correct** | Eliminate data-loss and data-corruption paths in cart, checkout, payments, orders, inventory. | 3 weeks | Money reconciles end-to-end; every state transition is atomic; webhooks are operation-idempotent. |
| 3 | **Harden ops & background work** | Make queues, crons, workers, and the marketplace safe for multi-pod production. | 2–3 weeks | No in-memory distributed state; no unbounded queues; no silent job loss on deploy/crash. |
| 4 | **Close the gaps** | Finish stubbed features, eliminate FE/BE contract drift, add observability, remove duplication. | 3–4 weeks | Every declared endpoint is real or removed; FE↔BE contracts are typed and contract-tested; SLOs and alerting exist. |

**Total target: ~10–12 weeks of focused work** for a team of 2–3 engineers. Parallelizable within each phase.

---

# Phase 1 — Stop the Bleeding (Week 1–2)

## Goal
Close the issues that cause silent cross-tenant leakage, forgeable auth, or unencrypted credentials. Nothing in Phase 2+ is safe until this is done.

## Exit criteria (all must be true)

- [ ] API refuses to boot if any secret env (`JWT_SECRET`, `CUSTOMER_JWT_SECRET`, `ENCRYPTION_KEY`, `LOCAL_STORAGE_SECRET`, `SENDGRID_WEBHOOK_VERIFICATION_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_SECRET_KEY`, `SMTP_USER`, `SMTP_PASS`) is unset or matches a known default string.
- [ ] `@Tenant()` throws 401 on missing context; no service path contains `if (tenantId)` as a guard.
- [ ] Every tenant-scoped Prisma model has a `tenantId` column covered by RLS.
- [ ] `StorageService.download/downloadStream/getPresignedDownloadUrl` require `tenantId` and reject mismatches.
- [ ] `ALLOW_TENANT_HEADER` forced `false` when `NODE_ENV=production`.
- [ ] Stripe/Square credentials are verifiably encrypted at rest (code path + migration), OR documented as stored by an out-of-DB secrets manager.
- [ ] eBay `marketplace_listings.externalListingId`/`externalOfferId` uniques are tenant-scoped.
- [ ] Payment amount comparison is strict equality.
- [ ] Theme/page user-HTML and CSS pass a real sanitizer (DOMPurify / PostCSS).

## Workstream 1.1 — Secrets & config hardening (1 engineer, 2–3 days)

| # | Task | Files | Notes |
|---|---|---|---|
| 1.1.1 | Create `apps/api/src/app/common/env-validator.ts`; throw on any default/empty secret in prod. Wire into `main.ts` bootstrap. | new file; `apps/api/src/main.ts` | Blocklist: `'dev-only-secret-change-in-production'`, `'default-dev-key-change-in-production'`, `'default-secret'`, `'dev-secret'`, `'change-this-to-a-secure-random-string-in-production'`. |
| 1.1.2 | Remove the `\|\| 'dev-only-secret...'` fallback. | `customer-auth.service.ts:29-38` | |
| 1.1.3 | Remove `\|\| 'default-dev-key-change-in-production'`. | `libs/.../encryption.service.ts:20` | |
| 1.1.4 | Remove `\|\| 'default-secret'`. | `libs/storage/src/lib/providers/local.provider.ts:243,254` | |
| 1.1.5 | Remove `\|\| 'dev-secret'`. | `email-preferences.service.ts:182,209` | |
| 1.1.6 | Force `ALLOW_TENANT_HEADER=false` in prod; log warning if it resolves true. | `tenant.middleware.ts`, `common/guards/*` | |
| 1.1.7 | Move SMTP/Stripe/Square env reads behind a single `SecretsService`; log non-default source (env vs manager). | `libs/` new module | Preps Phase 4 KMS migration. |

## Workstream 1.2 — Tenant isolation (1 engineer, 4–5 days)

| # | Task | Files |
|---|---|---|
| 1.2.1 | `@Tenant()` throws `UnauthorizedException('Missing tenant context')` instead of returning `''`. | `tenant.middleware.ts:29` |
| 1.2.2 | Sweep every service; replace `if (tenantId)` gates with assertions. | `rg "if \\(tenantId\\)" apps/api` |
| 1.2.3 | Add Prisma middleware that rejects every query against a tenant-scoped model without a `where.tenantId`. | `libs/db/src/lib/db.module.ts` |
| 1.2.4 | Migration: add `tenantId` to `ProductVariantAttribute`, `ReviewVote`, `WishlistItem`, `MarketplaceMessage`, `WebhookDelivery`, `ProcessedWebhookEvent`, `MerchantEmailVerificationToken`. Backfill; add composite uniques; add RLS. | new migration |
| 1.2.5 | Migration: scope `ProcessedWebhookEvent` unique to `(tenantId, eventId)`; scope `Cart.sessionToken` to `(tenantId, sessionToken)`; scope `marketplace_listings.externalListingId/externalOfferId` to `(tenantId, ...)`. | new migration |
| 1.2.6 | Add RLS policies for `password_resets`, `email_verification_tokens`, `coupon_usages`, `webhook_deliveries`, `processed_webhook_events`. | new migration; compare `20260205100000_enable_rls_all_tables` |
| 1.2.7 | RLS policies raise `invalid_authorization_specification` on unset `app.tenant` instead of silently returning empty. | policy bodies |

## Workstream 1.3 — Storage & upload safety (1 engineer, 3 days)

| # | Task | Files |
|---|---|---|
| 1.3.1 | `StorageService` methods require `tenantId`. Service asserts that `sanitizedKey` starts with `${tenantId}/`. | `libs/storage/src/lib/storage.service.ts:207-217` |
| 1.3.2 | Default S3 `ACL` to `'private'`; refuse public-read unless explicit. | `providers/s3.provider.ts:52-73` |
| 1.3.3 | MIME sniff: if declared ≠ detected, throw `UnsupportedMediaTypeException`. | `storage.service.ts:163-170` |
| 1.3.4 | Unicode-normalize filenames before sanitization. | `storage.service.ts:99` |
| 1.3.5 | Reject executable/SVG/HTML in image-only upload paths. | upload controllers |

## Workstream 1.4 — Encryption at rest (1 engineer, 3 days)

| # | Task | Files |
|---|---|---|
| 1.4.1 | Pick an encryption backend (KMS / envelope / libsodium + master key from secrets manager). | RFC doc |
| 1.4.2 | Apply to `Tenant.stripeSecretKey`, `Tenant.squareAccessToken` (and refresh), `MarketplaceConnection` tokens, `GiftCard.pin` (hash, not encrypt), any Prisma field with comment `// Encrypted`. | schema + services |
| 1.4.3 | Migration: re-encrypt existing rows with a new key and store key version in ciphertext. | one-off migration |
| 1.4.4 | Add key-rotation runbook. | `docs/` |

## Workstream 1.5 — Auth surface fixes (1 engineer, 2–3 days)

| # | Task | Files |
|---|---|---|
| 1.5.1 | Atomic refresh-token rotation: single Prisma tx — verify, revoke, create — using `FOR UPDATE` on the old token row. | `libs/auth/src/lib/auth.service.ts:86-135` |
| 1.5.2 | Pin JWT algorithm per env (`RS256` in prod, `HS256` only in dev). | `libs/auth/src/lib/jwt.strategy.ts:19-39` |
| 1.5.3 | Rate-limit `/login`, `/forgot-password`, `/resend-verification`, `/reset-password`, `/verify-email`, `/change-password`. | `customer-auth.controller.ts` |
| 1.5.4 | Constant-time token lookup for password-reset: fetch by hash, compare constant-time. | `customer-auth.service.ts` |
| 1.5.5 | `CUSTOMER_JWT_SECRET` mandatory (no fallback to `JWT_SECRET`). | `customer-auth.service.ts:29-38` |

## Workstream 1.6 — Critical money + state guards (1 engineer, 2 days)

| # | Task | Files |
|---|---|---|
| 1.6.1 | Strict amount equality on Stripe webhook. | `payments.service.ts:173` |
| 1.6.2 | Order-lookup IDOR: require single-use email-delivered token or authenticated session. | `orders.controller.ts:74-87`, `checkout.controller.ts:115` |
| 1.6.3 | Disallow base-currency change when any product has a price; or force atomic conversion in a migration tx. | `currency.service.ts:145-171` |

## Workstream 1.7 — User-content sanitization (1 engineer, 2 days)

| # | Task | Files |
|---|---|---|
| 1.7.1 | Replace `sanitizeCss()` with PostCSS-based allowlist. | `themes.service.ts:513-523` |
| 1.7.2 | URL allowlist for `logoUrl`, `faviconUrl`, `previewImageUrl`: protocol `https:`, block `data:`/`javascript:`. | `themes.service.ts:169-171,245-247` |
| 1.7.3 | DOMPurify (server-side) on page HTML content. | `store-pages.service.ts` |
| 1.7.4 | Review template Handlebars triple-stash usage; forbid `{{{user.*}}}` patterns. | `libs/email/src/lib/templates/*` |

## Phase 1 verification

- Staging smoke test: boot with missing/default env → must fail.
- Cross-tenant probe: log in as Tenant A, attempt `GET /api/v1/store/uploads/<tenantB-key>` → must 403.
- RLS probe: with `SET app.tenant = ''`, queries on any tenant-scoped table must return 0 rows and not panic.
- Contract test: payment webhook with amount off by 1 cent → rejected.
- Lint rule or unit test that asserts no `|| 'dev-'` string in service sources.

---

# Phase 2 — Make Commerce Correct (Week 3–5)

## Goal
Kill every data-loss and data-corruption path in the commerce loop. Money must reconcile. State machines must be enforced atomically. Webhooks must be operation-idempotent, not event-idempotent.

## Exit criteria

- [ ] Cart items are re-priced from DB inside the order transaction at checkout entry.
- [ ] Cart and checkout share a single shipping-calculation function and input contract.
- [ ] Stripe refund idempotency key is stable per `(orderId, amountCents)`.
- [ ] Webhook handlers check downstream state (order.paymentStatus etc.) before treating an event as duplicate.
- [ ] Coupon redemption is serialized: validate + increment in one tx with `FOR UPDATE`.
- [ ] Gift card redeem happens **after** Stripe success.
- [ ] FX rate snapshotted on order; payment rejects if diverged beyond tolerance.
- [ ] Order cancel side effects (stock return, GC reverse, webhook) are in the same tx as status change, or explicitly compensated on failure with alerting.
- [ ] Cart TTL cleanup job releases reservations and runs on schedule.
- [ ] Checkout submit disables during in-flight; server also guards against null cart.
- [ ] Guest order lookup requires a token, not a free email.
- [ ] Admin order status transitions enforce business rules (no `DELIVERED→CANCELLED`, etc.).
- [ ] Every money calculation uses `Prisma.Decimal`; no `Number(order.grandTotal)` arithmetic in service layer.
- [ ] Voucher numbers come from a Postgres `SEQUENCE`.
- [ ] Running-balance report uses window functions, not client-side sums with offset math.

## Workstream 2.1 — Cart/checkout re-pricing & shipping unification (1 engineer, 3 days)

| # | Task | Files |
|---|---|---|
| 2.1.1 | Extract `recalculateCartTotals(cart, address, tenant)` into a shared pure function. Takes Decimal; returns Decimal. | new `storefront/commerce/totals.ts` |
| 2.1.2 | On `POST /checkout` entry, inside the order tx: fetch every product's current price, reject or re-price mismatched items before charge. | `checkout.service.ts:197-204` |
| 2.1.3 | Cart + checkout call one `calculateShipping(address, cart)` — unify `cart.service.ts:1084-1096` and `checkout.service.ts:267-315`. Fall-back rate schema matches full zone-rate schema. | `cart.service.ts`, `checkout.service.ts`, `shipping.service.ts` |
| 2.1.4 | Delete `ShippingAdminController` OR the duplicate in `currency-shipping.controller.ts`. Migrate FE to single endpoint. | controllers + FE |

## Workstream 2.2 — Money & FX (1 engineer, 3 days)

| # | Task | Files |
|---|---|---|
| 2.2.1 | Replace every `Number(x)` around `grandTotal/subtotal/tax/discount/shipping` with `Decimal`. Serialize to string at the HTTP boundary. | `orders.service.ts:88`, `checkout.service.ts:290`, `payments.service.ts`, etc. |
| 2.2.2 | Per-line tax calculation, then sum; replace aggregate-then-tax. | `cart.service.ts:1120-1122`, `checkout.service.ts:210-217` |
| 2.2.3 | Snapshot FX rate on `Order` at creation (add column `fxRate Decimal`); payment handler rejects if Stripe amount diverges from snapshot × baseAmount by >0.5 %. | schema + payments |
| 2.2.4 | Platform fee computed on original `grandTotal`, not post-discount `chargeAmount`. | `checkout.service.ts:523-535` |
| 2.2.5 | Currency CRUD: reject zero/negative exchange rate; restrict `setBaseCurrency` if products have prices without conversion. | `currency.service.ts:145-171, 129-138` |

## Workstream 2.3 — Idempotency (1 engineer, 4 days)

| # | Task | Files |
|---|---|---|
| 2.3.1 | Introduce `operationId` column on `StockMovement`, `Payment`, `Refund`, `CouponUsage`, `FailedOperation` payloads. Unique index. | schema |
| 2.3.2 | Refund: key = `'refund_' + orderId + '_' + amountCents`. Retry with same key is a no-op. | `payments.service.ts:948-950` |
| 2.3.3 | Stripe webhook handler: after dedup insert, re-check `order.paymentStatus` and `stockDeducted` flag; only short-circuit if downstream work is already complete. | `payments.service.ts:92-103, 275` |
| 2.3.4 | Stock increment via `upsert` replaced by a write that asserts `NOT EXISTS operationId`. | `stock-movement.service.ts:987, 976-996` |
| 2.3.5 | Every queue job payload includes `operationId`. | `queue.types.ts:34-103` |

## Workstream 2.4 — Coupon & gift card serialization (1 engineer, 2 days)

| # | Task | Files |
|---|---|---|
| 2.4.1 | Coupon validate + increment in one tx with `SELECT ... FOR UPDATE` on the `Coupon` row. Move `timesUsed` increment into the same transaction as order-confirm (webhook handler). | `cart.service.ts:496-498`, `payments.service.ts:478-482` |
| 2.4.2 | Per-customer coupon limit: unique `(tenantId, couponId, customerEmail)` (email, not sessionToken). | schema + `cart.service.ts:517-538` |
| 2.4.3 | `GiftCardService.redeemForOrder` acquires `FOR UPDATE` on gift card row, checks balance, decrements, all in one tx. | `gift-card.service.ts` |
| 2.4.4 | Gift card redeemed **after** Stripe intent success (move call from `checkout.service.ts:414-460` to the webhook handler). Add reversal path when webhook signals failure. | `checkout.service.ts`, `payments.service.ts:648` |
| 2.4.5 | `GiftCard.pin` — hash with bcrypt; compare constant-time. | `gift-card.service.ts` + migration |

## Workstream 2.5 — Order lifecycle atomicity (1 engineer, 3 days)

| # | Task | Files |
|---|---|---|
| 2.5.1 | `updateOrderStatus` takes an options object describing required side effects; each side effect is a Prisma tx step. If any step fails, whole status change rolls back. | `orders.service.ts:310-386` |
| 2.5.2 | Admin transition matrix: remove `DELIVERED → CANCELLED`, remove `SHIPPED → PROCESSING`. Require `REFUNDED` to come from `DELIVERED` only after refund success. | `orders.service.ts:18-26` |
| 2.5.3 | Add `@@version` style counter: `version Int @default(1)` on `Order`; every mutation increments; reject update if `version` diverges. | schema |
| 2.5.4 | Shipment event deduplication: `@@unique(shipmentId, status, occurredAt)`. | schema |

## Workstream 2.6 — Inventory reservations & cart lifecycle (1 engineer, 3 days)

| # | Task | Files |
|---|---|---|
| 2.6.1 | Reduce cart TTL from 7 days → 1–2 hours (configurable). | `cart.service.ts:97, 1138` |
| 2.6.2 | Add absolute `createdAt + 7d` max lifetime, independent of activity. | schema + service |
| 2.6.3 | Cart cleanup job releases reservations inside the same tx that deletes/abandons the cart. | `cleanup.service.ts:62-105` |
| 2.6.4 | Merge reservations: rebuild from final cart state (delete all anonymous + customer reservations, recreate). No deltas. | `cart.service.ts:678-809` |
| 2.6.5 | Warehouse selection considers shipping address; else tenant default; else first-active as last resort. | `cart.service.ts:915-926`, `payments.service.ts:386-396` |

## Workstream 2.7 — Inventory arithmetic correctness (1 engineer, 3–4 days)

| # | Task | Files |
|---|---|---|
| 2.7.1 | Postgres `SEQUENCE` for voucher numbers per `(tenantId, docType)`; replace findFirst+1 loop. | migration + `stock-movement.service.ts:907-947` |
| 2.7.2 | Rewrite `getItemMovements` running balance with SQL window function `SUM(qty) OVER (ORDER BY postingTs)`. | `stock-movement.service.ts:824-870` |
| 2.7.3 | FIFO layer consumption: on `SELECT FOR UPDATE SKIP LOCKED` returning empty but `qtyRemaining > 0` elsewhere, retry instead of raising "insufficient stock". | `stock-movement.service.ts:1125-1180` |
| 2.7.4 | On ISSUE, keep `serial.warehouseId`, add `lastIssuedAt`; don't null it. | `stock-movement.service.ts:447` |
| 2.7.5 | Serial `createSerialsBulk`: wrap in a Prisma tx; if any row conflicts, rollback all. | `batch-serial.service.ts:500-510` |
| 2.7.6 | Decide unique scope on `Serial` (`@@unique([tenantId, itemId, serialNo])` or `@@unique([tenantId, serialNo])`), document in schema comment. | schema |

## Workstream 2.8 — Frontend race/submit fixes (1 engineer, 2 days)

| # | Task | Files |
|---|---|---|
| 2.8.1 | Checkout submit button disabled while `cartId == null` and during in-flight; server also rejects request if cart is empty. | `app/storefront/checkout/page.tsx:199, 198-240` |
| 2.8.2 | Debounce shipping-rate fetch on address change; pass full `grandTotal` not `subtotal`. | `:134-156, 162-169` |
| 2.8.3 | Stripe `return_url`: `encodeURIComponent(orderNumber)`. | `stripe-payment.tsx:57-63` |
| 2.8.4 | Coupon apply debounced & disabled during in-flight. | `app/storefront/cart/page.tsx:47-61` |

## Phase 2 verification

- Scripted concurrency harness: N=100 parallel cart→checkout with same coupon at `usageLimit=1` → exactly 1 succeeds.
- Scripted concurrency harness: N=50 parallel gift-card redemptions with full balance + stripe fail → final balance never negative.
- Chaos test: cut Stripe mid-webhook → order must end in a documented final state with matching stock / GC ledger.
- Checkout replay: repost the same webhook after successful processing → no duplicate coupon increment, no duplicate stock delta.
- Shipping rate returned by cart == shipping rate used by order creation for the same address, asserted in e2e test.

---

# Phase 3 — Harden Ops & Background Work (Week 6–8)

## Goal
Make the system safe in a multi-pod deployment. No in-memory distributed state, no silent queue loss, no cron thundering herd, no unbounded Redis growth.

## Exit criteria

- [ ] Every queue has `removeOnComplete` + `removeOnFail` age caps.
- [ ] DLQ wired with alerting on depth > 0.
- [ ] Every worker implements `OnModuleDestroy` + graceful drain.
- [ ] Every `@Cron` uses a Redis-backed distributed lock (redlock or similar).
- [ ] eBay token refresh and webhook dedup live in Redis, not in-memory.
- [ ] Rate-limit fallback fails closed (or uses a durable counter).
- [ ] Sync watermarks persist per page, not per batch.
- [ ] FailedOperationsService is wired to marketplace sync, email send, and webhook delivery.
- [ ] Tenant context propagates into every job.
- [ ] `SUM(BinBalance) == WarehouseItemBalance` reconciliation job runs daily.

## Workstream 3.1 — Queue hardening (1 engineer, 3 days)

| # | Task | Files |
|---|---|---|
| 3.1.1 | Set `defaultJobOptions: { removeOnComplete: { age: 3600, count: 1000 }, removeOnFail: { age: 7*86400, count: 10000 } }` at queue construction. | `libs/queue/src/lib/queue.service.ts:58-63, 227-282` |
| 3.1.2 | Add `maxStalledCount: 1`, `lockDuration: jobMax + 30s`. | same |
| 3.1.3 | Create a DLQ queue (`${name}-dlq`). On worker `failed` event with `attemptsMade >= attempts`, enqueue the job payload + error into DLQ. | same |
| 3.1.4 | Alert on DLQ depth > 0 (hook into monitoring stack). | monitoring |
| 3.1.5 | Each `*Worker` class: `async onModuleDestroy() { await this.worker.close(30_000); }`. | `email.worker.ts`, `product-import.worker.ts` |

## Workstream 3.2 — Cron distributed locks (1 engineer, 2 days)

| # | Task | Files |
|---|---|---|
| 3.2.1 | `@WithDistributedLock(key, ttl)` decorator backed by Redis `SET NX EX`. | new `libs/queue/distributed-lock.decorator.ts` |
| 3.2.2 | Apply to every `@Cron` in `cleanup.service.ts` and `failed-operations.service.ts`. | `cleanup.service.ts:23,132,158,223`, `failed-operations.service.ts:74` |
| 3.2.3 | Cron TTL = 2 × expected max runtime; include a heartbeat extender for long jobs. | |
| 3.2.4 | Initialize `FailedOperation.maxAttempts` on create (bug fix). | `failed-operations.service.ts:41-54` |
| 3.2.5 | Add jitter `±25%` to exponential backoff. | `:424-429` |
| 3.2.6 | `executeOperation` re-verifies `operation.tenantId` exists and is active before running. | `:115` |

## Workstream 3.3 — Worker tenant context (1 engineer, 1–2 days)

| # | Task | Files |
|---|---|---|
| 3.3.1 | Define `JobBase<T>` type with required `tenantId`, `operationId`, `userId?`. | `queue.types.ts` |
| 3.3.2 | Worker wrapper establishes CLS context from `job.data.tenantId` before calling handler. | `queue.service.ts:124-145` |
| 3.3.3 | Sweep queue producers to always include `tenantId`. | grep `queueService.add`, `queueService.sendEmail`, etc. |

## Workstream 3.4 — Marketplace shared state → Redis (1 engineer, 3 days)

| # | Task | Files |
|---|---|---|
| 3.4.1 | Token-refresh mutex: replace in-memory `refreshLocks` Map with Redis-backed distributed lock keyed on connection ID. | `ebay-store.service.ts:16-17, 280-336` |
| 3.4.2 | eBay webhook dedup: Redis `SET notificationId "1" NX EX 86400`; fall back to DB table (not memory). | `ebay-notification.service.ts:26, 63-75` |
| 3.4.3 | Rate-limit counters: Redis only; if Redis unavailable, fail closed with 503 + `Retry-After`. | `ebay-store.service.ts:404-465`, `ebay-client.service.ts:123-173` |
| 3.4.4 | Distributed-lock TTL ≥ 2× longest expected sync run; heartbeat extends. | `ebay-order-sync.service.ts:48` |

## Workstream 3.5 — Marketplace correctness (1 engineer, 4 days)

| # | Task | Files |
|---|---|---|
| 3.5.1 | Persist sync checkpoints per page: `MarketplaceSyncCheckpoint(connectionId, cursor, lastModifiedDate)`. | new model |
| 3.5.2 | Move watermark update out of batch-end to per-page commit. | `ebay-order-sync.service.ts:181, 298-300` |
| 3.5.3 | `Listing.rollbackStatus` enum field; on publish-rollback failure, mark for retry; cron picks up. | `ebay-listings.service.ts:736-770` |
| 3.5.4 | Inventory sync: pull from eBay first, compare, push delta with explicit conflict policy. | `ebay-listings.service.ts:776-827` |
| 3.5.5 | Route every marketplace write through `FailedOperationsService` on error. | `failed-operations.service.ts` |
| 3.5.6 | Connection `disconnect`: call eBay revoke endpoint before clearing local token. | `connections.controller.ts:94-102` |
| 3.5.7 | Listing SKU uniqueness includes tenantId; prevent cross-connection collisions. | `ebay-listings.service.ts:106, 208` |

## Workstream 3.6 — Email pipeline resilience (1 engineer, 2 days)

| # | Task | Files |
|---|---|---|
| 3.6.1 | `sendAsync` never falls back to synchronous SMTP; raise 503 instead. | `email.service.ts:606-624` |
| 3.6.2 | Preview mode: log only `jobId` + subject-hash, never recipient email or body. | `email.service.ts:702-713` |
| 3.6.3 | Bounce suppression check lifted into `sendAsync` (before enqueue). | `email.worker.ts:36-63`, `email.service.ts` |
| 3.6.4 | Per-tenant email rate-limit (token bucket). | `queue.service.ts` |
| 3.6.5 | Unsubscribe token: one-time use; mark consumed in DB; expire after first call. | `email-preferences.service.ts:176-191` |

## Workstream 3.7 — Webhook delivery hardening (1 engineer, 2 days)

| # | Task | Files |
|---|---|---|
| 3.7.1 | Re-resolve DNS immediately before `fetch`; reject private IPs at delivery time (not only at creation). | `operations/webhook.service.ts:89-117, 411-416` |
| 3.7.2 | Differentiate 4xx (permanent) from 5xx (transient) in retry logic. | `webhook.service.ts:423-424` |
| 3.7.3 | Every outbound delivery carries `X-Idempotency-Key`. | `webhook.service.ts:382-491` |
| 3.7.4 | Circuit breaker threshold configurable per tenant; alert when disabled. | `:451` |

## Workstream 3.8 — Reconciliation & observability foundations (1 engineer, 2 days)

| # | Task | Files |
|---|---|---|
| 3.8.1 | Daily reconciliation job: for each `(tenantId, itemId, warehouseId)`, `SUM(BinBalance) == WarehouseItemBalance`; record drift to `InventoryReconciliation`. | new service |
| 3.8.2 | Daily job: `SUM(stockValueDifference)` by item matches valuation. | same |
| 3.8.3 | Expose Prometheus/OTel metrics: queue depth, DLQ depth, cron last-run-success timestamp, webhook delivery success rate, sync checkpoint age. | `monitoring` |

## Phase 3 verification

- Chaos test: kill a pod mid-email-send → job resumes or lands in DLQ; never silently lost.
- Chaos test: flush Redis → eBay webhooks are not re-processed (DB dedup works).
- Multi-pod test: two pods fire same cron at the same second → only one lock winner runs.
- Sync test: kill API mid-eBay-order-sync → next run resumes from checkpoint, no duplicate orders.
- Reconciliation job run on a seeded tenant with known drift → drift detected and reported.

---

# Phase 4 — Close the Gaps (Week 9–12)

## Goal
Finish stubbed features, eliminate FE/BE contract drift, ship missing auto-emails, add GDPR delete, lock down contracts with schemas + tests.

## Exit criteria

- [ ] Every endpoint declared in a controller is either production-real or removed.
- [ ] All FE↔BE payloads go through a shared schema (Zod or OpenAPI-generated types).
- [ ] Contract tests run in CI for every endpoint.
- [ ] Abandoned cart, review-request, and back-in-stock emails fire on their real triggers.
- [ ] GDPR `DELETE /customers/:id` endpoint exists and anonymizes.
- [ ] Money is `Decimal` server-side; strings on the wire; `big.js`/`decimal.js` on the FE.
- [ ] Every admin write (customer update, theme activate, status override, refund, etc.) creates an audit log.
- [ ] SLOs defined and alerting wired.

## Workstream 4.1 — Contract layer (1 engineer, 5 days)

| # | Task | Files |
|---|---|---|
| 4.1.1 | Define Zod schemas for every request/response in a shared `@platform/contracts` lib. | new lib |
| 4.1.2 | Backend uses schemas as NestJS pipes. | controllers |
| 4.1.3 | Frontend imports the same schemas; fetches return typed data, invalid responses throw. | `apps/web/src/lib/*` |
| 4.1.4 | Standardize envelope: every response is `{ data, meta }`. Remove accidental raw-array returns. | sweep controllers |
| 4.1.5 | FE clients: uniform `unwrap` helper used everywhere. Delete per-client variants. | `lib/api.ts`, `lib/store-api.ts`, `lib/admin-fetch.ts`, `lib/variants-api.ts`, `lib/reviews-api.ts`, `lib/wishlist-api.ts` |
| 4.1.6 | Rename to eliminate drift: `discountAmount → discountTotal`, `zipCode → postalCode`, `token → access_token` (or enforce `token` everywhere). | breaking migration with deprecation headers |
| 4.1.7 | Contract test harness in CI (e.g., Pact or Zod-based recorder). | CI pipeline |

## Workstream 4.2 — Frontend consistency (1 engineer, 3 days)

| # | Task | Files |
|---|---|---|
| 4.2.1 | 401 refresh interceptor forwards `x-tenant-id` (and `x-cart-session` when relevant). | `lib/api.ts:69-96` |
| 4.2.2 | Token source no longer keyed on URL substring; use an explicit `apiClient` variable (`customerApi`, `adminApi`). | `lib/api.ts:32` |
| 4.2.3 | `auth-store.ts`: validate token shape before persisting. | `:63-64, 294-298` |
| 4.2.4 | `resolved_tenant_id` cleared on logout and on tenant switch. | `auth-store.ts:122-134` |
| 4.2.5 | `tenantCurrency` read via a reactive store, not `localStorage` getter. | `app/app/page.tsx:43-49` |
| 4.2.6 | `formatDate` reads locale from store, updates on language change. | `:52-58` |
| 4.2.7 | Debounce + request cancellation on every search field. | `app/app/products/page.tsx:75-81` |
| 4.2.8 | `fetch` calls use `credentials: 'include'` if cookies are ever adopted; else remove `fetch` in favor of shared client. | `lib/store-api.ts:90` |
| 4.2.9 | Cart store: persist minimal keys; hydrate from API on mount; revalidate on focus. | `lib/cart-store.ts:66-307` |
| 4.2.10 | Error boundaries: add retry + navigate-home CTA. | `app/*/error.tsx` |

## Workstream 4.3 — Admin audit + GDPR (1 engineer, 3 days)

| # | Task | Files |
|---|---|---|
| 4.3.1 | `AuditLogInterceptor` on every admin controller with an allowlist of non-sensitive GETs. | new interceptor |
| 4.3.2 | Customer notes, isActive toggles, refunds, theme activations, status overrides: all audit-logged with before/after diffs. | `admin-customers.service.ts:268-283, 302-312`, `themes.service.ts`, `orders.service.ts`, `payments.service.ts` |
| 4.3.3 | `DELETE /admin/customers/:id` performs cascade + anonymization (email → `deleted-<id>@tenant.invalid`, addresses cleared, PII scrubbed). | new endpoint |
| 4.3.4 | `POST /account/export` — customer data export (GDPR right-to-data). | new endpoint |
| 4.3.5 | Per-tenant `audit_retention_days` config; cleanup respects it. | `cleanup.service.ts:223-243` |

## Workstream 4.4 — Missing email triggers (0.5 engineer, 2 days)

| # | Task | Files |
|---|---|---|
| 4.4.1 | Abandoned cart: cron scans carts inactive 4h + 24h + 72h; sends template if customer email known; records `abandonedEmailSentAt`. | `cleanup.service.ts` or new service |
| 4.4.2 | Review request: job enqueued from `updateOrderStatus(DELIVERED)`, delayed 3 days. | `orders.service.ts` |
| 4.4.3 | Back-in-stock: `StockMovement` with `postingType=RECEIPT` triggers query of `WishlistItem` for that product where `notifyOnStock=true`; enqueue jobs. | `stock-movement.service.ts` post-commit hook |

## Workstream 4.5 — Marketplace stubs: cut or ship (2 engineers, 5 days — parallelizable)

Triage each of the 16 stub controllers:

| Controller | Action |
|---|---|
| `ebay-campaigns` | **Ship** — promoted listings is core seller workflow. |
| `ebay-finances` | **Ship** — payouts + fees reconciliation required for accounting. |
| `ebay-returns` | **Ship** — returns sync required for order integrity. |
| `ebay-messaging` | Ship or remove depending on product decision. |
| `ebay-disputes` | Ship or remove. |
| `ebay-feedback` | Ship. |
| `ebay-inquiries` | Ship or remove. |
| `ebay-negotiations` | Defer (behind feature flag). |
| `ebay-offers` | Ship. |
| `ebay-promotions` | Ship. |
| `ebay-rbac` | Remove — internal feature not surfaced to merchant. |
| `ebay-store-categories` | Ship. |
| `ebay-catalog` | Ship. |
| `ebay-compliance` | Ship — required for some categories. |
| `ebay-cross-border` | Defer (behind feature flag). |
| `ebay-email-campaigns` | Remove or defer. |
| `ebay-keywords` | Defer. |
| `ebay-analytics` | Ship read-only summary. |
| `ebay-inventory-locations` | Ship — already referenced by listings. |

For each "remove" decision: delete controller + route + FE page link. For each "ship" decision: write service, unit tests, contract schema.

## Workstream 4.6 — Observability & SLOs (1 engineer, 3 days)

| # | Task | Files |
|---|---|---|
| 4.6.1 | Define SLOs: API p95 latency, checkout success rate, webhook delivery success, sync freshness, queue depth. | RFC doc |
| 4.6.2 | Dashboards for commerce loop (cart→checkout→payment→fulfill). | monitoring |
| 4.6.3 | Error budget alerts, routed to on-call. | monitoring |
| 4.6.4 | Structured logs: scrub PII; enforce via log processor. | `common/logger` |
| 4.6.5 | Every webhook event type counted + error-classified. | `stripe-connect-webhook`, `sendgrid-webhook`, `ebay-webhook` |

## Workstream 4.7 — Schema & indexing cleanup (0.5 engineer, 2 days)

| # | Task | Files |
|---|---|---|
| 4.7.1 | Add composite indexes: `(tenantId, customerId)` on ProductReview; `(tenantId, status)` on GiftCard; `(tenantId, userId, isRead)` on Notification; `(tenantId, zoneId)` on ShippingRate. | migration |
| 4.7.2 | Partial indexes for soft-deletes via raw SQL migration. | migration |
| 4.7.3 | Replace free-string enums (`Tenant.customDomainStatus`, `FailedOperation.referenceType`, `ShipmentEvent.status`, `Payment.type`). | schema |
| 4.7.4 | Add `Payment.type NOT NULL` with default + backfill. | migration |
| 4.7.5 | Add `Notification.userId` FK (currently plain string). | migration |
| 4.7.6 | Add XOR CHECK constraint on `RefreshToken (userId XOR customerId)`. | migration |
| 4.7.7 | Change `Tenant.onDelete` cascade to Restrict; provide explicit tenant-archive workflow. | schema |

## Phase 4 verification

- Every controller route appears in the OpenAPI or Zod contract registry.
- Every FE API call type-checks against the same contract.
- CI fails on any unregistered endpoint.
- GDPR e2e: create customer → place order → issue delete → verify PII scrubbed, order retained with anonymized identity.
- Abandoned-cart email: seed a cart, fast-forward clock, verify email fired exactly once.
- Observability: dashboards populated; simulated error budget burn triggers alert.

---

# Dependencies & sequencing notes

```
Phase 1 ─┬─► Phase 2 (commerce can't be correct without tenant-safe primitives)
         └─► Phase 3 partial (queue hardening doesn't block on Phase 2)

Phase 2 ─┬─► Phase 3 rest (eBay FailedOps routing needs stable queue lib)
         └─► Phase 4 (contracts, GDPR, audit log benefit from correct commerce)

Phase 3 ─── Phase 4 (observability is easier on resilient substrate)
```

You can start Phase 3 Workstream 3.1 (queue hardening) in parallel with Phase 1 — it has no tenant-model dependency. Everything else should follow the order shown.

---

# Risk register

| Risk | Mitigation |
|---|---|
| Migrations in Phase 1 (tenantId backfill, RLS) can lock production tables. | Stage in maintenance window or use `CREATE INDEX CONCURRENTLY` / lazy backfill. |
| Re-encrypting credentials (1.4.3) needs downtime or dual-read path. | Dual-read: decrypt with either key version; write only with new. Roll forward. |
| Standardizing FE envelope (4.1.4-6) is a breaking change. | Emit both shapes with a `deprecation` header for 2 releases; remove old after observed zero usage. |
| Shipping controller consolidation (2.1.4) breaks whichever admin UI path was being used. | Feature-flag new endpoint, verify FE traffic, then delete old. |
| Changing `Cart` TTL (2.6.1) may surprise customers with longer active carts. | Gradual rollout; keep absolute max at 7d for now. |
| Removing `ALLOW_TENANT_HEADER` (1.1.6) may break internal tooling. | Replace with a signed service-token header. |

---

# Metrics — how to know you're done

- **Phase 1**: 0 matches for blocklisted secret strings in `grep`; cross-tenant probe returns 403; all tenant-scoped Prisma models have `tenantId` + RLS.
- **Phase 2**: Chaos tests pass; money reconciles to the cent on a 1k-order synthetic run; replayed webhooks are no-ops.
- **Phase 3**: Multi-pod deploy survives pod kills with zero duplicate writes; DLQ depth is the alerting oracle.
- **Phase 4**: Contract registry covers 100% of endpoints; CI rejects unregistered ones; SLO dashboards reflect healthy burn rate.

---

*End of plan.*
