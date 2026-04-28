-- C-2: Add explicit side-effect timestamp markers to Order so the Stripe
-- webhook handler can tell exactly which downstream effects of an event
-- actually completed. Previously paymentStatus=CAPTURED was used as a proxy
-- for "stock deducted, payment recorded, fulfillment done". That conflation
-- meant a crash between Order.update(CAPTURED) and processOrderFulfillment()
-- left stock un-deducted, and the next webhook delivery would treat the event
-- as already-handled and skip the handler.
--
-- Each column is nullable and stamped only after the corresponding side
-- effect has committed. isWebhookOutcomePersisted() reads these.

ALTER TABLE "orders"
  ADD COLUMN "paymentRecordedAt"  TIMESTAMP(3),
  ADD COLUMN "stockIssuedAt"      TIMESTAMP(3),
  ADD COLUMN "refundProcessedAt"  TIMESTAMP(3);

-- Backfill historical rows so the first deploy after this migration does not
-- re-run handlers for orders that completed under the old code.
--
-- 1. Any order already CAPTURED has paymentRecordedAt = confirmedAt
--    (the old code stamped confirmedAt at the same time it set CAPTURED).
UPDATE "orders"
   SET "paymentRecordedAt" = "confirmedAt"
 WHERE "paymentStatus" = 'CAPTURED'
   AND "confirmedAt" IS NOT NULL;

-- 2. Stock was issued for any CAPTURED order whose audit log shows a
--    stock movement with reference "Order <orderNumber>". This mirrors the
--    idempotency check in deductStockForOrder().
UPDATE "orders" o
   SET "stockIssuedAt" = COALESCE(o."confirmedAt", o."updatedAt")
  FROM "audit_logs" a
 WHERE a."tenantId" = o."tenantId"
   AND a."docType"  = 'StockMovement'
   AND a."action"   = 'STOCK_MOVEMENT_CREATED'
   AND a."meta"->>'reference' = ('Order ' || o."orderNumber")
   AND o."paymentStatus" = 'CAPTURED'
   AND o."stockIssuedAt" IS NULL;

-- 3. Refunds: any order in REFUNDED / PARTIALLY_REFUNDED gets refundProcessedAt
--    seeded from refundedAt (or updatedAt if refundedAt is null on partial).
UPDATE "orders"
   SET "refundProcessedAt" = COALESCE("refundedAt", "updatedAt")
 WHERE "paymentStatus" IN ('REFUNDED', 'PARTIALLY_REFUNDED');
