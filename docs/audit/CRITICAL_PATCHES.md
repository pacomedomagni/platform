# Critical Findings — Concrete Patch Plan

Companion to `docs/SYSTEM_AUDIT.md` and `docs/REMEDIATION_PLAN.md`. This document gives the exact code-level fixes for the three Critical findings surfaced in the four-flow surgical audit (onboarding / eBay / storefront / inventory) plus the security pass.

> Status: **proposed, not applied.** Each patch needs a migration, a feature flag, and a staged rollout. Order matters: ship in the sequence below.

---

## Index

| ID | Finding | File | Risk if not fixed |
|---|---|---|---|
| C-1 | Concurrent oversell of last unit | `apps/api/src/app/storefront/checkout/checkout.service.ts:283-287` | Two carts both check out the last unit; physical inventory goes negative or a second customer's order can't be fulfilled. |
| C-2 | Webhook idempotency conflated with stock-deduction completion | `apps/api/src/app/storefront/payments/payments.service.ts:118-194` | A crash between `Order.update(CAPTURED)` and `StockMovement.ISSUE` leaves stock un-decremented forever; retry sees CAPTURED and skips. |
| C-3 | Concurrent / partial-amount refund race | `apps/api/src/app/storefront/payments/payments.service.ts:927-1027` | Over-refund of an order; on partial-amount retry, idempotency key drifts and Stripe issues a duplicate refund. |

---

## C-1 — Oversell of last unit (checkout)

### Root cause

[checkout.service.ts:283-293](../../apps/api/src/app/storefront/checkout/checkout.service.ts#L283-L293) computes:

```ts
// Fix #16: Add back cart's own reservation so we don't block ourselves
const availableQty = freshBalances.reduce(
  (sum, b) => sum + Number(b.actualQty) - Number(b.reservedQty),
  0
) + item.quantity;
if (item.quantity > availableQty) { ... }
```

The `+ item.quantity` is intended to undo the cart's own previously-reserved hold (so it doesn't block itself). It is wrong whenever the **current cart's quantity is not yet in `reservedQty`**, or whenever **two carts hold the same unit and each adds back its own qty**.

Race walk-through with `actualQty=1, reservedQty=0`:

| Step | Cart A | Cart B |
|---|---|---|
| 1 | acquires advisory lock for item | waits |
| 2 | reads balance → actual=1 reserved=0 | |
| 3 | available = 1 - 0 + 1 = **2** ✅ passes | |
| 4 | order created, `reservedQty++` → 1, lock released | acquires lock |
| 5 | | reads balance → actual=1 reserved=1 |
| 6 | | available = 1 - 1 + 1 = **1** ✅ passes |
| 7 | | order created, `reservedQty++` → 2 |

Two orders for one unit. Reservation shows over-allocation; payment-time stock deduction will silently go negative (or fail, depending on `allowNegativeStock`).

### Fix

Don't add back the cart's own quantity. The cart's items are not yet reserved at this point in the checkout flow — `reservedQty` is incremented later, at order creation. The check should compare against the **true** available qty:

```ts
const availableQty = freshBalances.reduce(
  (sum, b) => sum + Number(b.actualQty) - Number(b.reservedQty),
  0
);
if (item.quantity > availableQty) {
  throw new BadRequestException(
    `Insufficient stock for ${item.product.displayName}. Available: ${availableQty}`
  );
}
```

If the cart **does** already hold a reservation at this stage in some flows (verify with the cart service), then guard the subtraction:

```ts
const ownReservation = await tx.cartItemReservation.findFirst({
  where: { tenantId, cartId: cart.id, itemId: stockItemId },
  select: { reservedQty: true },
});
const availableQty = freshBalances.reduce(
  (sum, b) => sum + Number(b.actualQty) - Number(b.reservedQty),
  0
) + Number(ownReservation?.reservedQty ?? 0); // explicit, queried — not blind add-back
```

Either form is safe; the current code is not.

### Tests required

- Concurrency test: 2 simultaneous checkouts on `actualQty=1, reservedQty=0` — exactly one must succeed, the other must throw `Insufficient stock`.
- Single-cart retry: same cart double-clicks checkout → second is idempotent (already covered by the existing-order check at `checkout.service.ts:41`).

### Rollout

- Pure logic fix. No schema migration. No flag.
- Deploy behind `featureFlags.strictStockCheck` for first 24h to compare error rates.

---

## C-2 — Webhook idempotency conflated with stock deduction

### Root cause

