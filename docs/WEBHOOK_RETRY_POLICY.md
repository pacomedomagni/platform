# Webhook Retry Policy

NoSlag implements a robust retry mechanism for critical operations that fail after payment capture. This ensures data consistency even when temporary failures occur.

## Overview

When critical operations fail after payment is captured (e.g., stock deduction, coupon tracking), the system automatically retries them instead of leaving the data in an inconsistent state.

## Failed Operations Table

All failed critical operations are tracked in the `failed_operations` table:

```sql
Table: failed_operations
├── id (UUID)
├── tenantId (TEXT)
├── operationType (ENUM: STOCK_DEDUCTION, COUPON_TRACKING, EMAIL_SEND, WEBHOOK_DELIVERY)
├── status (ENUM: PENDING, RETRYING, FAILED, SUCCEEDED)
├── referenceId (TEXT) -- e.g., orderId
├── referenceType (TEXT) -- e.g., 'order'
├── payload (JSONB) -- operation-specific data
├── errorMessage (TEXT)
├── errorStack (TEXT)
├── attemptCount (INT) -- starts at 0
├── maxAttempts (INT) -- default: 3
├── nextRetryAt (TIMESTAMP) -- when to retry next
├── lastAttemptAt (TIMESTAMP)
├── succeededAt (TIMESTAMP)
├── failedAt (TIMESTAMP)
└── createdAt, updatedAt
```

## Retry Schedule (Exponential Backoff)

Operations are retried with **exponential backoff**:

| Attempt | Wait Time | Cumulative Time |
|---------|-----------|-----------------|
| 1st retry | 5 minutes | 5 min |
| 2nd retry | 15 minutes | 20 min |
| 3rd retry | 1 hour | 1h 20min |
| 4th retry | 4 hours | 5h 20min |
| 5th retry | 12 hours | 17h 20min |

**Default max attempts**: 3 (configurable per operation type)

After max attempts, the operation status changes to `FAILED` and requires **manual intervention**.

## Supported Operation Types

### 1. STOCK_DEDUCTION

**When**: Payment captured but stock deduction failed

**Payload**:
```json
{
  "orderId": "order_123",
  "orderNumber": "ORD-2024-001",
  "items": [
    {
      "itemCode": "ITEM-001",
      "quantity": 2,
      "rate": 99.99
    }
  ],
  "warehouseId": "warehouse_id" // optional, determined during retry
}
```

**Retry Logic**:
1. Find default active warehouse
2. Create stock movement (ISSUE type)
3. Release stock reservations
4. Mark as SUCCEEDED

**Monitoring**:
```bash
# Check pending stock deductions
curl https://api.example.com/api/v1/monitoring/failed-operations?operationType=STOCK_DEDUCTION

# Example response:
[
  {
    "id": "failed_op_123",
    "operationType": "STOCK_DEDUCTION",
    "status": "PENDING",
    "attemptCount": 1,
    "nextRetryAt": "2024-02-07T10:15:00Z",
    "referenceId": "order_123",
    "errorMessage": "Warehouse temporarily unavailable"
  }
]
```

### 2. COUPON_TRACKING

**When**: Payment captured but coupon usage tracking failed

**Payload**:
```json
{
  "orderId": "order_123",
  "orderNumber": "ORD-2024-001",
  "couponId": "coupon_456",
  "customerId": "customer_789" // optional for guest checkouts
}
```

**Retry Logic**:
1. Atomically increment `coupon.timesUsed`
2. Create `CouponUsage` record
3. Mark as SUCCEEDED

**Critical Scenario**:
If a customer used a limited coupon (e.g., `usageLimit: 100`) and tracking fails:
- Without retry: Coupon appears to have 99 uses when it actually has 100
- With retry: Tracking eventually succeeds, count is accurate

### 3. EMAIL_SEND

**When**: Payment captured but order confirmation email failed

**Payload**:
```json
{
  "orderId": "order_123",
  "email": "customer@example.com",
  "template": "order-confirmation",
  "context": {
    "orderNumber": "ORD-2024-001",
    "total": 199.99
  }
}
```

