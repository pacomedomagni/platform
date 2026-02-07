# Stock Reservation Policy

NoSlag implements a **stock reservation system** to prevent overselling and ensure inventory accuracy.

## Overview

When customers add items to their cart, stock is **temporarily reserved** until:
- The cart expires (abandoned)
- The item is removed from the cart
- Payment is captured (stock is then deducted)

This ensures that items in a customer's cart are **guaranteed to be available** during checkout.

## How It Works

### Database Schema

```sql
Table: warehouse_item_balances
├── tenantId (TEXT)
├── itemId (TEXT)
├── warehouseId (TEXT)
├── actualQty (DECIMAL) -- Physical stock in warehouse
└── reservedQty (DECIMAL) -- Stock reserved in active carts
```

**Available Quantity** = `actualQty - reservedQty`

### Example Flow

**Initial State**:
```
Item: iPhone 15 Pro
actualQty: 100
reservedQty: 0
available: 100
```

**Customer adds 2 to cart**:
```
actualQty: 100 (unchanged - still physically in warehouse)
reservedQty: 2 (reserved for customer's cart)
available: 98
```

**Customer completes checkout**:
```
actualQty: 98 (stock issued/shipped)
reservedQty: 0 (reservation released)
available: 98
```

**Customer abandons cart** (after 7 days):
```
actualQty: 100 (unchanged)
reservedQty: 0 (reservation released automatically)
available: 100
```

## Stock Reservation Lifecycle

### 1. Add to Cart → Reserve Stock

```typescript
// When customer adds item to cart
await tx.$transaction(async (tx) => {
  // 1. Lock stock for this item
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${itemKey}))`;

  // 2. Check available quantity
  const balance = await tx.warehouseItemBalance.findUnique({...});
  const available = balance.actualQty - balance.reservedQty;

  if (available < quantity) {
    throw new Error(`Only ${available} items available`);
  }

  // 3. Add to cart
  await tx.cartItem.create({...});

  // 4. Reserve stock
  await tx.warehouseItemBalance.update({
    where: {...},
    data: { reservedQty: { increment: quantity } },
  });
});
```

**Key points**:
- Advisory lock prevents race conditions
- Stock check happens AFTER lock is acquired
- Reservation and cart creation are atomic

### 2. Update Cart Item → Adjust Reservation

**Increase Quantity**:
```typescript
// Customer changes quantity from 2 to 5
const delta = newQuantity - oldQuantity; // 5 - 2 = 3

await tx.warehouseItemBalance.update({
  data: { reservedQty: { increment: 3 } }, // Reserve 3 more
});
```

**Decrease Quantity**:
```typescript
// Customer changes quantity from 5 to 2
const delta = oldQuantity - newQuantity; // 5 - 2 = 3

await tx.warehouseItemBalance.update({
  data: { reservedQty: { decrement: 3 } }, // Release 3
});
```

### 3. Remove from Cart → Release Reservation

```typescript
// Customer removes item from cart
await tx.$transaction(async (tx) => {
  const cartItem = await tx.cartItem.findUnique({...});

  // 1. Release reservation
  await tx.warehouseItemBalance.update({
    data: { reservedQty: { decrement: cartItem.quantity } },
  });

  // 2. Delete cart item
  await tx.cartItem.delete({...});
});
```

### 4. Payment Success → Transfer to Actual Deduction

```typescript
// After payment is captured
await tx.$transaction(async (tx) => {
  // 1. Issue stock (decrements actualQty)
  await stockMovementService.createMovement({
    movementType: 'ISSUE',
    items: [...],
  });

  // 2. Release reservation
  await tx.warehouseItemBalance.update({
    data: { reservedQty: { decrement: quantity } },
  });
});
```

**Result**:
- Before: `actualQty: 100, reservedQty: 2`
- After: `actualQty: 98, reservedQty: 0`
- Available: Still 98 (correct!)

### 5. Cart Expires → Auto-Release Reservation

Cron job runs **every 10 minutes**:

```typescript
@Cron(CronExpression.EVERY_10_MINUTES)
async cleanupExpiredCarts() {
  const expiredCarts = await prisma.cart.findMany({
    where: {
      status: 'active',
      expiresAt: { lt: new Date() },
    },
  });

  for (const cart of expiredCarts) {
    await tx.$transaction(async (tx) => {
      // 1. Release all reservations for this cart
      for (const item of cart.items) {
        await tx.warehouseItemBalance.update({
          data: { reservedQty: { decrement: item.quantity } },
        });
      }

      // 2. Mark cart as abandoned
      await tx.cart.update({
        where: { id: cart.id },
        data: { status: 'abandoned', abandonedAt: new Date() },
      });
    });
  }
}
```

## Cart Expiration Policy

| Cart Type | Expiration | Purpose |
|-----------|----------|---------|
| Anonymous (guest) | 7 days | Allow time to complete purchase |
| Authenticated | 30 days | Longer for logged-in users |
| Abandoned (manually) | Immediate | When user clears cart |

**Important**: Once a cart expires, **all reservations are released immediately**.

## Edge Cases & Safeguards

### 1. Concurrent Add to Cart (Race Condition)

**Scenario**: 2 customers simultaneously add the last item to cart

```
T0: Stock available = 1
T1: Customer A checks stock → sees 1 available ✓
T2: Customer B checks stock → sees 1 available ✓
T3: Customer A reserves → reservedQty = 1
T4: Customer B reserves → reservedQty = 2 ← OVERSELLING!
```

**Prevention**: Advisory locks

```typescript
// Both customers acquire lock sequentially
await tx.$executeRaw`SELECT pg_advisory_xact_lock(...)`;