[payments.service.ts:164-194](../../apps/api/src/app/storefront/payments/payments.service.ts#L164-L194) — `isWebhookOutcomePersisted` decides "did the prior webhook attempt actually finish?" by checking `order.paymentStatus === 'CAPTURED'`. But `handlePaymentSucceeded` ([payments.service.ts:283-308](../../apps/api/src/app/storefront/payments/payments.service.ts#L283-L308)) does:

1. `prisma.$transaction([Order.update CAPTURED, Payment.create])` ← commits
2. Fire-and-forget `webhookService.triggerEvent(...)` ([payments.service.ts:313-320](../../apps/api/src/app/storefront/payments/payments.service.ts#L313-L320))
3. `processOrderFulfillment(order)` ← creates StockMovement.ISSUE, releases reservation

If the worker crashes after step 1 but before step 3, the next webhook delivery from Stripe (Stripe retries failed webhooks for up to 3 days) will:

- Insert dedup row → conflict (already there)
- Call `isWebhookOutcomePersisted` → reads `order.paymentStatus === 'CAPTURED'` → **returns `true`** ("safe to skip")
- Skip everything.

Stock is never decremented. The order is "fulfilled" on paper but inventory is wrong.

### Fix

Idempotency should track the **last completed effect**, not a downstream proxy. Two options:

#### Option A (preferred) — explicit fulfillment marker on Order

Add a `stockIssuedAt` (and `refundProcessedAt` for charge.refunded) to `Order`:

```prisma
model Order {
  // ... existing fields
  stockIssuedAt        DateTime?
  refundProcessedAt    DateTime?
  paymentRecordedAt    DateTime?
}
```

Migration:

```sql
ALTER TABLE orders ADD COLUMN stock_issued_at      TIMESTAMP(3);
ALTER TABLE orders ADD COLUMN refund_processed_at  TIMESTAMP(3);
ALTER TABLE orders ADD COLUMN payment_recorded_at  TIMESTAMP(3);

-- Backfill: any order already CAPTURED + has at least one ISSUE stock movement
-- gets stockIssuedAt set so retries don't re-deduct on first deploy.
UPDATE orders o
SET stock_issued_at = o.confirmed_at
WHERE o.payment_status = 'CAPTURED'
  AND EXISTS (
    SELECT 1 FROM stock_ledger_entries s
    WHERE s.tenant_id = o.tenant_id
      AND s.voucher_no LIKE '%' || o.order_number || '%'
      AND s.qty < 0
  );
UPDATE orders SET payment_recorded_at = confirmed_at WHERE payment_status = 'CAPTURED';
UPDATE orders SET refund_processed_at = refunded_at  WHERE payment_status IN ('REFUNDED','PARTIALLY_REFUNDED');
```

Update `handlePaymentSucceeded` to set markers as side-effects complete:

```ts
// inside handlePaymentSucceeded, replace the existing $transaction with:
await this.prisma.$transaction([
  this.prisma.order.update({
    where: { id: orderId },
    data: {
      paymentStatus: 'CAPTURED',
      status: 'CONFIRMED',
      confirmedAt: new Date(),
      paymentRecordedAt: new Date(),  // NEW
      stripeChargeId: typeof charges === 'string' ? charges : charges?.id,
    },
  }),
  this.prisma.payment.create({ /* unchanged */ }),
]);

// ... fire-and-forget webhook unchanged ...

await this.processOrderFulfillment(order);

// After fulfillment succeeds (stock issued, reservations released), mark it:
await this.prisma.order.update({
  where: { id: orderId },
  data: { stockIssuedAt: new Date() },
});
```

`processOrderFulfillment` itself is already transactional; the `stockIssuedAt` update happens *after* it returns successfully, so if fulfillment crashes the marker stays null and the next retry resumes.

Now rewrite `isWebhookOutcomePersisted`:

```ts
private async isWebhookOutcomePersisted(event: Stripe.Event): Promise<boolean> {
  const obj = event.data.object as { metadata?: Record<string, string>; id?: string };
  const orderId = obj?.metadata?.['orderId'];
  if (!orderId) return true;

  const order = await this.prisma.order.findUnique({
    where: { id: orderId },
    select: {
      paymentRecordedAt: true,
      stockIssuedAt: true,
      refundProcessedAt: true,
    },
  });
  if (!order) return true;

  switch (event.type) {
    case 'payment_intent.succeeded':
      // Both legs must be done before we skip the retry.
      return !!(order.paymentRecordedAt && order.stockIssuedAt);
    case 'payment_intent.payment_failed':
      return !!order.paymentRecordedAt; // failed-payment handler also stamps this
    case 'charge.refunded':
      return !!order.refundProcessedAt;
    default:
      return true;
  }
}
```

#### Option B (lighter, no schema) — derived check

Query the `StockLedgerEntry` table for an ISSUE row referencing this order. Costs an extra query per webhook but no schema change:

```ts
const issued = await this.prisma.stockLedgerEntry.count({
  where: {
    tenantId: order.tenantId,
    voucherType: 'Stock Issue',
    qty: { lt: 0 },
    // assumes voucher metadata or a meta JSON column references the orderId
    OR: [
      { meta: { path: ['orderId'], equals: orderId } },
      { voucherNo: { contains: order.orderNumber } },
    ],
  },
});
return issued > 0;
```

Option B is fine as a hotfix; Option A is the right long-term shape.

### Tests required

- Inject a fault between `Order.update(CAPTURED)` and `processOrderFulfillment`. Assert that on webhook retry, stock IS deducted (current code skips it).
- Stripe re-deliver the same `evt_…` after success → must be a no-op (no double deduction).
- `payment_intent.payment_failed` retry → stamps `paymentRecordedAt` once.

### Rollout

1. Ship migration + dual-write (set `paymentRecordedAt` *and* still rely on `paymentStatus`) — 1 deploy.
2. Backfill historical rows (above SQL).
3. Switch `isWebhookOutcomePersisted` to read the new fields — 2nd deploy.
4. Monitor `webhook.duplicate_outcome_persisted=false` rate; expect a small bump as previously-silent crashes now retry correctly.

---

## C-3 — Refund concurrency + partial-retry duplicate

### Two distinct bugs in one path

#### C-3a — over-refund race

[payments.service.ts:961-977](../../apps/api/src/app/storefront/payments/payments.service.ts#L961-L977):

```ts
const existingRefunds = await this.prisma.payment.findMany({ /* OUTSIDE any tx */ });
const totalRefunded = existingRefunds.reduce(...);
if (totalRefunded + refundAmount > orderTotal) throw ...;
// later: createStripeRefund(...) writes Payment row
```

No row lock on the order. Two simultaneous refund clicks both read `totalRefunded=0`, both pass, both succeed at Stripe. Order is over-refunded.

#### C-3b — partial-amount retry → duplicate Stripe refund

[payments.service.ts:1023-1027](../../apps/api/src/app/storefront/payments/payments.service.ts#L1023-L1027):

```ts
const idempotencyKey = `refund_${orderId}_${amountCents}`;
```

Stable for the same `(orderId, amount)`. **Not** stable across attempts with different amounts:

- Attempt 1: refund $60 → Stripe processes successfully → response lost in flight.
- Operator sees "error", retries refund $50 (the remaining balance, as they think).
- New idempotency key `refund_X_5000` ≠ `refund_X_6000` → Stripe creates a second $50 refund.
- Order now refunded $110 of $100.

### Fix

Wrap validation, Stripe call, and Payment row creation in a single transaction with a row lock on the order. Use Stripe's API as the source of truth for prior refunds, not just our `Payment` table.

```ts
async createRefund(
  tenantId: string,
  orderId: string,
  amount?: number,
  reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer',
) {
  return this.prisma.$transaction(async (tx) => {
    // 1. Lock the order row so concurrent refund attempts serialize.
    const [order] = await tx.$queryRaw<Array<any>>`
      SELECT id, "tenantId", "grandTotal", "paymentStatus",
             "stripePaymentIntentId", "stripeChargeId", currency
      FROM orders
      WHERE id = ${orderId} AND "tenantId" = ${tenantId}
      FOR UPDATE
    `;
    if (!order) throw new NotFoundException('Order not found');
    if (!['CAPTURED', 'PARTIALLY_REFUNDED'].includes(order.paymentStatus)) {
      throw new BadRequestException('Order payment must be captured before refunding');
    }

    const orderTotalCents = Money.toCents(Money.dec(order.grandTotal));
    const requestedCents = amount != null
      ? Money.toCents(Money.dec(amount))
      : orderTotalCents;
    if (requestedCents <= 0) throw new BadRequestException('Refund amount must be positive');

    // 2. Source-of-truth refund total: ask Stripe, not our Payment table.
    //    Our table can lag if a webhook hasn't written yet; Stripe is authoritative.
    let priorRefundedCents = 0;
    if (order.stripeChargeId) {
      const stripeRefunds = await this.stripeService.listRefunds({
        charge: order.stripeChargeId,
        limit: 100,
      });
      priorRefundedCents = stripeRefunds.data.reduce((s, r) => s + r.amount, 0);
    } else {
      // Square or other: fall back to our Payment table, still inside the tx
      const existing = await tx.payment.findMany({
        where: { orderId, OR: [{ type: 'REFUND' }, { status: 'REFUNDED' }] },
      });
      priorRefundedCents = existing.reduce(
        (s, p) => s + Money.toCents(Money.dec(p.amount)), 0,
      );
    }

    if (priorRefundedCents + requestedCents > orderTotalCents) {
      throw new BadRequestException(
        `Refund would exceed order total. ` +
        `Already refunded: ${priorRefundedCents}c, requested: ${requestedCents}c, ` +
        `order total: ${orderTotalCents}c`
      );
    }

    // 3. Idempotency key — include the cumulative refunded amount so retries
    //    for the SAME logical refund collapse, but new logical refunds (after
    //    a partial success) get a new key. Stripe will dedupe identical keys.
    const idempotencyKey =
      `refund_${orderId}_${priorRefundedCents}_to_${priorRefundedCents + requestedCents}`;

    // 4. Call Stripe / Square inside the tx-await chain. If the network call
    //    succeeds and we crash before commit, the row lock prevents the next
    //    attempt from proceeding until tx times out; on retry, the
    //    listRefunds call above will see the prior refund and we'll collapse
    //    via the idempotency key OR detect over-refund and refuse.
    const refund = await this.stripeRefundCall(order, idempotencyKey, requestedCents, reason);

    // 5. Write the Payment row inside the tx. If this fails, Stripe already
    //    has the refund; reconciler will repair from listRefunds.
    await tx.payment.create({ /* refund record, type: 'REFUND', amount, stripeRefundId */ });
    await tx.order.update({
      where: { id: orderId },
      data: {
        paymentStatus: priorRefundedCents + requestedCents === orderTotalCents
          ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
        refundedAt: new Date(),
      },
    });

    return refund;
  }, { timeout: 30_000, isolationLevel: 'Serializable' });
}
```

Two key shifts:

- **Row lock + Serializable isolation** ⇒ concurrent refund clicks serialize. Second one sees the first's refund and either passes (different amount fits) or refuses (would exceed total).
- **Stripe `listRefunds` is the source of truth.** This survives lost responses, lost webhooks, partial successes, and DB-vs-Stripe drift. Our `Payment` table becomes a cache of Stripe state, not the gating record.
- **Idempotency key includes prior cumulative refunded amount.** A retry of the *same* logical refund (lost network, same prior state) recomputes the same key and Stripe dedupes. A *different* refund (after a prior partial success) gets a different key, which is what we want.

### Tests required

- Two concurrent `createRefund` calls on the same order → exactly one succeeds, the other gets either a "would exceed" error or refunds the remaining balance — never both refund the full amount.
- Lost-response retry: mock Stripe to return success then drop the response; retry → Stripe receives the same idempotency key and returns the original refund object; our DB ends up with one Payment row.
- Partial-success retry: refund $60 succeeds, response lost; admin retries $50 → `listRefunds` returns the $60 → over-refund check refuses (or accepts $40, the actual remainder).

### Rollout

1. Add Stripe `listRefunds` call to refund path — feature-flagged off (compares against current logic, alerts on drift). 1 week observation.
2. Switch validation source to `listRefunds`. Keep DB read as fallback.
3. Add the row lock and Serializable isolation. Measure tx contention; the order-level lock should be uncontended in practice.

---

## Suggested PR sequence

| PR | Scope | Migration | Risk |
|---|---|---|---|
| 1 | C-1 (oversell math) | none | low — pure logic |
| 2 | C-2 step 1: add `paymentRecordedAt`, `stockIssuedAt`, `refundProcessedAt` cols + dual-write | yes | low — additive |
| 3 | C-2 step 2: backfill SQL, then flip `isWebhookOutcomePersisted` | data backfill | medium — touches webhook path; gate behind flag |
| 4 | C-3a: Stripe `listRefunds` as source of truth (read-only, alerts on drift) | none | low |
| 5 | C-3b: row lock + Serializable in `createRefund` + new idempotency key shape | none | medium — deploy off-hours; monitor refund error rate |

Each PR independently rollback-able. C-1 unblocks no one and should ship first. C-2 and C-3 are independent.

---

## Out-of-scope here, tracked elsewhere

- I-1 `allowNegativeStock` permission gate → tracked in `REMEDIATION_PLAN.md` Phase 2
- E-1/E-2 eBay token refresh and revoke → Phase 3
- E-8 eBay public key pinning → Phase 1
- O-8 auth error / timing equalization → Phase 1
- Storage MIME-mismatch reject → Phase 1
- PII at-rest encryption → Phase 1

This document closes the loop on the three findings that the existing `REMEDIATION_PLAN.md` lists as goals but does not give code for.