**Retry Logic**:
1. Fetch order details
2. Send email via EmailService
3. Mark as SUCCEEDED

**Note**: Email failures are **non-critical** and have lower priority.

### 4. WEBHOOK_DELIVERY

**When**: Outgoing webhook to merchant's system failed

**Payload**:
```json
{
  "webhookUrl": "https://merchant.com/webhook",
  "event": "order.created",
  "data": {
    "orderId": "order_123",
    "orderNumber": "ORD-2024-001"
  }
}
```

**Retry Logic**:
1. POST to webhook URL with original payload
2. Expect 2xx response
3. Mark as SUCCEEDED

**Timeout**: 30 seconds per attempt

## Retry Worker (Cron Job)

The retry worker runs **every 5 minutes**:

```typescript
@Cron(CronExpression.EVERY_5_MINUTES)
async retryFailedOperations() {
  // 1. Find operations ready for retry
  const operations = await prisma.failedOperation.findMany({
    where: {
      status: { in: ['PENDING', 'RETRYING'] },
      nextRetryAt: { lte: new Date() },
      attemptCount: { lt: maxAttempts },
    },
    take: 50, // Process 50 operations per run
    orderBy: { nextRetryAt: 'asc' },
  });

  // 2. Retry each operation
  for (const operation of operations) {
    await executeOperation(operation);
  }
}
```

**Processing Capacity**: 50 operations per 5-minute window = **600 operations/hour**

If you have more than 600 failed operations per hour, **contact support**.

## Monitoring & Alerts

### Metrics Endpoint

```bash
GET /api/v1/monitoring/metrics
```

**Response**:
```json
{
  "failedOperations": {
    "pending": 5,
    "retrying": 2,
    "failed": 1,      // Permanently failed (needs manual intervention)
    "succeeded": 123,
    "retryRate": 3.5, // Percentage of operations that needed retry
    "permanentFailureRate": 0.8 // Percentage that failed permanently
  }
}
```

### Alerts

**Critical Alerts** (requires immediate action):

| Condition | Threshold | Action Required |
|-----------|-----------|-----------------|
| Permanent failure rate | > 10% | Investigate root cause |
| Pending operations | > 100 | Check worker health |
| Single operation | > 5 retries | Manual intervention |

**Warning Alerts** (should be investigated):

| Condition | Threshold | Action |
|-----------|-----------|--------|
| Retry rate | > 5% | Check system health |
| Pending operations | > 50 | Monitor closely |

### Query Failed Operations

```bash
# Get all permanently failed operations
curl https://api.example.com/api/v1/monitoring/failed-operations?status=FAILED

# Get pending retries for a specific order
curl https://api.example.com/api/v1/monitoring/failed-operations?referenceId=order_123
```

## Manual Intervention

When an operation reaches `maxAttempts` and status becomes `FAILED`:

### 1. Investigate the Root Cause

```bash
# Get operation details
curl https://api.example.com/api/v1/monitoring/failed-operations/{operationId}

# Example response:
{
  "id": "failed_op_123",
  "operationType": "STOCK_DEDUCTION",
  "status": "FAILED",
  "attemptCount": 3,
  "errorMessage": "Warehouse WH-001 not found",
  "errorStack": "...",
  "payload": {
    "orderId": "order_123",
    "items": [...]
  }
}
```

### 2. Fix the Underlying Issue

**Example**: Missing warehouse
```bash
# Create the missing warehouse
curl -X POST https://api.example.com/api/v1/warehouses \
  -H "Content-Type: application/json" \
  -d '{"code": "WH-001", "name": "Main Warehouse"}'
```

### 3. Manually Retry or Complete

**Option A**: Update to PENDING and let worker retry
```sql
UPDATE failed_operations
SET
  status = 'PENDING',
  attempt_count = 0,
  next_retry_at = NOW(),
  error_message = NULL
WHERE id = 'failed_op_123';
```