// Only first customer succeeds
const available = actualQty - reservedQty; // Checked AFTER lock
if (available < quantity) {
  throw new Error('Insufficient stock');
}
```

### 2. Overselling Prevention

**Validation**: Available quantity is checked on EVERY cart operation:

```typescript
const available = actualQty - reservedQty;

if (available < requestedQuantity) {
  throw new BadRequestException(
    `Only ${available} items available in stock`
  );
}
```

**Enforcement**: Database-level check (optional):

```sql
ALTER TABLE warehouse_item_balances
ADD CONSTRAINT check_reserved_not_greater_than_actual
CHECK (reserved_qty <= actual_qty);
```

### 3. Negative Stock (When Allowed)

Some merchants allow **backorders** (negative stock):

```typescript
const tenant = await prisma.tenant.findUnique({
  where: { id: tenantId },
  select: { allowNegativeStock: true },
});

if (!tenant.allowNegativeStock && available < quantity) {
  throw new Error('Insufficient stock');
}
// If negative stock allowed, reservation proceeds
```

### 4. Cart Merge (Anonymous → Authenticated)

**Scenario**: User adds items as guest, then logs in

```typescript
// Merge anonymous cart into customer cart
await tx.$transaction(async (tx) => {
  const anonymousCart = await tx.cart.findUnique({
    where: { sessionToken },
    include: { items: true },
  });

  for (const item of anonymousCart.items) {
    // Upsert item into customer cart (combines quantities)
    await tx.cartItem.upsert({
      where: { cartId_productId: {...} },
      update: { quantity: { increment: item.quantity } },
      create: {...},
    });

    // Reservation automatically transferred (no change needed)
  }

  // Delete anonymous cart
  await tx.cart.delete({ where: { id: anonymousCart.id } });
});
```

**Key**: Reservations are per item, not per cart, so they automatically transfer.

### 5. Stock Adjustment During Reservation

**Scenario**: Admin updates stock while items are reserved

```typescript
// Admin receives new stock
await stockMovementService.createMovement({
  movementType: 'RECEIPT',
  quantity: 50,
});

// Result:
// actualQty: 100 → 150
// reservedQty: 20 (unchanged)
// available: 80 → 130 (more stock available for new customers)
```

**Scenario**: Admin issues stock for wholesale order

```typescript
// Admin creates stock issue
await stockMovementService.createMovement({
  movementType: 'ISSUE',
  quantity: 30,
});

// Result:
// actualQty: 150 → 120
// reservedQty: 20 (unchanged - existing carts unaffected)
// available: 130 → 100
```

## Monitoring & Alerts

### Stock Reservation Metrics

```bash
GET /api/v1/monitoring/metrics
```

**Response**:
```json
{
  "stockReservations": {
    "totalReservedQty": 1250,
    "totalActualQty": 5000,
    "divergencePercentage": 25, // Reserved / Actual * 100
    "negativeStockCount": 0,
    "overReservedCount": 0 // CRITICAL: reserved > actual
  }
}
```

### Alerts

| Condition | Threshold | Action |
|-----------|-----------|--------|
| Over-reserved (reserved > actual) | Any | **CRITICAL**: Investigate immediately |
| Negative stock | Any (when not allowed) | **CRITICAL**: Fix data corruption |
| High divergence | > 50% | **WARNING**: Many inactive carts |

### Divergence Percentage

**What it means**:
- 25% = 25% of total stock is reserved in carts
- 10% = Normal (healthy shopping activity)
- 50% = High (many abandoned carts, need cleanup)
- 80%+ = Critical (stock locked up, not available for new orders)

**Example**:
```
actualQty: 1000
reservedQty: 800
divergence: 80%

Problem: Only 200 items available for new customers even though 1000 physically in stock.

