# Code Review Report — Honest Assessment

**Date:** February 10, 2026
**Scope:** All new implementations
**Overall Score: 60-65/100 — NOT production ready**

---

## CATEGORY 1: WILL CRASH AT RUNTIME

### CRASH-1: `autoPostInvoices` — variable name typo → ReferenceError
**File:** [gl-posting.service.ts:420-430](apps/api/src/app/accounting/gl-posting.service.ts#L420-L430)

```typescript
const unpPostedInvoices = await this.prisma.invoice.findMany({ ... });  // line 420
for (const invoice of unpostedInvoices) {  // line 430 — different name
```

`unpostedInvoices` is never declared. This endpoint crashes 100% of the time.

---

### CRASH-2: ActivityService call signature mismatch in OrdersService → TypeError
**File:** [orders.service.ts:282](apps/api/src/app/storefront/orders/orders.service.ts#L282)

`ActivityService.logActivity` signature is `(tenantId: string, data: {...})` — two args.

But every call in `orders.service.ts` passes a **single object** with `tenantId` inside it:
```typescript
// How it's called in orders.service.ts (lines 282, 368, 406, 530):
this.activityService.logActivity({
  tenantId,        // ← this becomes the first arg (an object), second arg is undefined
  entityType: 'order',
  ...
});

// How the method is defined in activity.service.ts:
async logActivity(tenantId: string, data: { entityType: string; ... })
//                 ^ receives object    ^ receives undefined
```

Result: `tenantId` in the service receives `{tenantId, entityType, ...}` (an object, not a string). The `data` parameter receives `undefined`. The `this.prisma.activityEvent.create({ data: { tenantId: [object Object], entityType: undefined, ... } })` call will either throw a Prisma validation error or write garbage to the DB.

This affects **every single activity log from OrdersService** — status changes, refunds, notes, fulfillment. All broken.

Note: `ReturnsService` and `PaymentsService` call it the same wrong way. Every activity log call in the codebase uses the wrong signature.

---

### CRASH-3: `createReconciliation` writes fields that don't exist in schema → Prisma error
**File:** [bank-reconciliation.service.ts:269-277](apps/api/src/app/accounting/bank-reconciliation.service.ts#L269-L277)

The code creates `BankReconciliationDetail` records with these fields:
```typescript
details.push({
  tenantId,
  transactionId: txn.id,      // ❌ schema field is "bankTransaction" (string), not "transactionId"
  transactionDate: txn.transactionDate,  // ❌ schema field is "postingDate"
  amount: txn.amount,          // ✅ exists
  transactionType: txn.transactionType,  // ❌ does not exist in schema
  description: txn.description,          // ❌ does not exist in schema
});
```

The `BankReconciliationDetail` model only has: `bankTransaction`, `glEntryId`, `voucherType`, `voucherNo`, `amount`, `postingDate`, `isMatched`, `clearanceDate`.

Prisma will throw `Unknown field` errors. The entire `createReconciliation` endpoint is broken.

---

### CRASH-4: `OrdersService` injects `ActivityService` without `@Inject()` decorator
**File:** [orders.service.ts:31](apps/api/src/app/storefront/orders/orders.service.ts#L31)

```typescript
@Optional() private readonly activityService?: ActivityService,
```

Missing `@Inject(ActivityService)`. Compare with the correct pattern used in `ReturnsService`:
```typescript
@Optional() @Inject(ActivityService) private readonly activityService?: ActivityService,
```

NestJS cannot resolve the dependency by position alone for optional providers when there are multiple optional dependencies. This may inject `undefined` even when ActivityService is available, or worse, inject the wrong dependency.

---

## CATEGORY 2: DATA CORRUPTION / RACE CONDITIONS

### RACE-1: `fulfillOrderItems` — no transaction, concurrent requests cause over-fulfillment
**File:** [orders.service.ts:424-551](apps/api/src/app/storefront/orders/orders.service.ts#L424-L551)

The method:
1. Reads order + items (line 432)
2. Validates quantities (line 460: `newFulfilled > totalOrdered`)
3. Increments `quantityFulfilled` via `Promise.all` (line 473)

None of this is in a transaction. Two concurrent requests both read the same state, both pass validation, both increment. An item with quantity 10 can end up with `quantityFulfilled = 15`.

Worse: the `Promise.all` on line 473 runs all item updates concurrently but each `orderItem.update` is independent — if one fails mid-way, the others still commit. You get partial fulfillment with no rollback.

---

### RACE-2: `cancelCheckout` stock release corrupts inventory across ALL warehouses
**File:** [checkout.service.ts:571-579](apps/api/src/app/storefront/checkout/checkout.service.ts#L571-L579)

```typescript
await tx.warehouseItemBalance.updateMany({
  where: { tenantId, itemId: item.product.item.id },
  data: { reservedQty: { decrement: item.quantity } },
});
```

`updateMany` with no `warehouseId` filter decrements `reservedQty` on **every warehouse** that holds this item. If item X exists in warehouses A, B, C, and was reserved only from warehouse A, cancellation decrements all three. Warehouses B and C get negative `reservedQty`.

This is the opposite of the checkout flow which correctly reserves per-warehouse. The release is a shotgun blast.

---

### RACE-3: Return number generation — race condition produces duplicates
**File:** [returns.service.ts:141-155](apps/api/src/app/storefront/returns/returns.service.ts#L141-L155)

```typescript
const lastReturn = await tx.returnRequest.findFirst({
  where: { tenantId },
  orderBy: { createdAt: 'desc' },
  select: { returnNumber: true },
});
nextNumber = parseInt(match[1], 10) + 1;
```

Two concurrent requests in separate transactions both read the same `lastReturn`, both compute the same `nextNumber`. The schema has `@@unique([tenantId, name])` on `returnRequests` but the unique key is on `name`, not `returnNumber`. There's no unique constraint on `returnNumber`, so both inserts succeed with duplicate return numbers.

Compare with `checkout.service.ts` which correctly uses `UPDATE...RETURNING` for atomic order number generation.

---

### RACE-4: Stock reservation and release are not tied to any entity — phantom reservations
**File:** [stock-reservation.service.ts](apps/api/src/app/inventory-management/stock-reservation.service.ts)

The reserve/release API increments/decrements `reservedQty` on `WarehouseItemBalance`, but there is no `StockReservation` model in the schema. There's no record of who reserved what, when, or why. The `reference` parameter is only logged, never persisted.

Consequences:
- If the app crashes between reserve and order creation, stock is permanently locked
- There's no cleanup job possible because there's no reservation record to expire
- `releaseStock` releases any amount for any caller — no ownership verification
- `getOrderReservations` doesn't actually show the order's reservations — it shows ALL reservations for items that happen to be in the order

---

### RACE-5: Auto-match can double-match the same invoice to multiple bank transactions
**File:** [bank-reconciliation.service.ts:129-163](apps/api/src/app/accounting/bank-reconciliation.service.ts#L129-L163)

The loop iterates unreconciled transactions and for each one, queries invoices by amount + date within ±7 days. It marks the transaction as reconciled but never marks the invoice as matched. Two bank transactions with amount $500 within 7 days of the same $500 invoice will BOTH match to it. Revenue gets double-counted in reconciliation.

---

## CATEGORY 3: WRONG BUSINESS LOGIC

### LOGIC-1: Fulfillment auto-ship only from PROCESSING, but fulfillment allowed from CONFIRMED
**File:** [orders.service.ts:442,497](apps/api/src/app/storefront/orders/orders.service.ts#L442)

```typescript
// Line 442: allows fulfillment from CONFIRMED
if (!['CONFIRMED', 'PROCESSING'].includes(order.status)) { throw... }

// Line 497: only auto-ships from PROCESSING
if (allItemsFulfilled && updatedOrder!.status === 'PROCESSING') { ... }
```

A CONFIRMED order that gets fully fulfilled in a single request stays CONFIRMED forever. The admin sees "all items fulfilled" but the order never transitions to SHIPPED. Customer never gets a shipping notification email.

---

### LOGIC-2: GL posting uses wrong accounting entry for paid invoices
**File:** [gl-posting.service.ts:70-110](apps/api/src/app/accounting/gl-posting.service.ts#L70-L110)

The code posts: **Debit: Accounts Receivable, Credit: Revenue**

But this is only posted when the invoice status is PAID (line 47-49). For a paid invoice, the correct entries are:
- When invoice is issued: Debit Receivable, Credit Revenue
- When payment is received: Debit Cash/Bank, Credit Receivable

Posting Debit Receivable + Credit Revenue at the time of payment means the receivable is never closed. The books show the customer still owes money even though they've paid. The receivable account inflates forever.

---

### LOGIC-3: `postExpense` doesn't validate expense status — drafts get posted
**File:** [gl-posting.service.ts:139-151](apps/api/src/app/accounting/gl-posting.service.ts#L139-L151)

`postInvoice` correctly checks `invoice.status !== PAID`. But `postExpense` has no status check at all. A draft, unapproved, or deleted expense can be posted to the general ledger, creating real financial entries from preliminary data.

---

### LOGIC-4: Credit limit check queries wrong field in checkout
**File:** [checkout.service.ts:82-88](apps/api/src/app/storefront/checkout/checkout.service.ts#L82-L88)

```typescript
const unpaidOrders = await tx.order.findMany({
  where: {
    tenantId,
    customerId,   // ← this is StoreCustomer.id
    paymentStatus: { in: ['PENDING', 'AUTHORIZED'] },
  },
});
```

The `Order.customerId` field is a relation to `StoreCustomer.id`. But the `customerId` variable here comes from the checkout DTO's `customerId` parameter. The credit limit is on the B2B `Customer` model, but the query only checks orders for one specific `StoreCustomer`. If a B2B customer has 3 linked StoreCustomers, only orders from one are counted. The credit limit is bypassed by ordering from different store accounts.

---

### LOGIC-5: B2B `getCustomer` credit usage query uses wrong Prisma relation path
**File:** [b2b-customers.service.ts:150-163](apps/api/src/app/crm/b2b-customers.service.ts#L150-L163)

```typescript
const orders = await this.prisma.order.findMany({
  where: {
    tenantId,
    customer: {           // Order.customer is StoreCustomer relation
      storeCustomers: {   // StoreCustomer has no "storeCustomers" field
        some: { id: { in: customer.storeCustomers.map((sc) => sc.id) } },
      },
    },
  },
});
```

`Order.customer` points to `StoreCustomer`, not B2B `Customer`. `StoreCustomer` has no `storeCustomers` relation. This query will throw a Prisma validation error or silently return 0 results, making credit usage always show as $0 regardless of actual unpaid orders.

---

### LOGIC-6: Customer segment pagination returns wrong data
**File:** [customers.service.ts:120-132](apps/api/src/app/storefront/customers/customers.service.ts#L120-L132)

1. Fetches 50 customers from DB (with `take: limit, skip: offset`)
2. Computes segment for those 50
3. Filters by segment **after** pagination
4. Returns the unfiltered `total` count

Requesting `?segment=vip&limit=50&offset=0` might return 3 VIPs from the first 50 rows, while there could be 200 VIPs total. The frontend shows "3 of 5000 customers" with broken pagination. Page 2 shows a different random subset.

---

## CATEGORY 4: PERFORMANCE BOMBS

### PERF-1: Trial balance loads all GL entries into memory
**File:** [gl-posting.service.ts:349-383](apps/api/src/app/accounting/gl-posting.service.ts#L349-L383)

```typescript
const entries = await this.prisma.glEntry.findMany({ where, include: { account: ... } });
const balances = entries.reduce((acc, entry) => { ... }, {});
```

Fetches every GL entry for a tenant, loads them all into Node.js memory, then reduces. A busy tenant with 100K+ GL entries will OOM the process or timeout. This should be a `groupBy` aggregation query.

---

### PERF-2: Filter endpoints load all records to extract distinct values
**Files:** [b2b-customers.service.ts:314-330](apps/api/src/app/crm/b2b-customers.service.ts#L314-L330), [suppliers.service.ts:272-288](apps/api/src/app/purchasing/suppliers.service.ts#L272-L288)

```typescript
const customers = await this.prisma.customer.findMany({
  where: { tenantId },
  select: { customerGroup: true, territory: true },
});
const groups = [...new Set(customers.map((c) => c.customerGroup).filter(Boolean))];
```

Loads every customer/supplier into memory just to get distinct group/territory values. With 50K customers, this fetches 50K rows to get maybe 10 distinct values. Should use `groupBy` or `distinct`.

---

### PERF-3: Bank import processes rows sequentially with per-row duplicate check
**File:** [bank-reconciliation.service.ts:68-105](apps/api/src/app/accounting/bank-reconciliation.service.ts#L68-L105)

Each CSV row does:
1. `findFirst` to check for duplicates (query per row)
2. `create` to insert (query per row)

A 1000-row bank statement fires 2000 sequential DB queries. No batching, no transaction. Should use `createMany` with `skipDuplicates` or at least batch the inserts.

---

### PERF-4: Auto-match fires N+1 queries — one per unreconciled transaction
**File:** [bank-reconciliation.service.ts:129-163](apps/api/src/app/accounting/bank-reconciliation.service.ts#L129-L163)

For each unreconciled transaction:
1. Query invoices by amount + date range
2. Update the transaction if matched

If there are 500 unreconciled transactions, that's 500 invoice queries + up to 500 updates = 1000 sequential queries. Should pre-fetch candidate invoices in bulk.

---

### PERF-5: Customer `listCustomers` includes all orders for each customer
**File:** [customers.service.ts:51-69](apps/api/src/app/storefront/customers/customers.service.ts#L51-L69)

```typescript
const customers = await this.prisma.storeCustomer.findMany({
  include: {
    orders: {
      where: { status: { in: [...] } },
      select: { grandTotal: true, createdAt: true },
    },
  },
});
```

For 50 customers on a page, this includes ALL their orders (not just a count). A VIP customer with 500 orders gets all 500 loaded. Should use `_count` and `_sum` aggregation or a raw query with `GROUP BY`.

---

## CATEGORY 5: DATA FLOW GAPS

### FLOW-1: Checkout reserves stock, but payment failure never releases it
**File:** [checkout.service.ts:107-147](apps/api/src/app/storefront/checkout/checkout.service.ts#L107-L147) vs [payments.service.ts:554-616](apps/api/src/app/storefront/payments/payments.service.ts#L554-L616)

**Flow:**
1. `createCheckout` → reserves stock (increments `reservedQty`) → creates order → creates Stripe PaymentIntent
2. Customer's card declines → Stripe sends `payment_intent.payment_failed` webhook
3. `handlePaymentFailed` → marks order as `FAILED` — **but never releases the reserved stock**

The stock stays reserved forever. There's no TTL, no cleanup job, no expiry. The `cancelCheckout` method releases stock, but `handlePaymentFailed` doesn't call it. Over time, available stock decreases to zero even though no real orders exist for those reservations.

---

### FLOW-2: Refund via order doesn't restock inventory
**File:** [orders.service.ts:316-385](apps/api/src/app/storefront/orders/orders.service.ts#L316-L385)

`processRefund` changes the order status to REFUNDED and logs it, but never:
- Creates a stock receipt/return movement
- Increments `actualQty` back in warehouse
- Updates `quantityRefunded` on order items

The refund is purely financial — the inventory is permanently depleted. Returns service has a `restockItems` flow, but direct order refunds bypass it entirely.

---

### FLOW-3: Square payment success path skips stock deduction
**File:** [payments.service.ts:749-824](apps/api/src/app/storefront/payments/payments.service.ts#L749-L824)

`processSquarePayment` updates the order to CONFIRMED and records the payment, but does NOT call `processOrderFulfillment()` (which deducts stock and tracks coupon usage). The Stripe path calls it via `handlePaymentSucceeded`, but Square payments skip it entirely.

Square orders: paid ✓, stock deducted ✗, coupons tracked ✗. Inventory drifts.

---

### FLOW-4: No connection between invoice GL posting and payment reconciliation
**Files:** GL posting creates entries with `voucherType: 'INVOICE'`, `voucherNo: invoice.invoiceNumber`. Bank reconciliation matches by `amount` and `paidDate`. But there's no link between the GL entry and the bank transaction. Reconciling a bank transaction doesn't close the GL receivable. The trial balance and reconciliation are two separate systems that never talk to each other.

---

### FLOW-5: Restock in returns doesn't actually increment warehouse inventory
**File:** [returns.service.ts:334-394](apps/api/src/app/storefront/returns/returns.service.ts#L334-L394)

`restockItems` sets `restocked: true` and `status: 'RESTOCKED'` on return items, but never creates a stock movement or increments `actualQty` in `WarehouseItemBalance`. The items are "restocked" in name only — the physical inventory count is unchanged. Items disappear into a void.

---

## CATEGORY 6: MISSING VALIDATION / SECURITY

### VAL-1: Zero runtime input validation on any new controller
None of the new controllers use class-validator DTOs. Body types are inline TypeScript interfaces that are erased at runtime. A caller can send:
- `quantity: "abc"` → becomes NaN, passes through
- `amount: -999` → negative amounts processed
- `creditLimit: "DROP TABLE"` → passed to Prisma (Prisma handles this, but still)
- Missing required fields → undefined passed to service

The existing codebase (checkout, orders) uses proper `CreateCheckoutDto` with decorators. The new code doesn't.

### VAL-2: `manualMatch` doesn't check if transaction is already reconciled
**File:** [bank-reconciliation.service.ts:185-191](apps/api/src/app/accounting/bank-reconciliation.service.ts#L185-L191)

Can overwrite previous reconciliation silently. No status check.

### VAL-3: Route ordering bug — `GET /orders/:id` catches `GET /orders/lookup/:orderNumber`
**File:** [orders.controller.ts:48,66](apps/api/src/app/storefront/orders/orders.controller.ts#L48)

NestJS evaluates `@Get(':id')` before `@Get('lookup/:orderNumber')`. Request to `/orders/lookup/ORD-123` matches `:id` with `id = 'lookup'` → "Order not found".

### VAL-4: `reserveStock` and `releaseStock` don't validate `quantity > 0`
**File:** [stock-reservation.service.ts:28,117](apps/api/src/app/inventory-management/stock-reservation.service.ts#L28)

A caller can send `quantity: 0` or `quantity: -5`. Zero does nothing but returns success. Negative would decrement instead of increment (reservation turns into release, release turns into reservation).

---

## CATEGORY 7: SCHEMA MISMATCHES

### SCHEMA-1: `createReconciliation` detail fields don't match schema
Code writes: `transactionId`, `transactionDate`, `transactionType`, `description`
Schema has: `bankTransaction`, `postingDate`, `glEntryId`, `voucherType`, `voucherNo`

This is a Prisma runtime crash — `Unknown field`.

### SCHEMA-2: Hardcoded `exchangeRate: 1.0` ignores multi-currency schema design
The schema has separate `debitBc/creditBc` (base currency) and `debitFc/creditFc` (foreign currency) columns on `GlEntry`. But the code always sets FC = BC and `exchangeRate: 1.0`. The multi-currency infrastructure is there but completely unused.

### SCHEMA-3: `BankReconciliation.status` default is `"Draft"` but code writes `"Reconciled"/"Unreconciled"`
The schema default is `"Draft"` and has a `docstatus` int field (ERPNext-style workflow). The code ignores `docstatus` entirely and writes `"Reconciled"/"Unreconciled"` directly to `status`, bypassing the draft/submit workflow the schema was designed for.

---

## SUMMARY

| Category | Issues | Severity |
|----------|--------|----------|
| Will crash at runtime | 4 | CRITICAL |
| Data corruption / races | 5 | HIGH |
| Wrong business logic | 6 | HIGH |
| Performance bombs | 5 | MEDIUM |
| Data flow gaps | 5 | HIGH |
| Missing validation | 4 | MEDIUM |
| Schema mismatches | 3 | HIGH |
| **Total** | **32** | |

### What needs to happen before this goes to production:
1. Fix all 4 crashes (typo, call signature, schema fields, DI decorator)
2. Wrap `fulfillOrderItems` in a transaction with advisory lock
3. Fix `cancelCheckout` stock release to be per-warehouse
4. Add stock release to `handlePaymentFailed`
5. Fix activity logging call signatures across all services
6. Fix GL accounting entries (receivable vs cash)
7. Add runtime input validation DTOs to all new controllers
8. Replace in-memory aggregations with DB-level queries
9. Fix B2B credit usage query to use correct relation path
10. Add reservation tracking model or at minimum a cleanup mechanism

**Assessment: 60-65/100. Multiple endpoints are completely non-functional. Core data flows (payment failure → stock release, refund → inventory return) are broken. Not production ready.**
