-- Add FIFO layer original qty and cancellation marker
ALTER TABLE "stock_fifo_layers"
  ADD COLUMN IF NOT EXISTS "qtyOriginal" DECIMAL(18, 6),
  ADD COLUMN IF NOT EXISTS "isCancelled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "sourceLayerId" TEXT NULL;

UPDATE "stock_fifo_layers"
SET "qtyOriginal" = COALESCE("qtyOriginal", "qtyRemaining")
WHERE "qtyOriginal" IS NULL;

ALTER TABLE "stock_fifo_layers"
  ALTER COLUMN "qtyOriginal" SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'stock_fifo_layers_sourceLayerId_fkey'
  ) THEN
    ALTER TABLE "stock_fifo_layers"
      ADD CONSTRAINT "stock_fifo_layers_sourceLayerId_fkey"
      FOREIGN KEY ("sourceLayerId")
      REFERENCES "stock_fifo_layers"("id")
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "stock_fifo_layers_sourceLayerId_idx"
  ON "stock_fifo_layers" ("sourceLayerId");

-- Add FIFO layer reference + voucher index to stock ledger
ALTER TABLE "stock_ledger_entries"
  ADD COLUMN IF NOT EXISTS "fifoLayerId" TEXT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'stock_ledger_entries_fifo_layer_id_fkey'
  ) THEN
    ALTER TABLE "stock_ledger_entries"
      ADD CONSTRAINT "stock_ledger_entries_fifo_layer_id_fkey"
      FOREIGN KEY ("fifoLayerId")
      REFERENCES "stock_fifo_layers"("id")
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "stock_ledger_entries_tenant_voucher_idx"
  ON "stock_ledger_entries" ("tenantId", "voucherType", "voucherNo");

-- Idempotency table for stock postings
CREATE TABLE IF NOT EXISTS "stock_postings" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "postingKey" TEXT NOT NULL,
  "voucherType" TEXT NOT NULL,
  "voucherNo" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "stock_postings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "stock_postings_tenant_posting_key_uq"
  ON "stock_postings" ("tenantId", "postingKey");

CREATE INDEX IF NOT EXISTS "stock_postings_tenant_voucher_idx"
  ON "stock_postings" ("tenantId", "voucherType", "voucherNo");

ALTER TABLE "stock_postings" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'stock_postings'
      AND policyname = 'tenant_isolation_stock_postings'
  ) THEN
    CREATE POLICY "tenant_isolation_stock_postings"
      ON "stock_postings"
      USING ("tenantId" = current_setting('app.tenant', true));
  END IF;
END $$;