Solution: Run cart expiry cleanup immediately.
```

### Check for Anomalies

```bash
GET /api/v1/monitoring/stock-anomalies
```

**Response**:
```json
[
  {
    "itemCode": "ITEM-001",
    "warehouseCode": "WH-001",
    "actualQty": 50,
    "reservedQty": 75, // ← PROBLEM: Over-reserved
    "divergence": 150
  },
  {
    "itemCode": "ITEM-002",
    "warehouseCode": "WH-001",
    "actualQty": -10, // ← PROBLEM: Negative stock
    "reservedQty": 5
  }
]
```

**Action Required**: Investigate root cause and fix data.

## Best Practices

### For Developers

1. **Always use transactions** for cart operations:
   ```typescript
   await prisma.$transaction(async (tx) => {
     // All cart + reservation operations here
   });
   ```

2. **Always acquire locks** before stock checks:
   ```typescript
   await tx.$executeRaw`SELECT pg_advisory_xact_lock(...)`;
   ```

3. **Handle stock unavailability gracefully**:
   ```typescript
   try {
     await addToCart(productId, quantity);
   } catch (error) {
     if (error.message.includes('Insufficient stock')) {
       showToast('Sorry, only X items available');
     }
   }
   ```

4. **Implement optimistic locking** on frontend:
   ```typescript
   // Show available quantity to user
   const product = await fetchProduct(id);
   console.log(`${product.availableQty} available`);

   // But still handle failures
   try {
     await addToCart(id, quantity);
   } catch (error) {
     // Stock may have been reserved by other customers since we fetched
   }
   ```

### For Operations Teams

1. **Monitor divergence daily**:
   ```bash
   curl https://api.example.com/api/v1/monitoring/metrics | jq '.stockReservations.divergencePercentage'
   ```

2. **Manually trigger cleanup if needed**:
   ```sql
   -- Find carts that should have expired
   SELECT * FROM carts WHERE status = 'active' AND expires_at < NOW();

   -- Manually trigger cleanup
   UPDATE carts SET status = 'abandoned', abandoned_at = NOW()
   WHERE id IN (...);
   ```

3. **Investigate over-reserved items**:
   ```sql
   SELECT
     i.code,
     w.code as warehouse,
     wib.actual_qty,
     wib.reserved_qty,
     wib.reserved_qty - wib.actual_qty as over_reserved
   FROM warehouse_item_balances wib
   JOIN items i ON i.id = wib.item_id
   JOIN warehouses w ON w.id = wib.warehouse_id
   WHERE wib.reserved_qty > wib.actual_qty;
   ```

4. **Audit cart expiration worker**:
   ```bash
   # Check logs for cleanup runs
   grep "Cart cleanup complete" logs/app.log | tail -n 10

   # Expected: "Cart cleanup complete: X cleaned, 0 failed"
   ```

## Performance Considerations

### Advisory Lock Contention

**Problem**: High-traffic items may have lock contention

**Monitoring**:
```sql
-- Check lock wait times
SELECT
  query,
  wait_event,
  wait_event_type,
  state_change - query_start as duration
FROM pg_stat_activity
WHERE wait_event_type = 'Lock';
```

**Solution**:
- Use `SKIP LOCKED` for cart cleanup
- Increase worker frequency during peak times
- Consider sharding by warehouse

### Database Performance

**Query Optimization**:
```sql
-- Add composite index for common query
CREATE INDEX idx_cart_items_lookup
ON cart_items(tenant_id, cart_id, product_id);

-- Index for cleanup queries
CREATE INDEX idx_carts_expiry
ON carts(status, expires_at);
```

## FAQs

### Q: What happens if a customer's cart expires while they're checking out?

**A**: The checkout will fail with "insufficient stock" error. The customer must add items to cart again.

**Mitigation**: Set expiry to 7 days (plenty of time to complete checkout).

### Q: Can I manually release reservations for a cart?

**A**: Yes, delete the cart (it will trigger reservation release):
```sql
DELETE FROM cart_items WHERE cart_id = 'cart_123';
DELETE FROM carts WHERE id = 'cart_123';
```

### Q: Why is my `reservedQty` higher than `actualQty`?

**A**: This is a **CRITICAL ERROR** indicating:
1. Cart cleanup worker failed
2. Reservation release logic has a bug
3. Data corruption

**Action**: Investigate immediately and fix.

### Q: Can I disable stock reservations?

**A**: Not recommended. Disabling reservations leads to overselling.

If you must:
1. Set very short cart expiry (1 hour)
2. Monitor stock levels closely
3. Accept risk of overselling

### Q: How do I handle backorders (pre-orders)?

**A**: Set `tenant.allowNegativeStock = true`:
```typescript
// Stock goes negative
actualQty: -10
reservedQty: 0
available: -10 // Allowed when allowNegativeStock = true
```

### Q: What if cleanup worker fails?

**A**: Reservations remain until:
1. Worker succeeds on next run (5 minutes)
2. Manual cleanup (SQL or API)

**Monitoring**: Alert if pending cleanup > 100 carts.

## Support

For issues with stock reservations:

- **Urgent (overselling detected)**: Call +1-XXX-XXX-XXXX
- **General**: Email support@nosslag.com
- **Docs**: https://docs.nosslag.com/inventory/reservations