**Option B**: Manually execute the operation
```bash
# Manually create stock movement
curl -X POST https://api.example.com/api/v1/inventory-management/stock-movements \
  -H "Content-Type: application/json" \
  -d '{
    "movementType": "ISSUE",
    "warehouseCode": "WH-001",
    "items": [{"itemCode": "ITEM-001", "quantity": 2, "rate": 99.99}],
    "reference": "Order ORD-2024-001 (Manual Fix)"
  }'

# Then mark operation as SUCCEEDED
UPDATE failed_operations
SET
  status = 'SUCCEEDED',
  succeeded_at = NOW()
WHERE id = 'failed_op_123';
```

## Best Practices

### For Developers

1. **Always wrap critical operations in try-catch**:
   ```typescript
   try {
     await deductStock(order);
   } catch (error) {
     await failedOperationsService.recordFailedOperation({
       tenantId,
       operationType: 'STOCK_DEDUCTION',
       referenceId: order.id,
       payload: { orderId, items },
       errorMessage: error.message,
     });
   }
   ```

2. **Make operations idempotent**:
   ```typescript
   // ✅ Good: Idempotent
   await prisma.coupon.update({
     where: { id },
     data: { timesUsed: { increment: 1 } },
   });

   // ❌ Bad: Not idempotent (retry would increment twice)
   const current = await prisma.coupon.findUnique({ where: { id } });
   await prisma.coupon.update({
     where: { id },
     data: { timesUsed: current.timesUsed + 1 },
   });
   ```

3. **Log retry attempts**:
   ```typescript
   logger.log(`Retrying stock deduction for order ${orderId} (attempt ${attemptCount + 1})`);
   ```

### For Operations Teams

1. **Monitor the dashboard daily**:
   ```bash
   curl https://api.example.com/api/v1/monitoring/health
   ```

2. **Set up alerts**:
   - Slack/PagerDuty when `permanentFailureRate > 10%`
   - Email when `pending > 100`

3. **Review failed operations weekly**:
   - Identify patterns (same error repeatedly)
   - Fix root causes (missing data, configuration issues)

4. **Clean up old succeeded operations**:
   The cleanup worker automatically deletes succeeded operations older than 7 days.

## Cleanup Policy

Automatically cleaned up:

| Status | Retention | Cleanup Frequency |
|--------|-----------|-------------------|
| SUCCEEDED | 7 days | Daily at 1 AM |
| FAILED | 30 days | Weekly |
| PENDING | Never (until resolved) | N/A |

**Manual cleanup**:
```sql
-- Delete very old failed operations (after manual verification)
DELETE FROM failed_operations
WHERE status = 'FAILED' AND created_at < NOW() - INTERVAL '90 days';
```

## FAQs

### Q: What happens if the retry worker itself fails?

**A**: Operations remain in `PENDING` status. The next successful worker run will pick them up. Worker failures are logged and monitored.

### Q: Can I customize the retry schedule?

**A**: Not currently via UI. Contact support for custom retry schedules on specific operation types.

### Q: Will retrying stock deduction cause duplicate stock movements?

**A**: No. The stock movement service uses idempotency keys (posting markers) to prevent duplicates.

### Q: What if a payment succeeds but the order record is missing?

**A**: The system logs a critical error. You must manually create the order record or refund the payment.

### Q: Can I manually trigger a retry immediately?

**A**: Yes, update `next_retry_at` to `NOW()`:
```sql
UPDATE failed_operations SET next_retry_at = NOW() WHERE id = 'failed_op_123';
```

### Q: How do I prevent operations from failing in the first place?

**A**:
1. Ensure database connection pool is adequately sized
2. Monitor warehouse and item data integrity
3. Set up proper error handling and logging
4. Test failure scenarios in staging

## Support

If you encounter issues with failed operations:

- **Urgent (payment captured, stock not deducted)**: Call +1-XXX-XXX-XXXX
- **Non-urgent**: Email support@nosslag.com
- **Docs**: https://docs.nosslag.com/webhooks/retry-policy
