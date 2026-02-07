-- UOM master
CREATE TABLE IF NOT EXISTS "uoms" (
  "code" TEXT PRIMARY KEY,
  "name" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

-- Item UOM conversions
CREATE TABLE IF NOT EXISTS "item_uoms" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "itemId" TEXT NOT NULL REFERENCES "items"("id") ON DELETE CASCADE,
  "uomCode" TEXT NOT NULL REFERENCES "uoms"("code") ON DELETE CASCADE,
  "conversionFactor" DECIMAL(18,6) NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "item_uoms_tenant_item_uom_uq"
  ON "item_uoms" ("tenantId", "itemId", "uomCode");

CREATE INDEX IF NOT EXISTS "item_uoms_item_idx"
  ON "item_uoms" ("itemId");

-- Add UOM references to items
ALTER TABLE "items"
  ADD COLUMN IF NOT EXISTS "stockUomCode" TEXT,
  ADD COLUMN IF NOT EXISTS "purchaseUomCode" TEXT,
  ADD COLUMN IF NOT EXISTS "salesUomCode" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'items_stockUomCode_fkey'
  ) THEN
    ALTER TABLE "items"
      ADD CONSTRAINT "items_stockUomCode_fkey"
      FOREIGN KEY ("stockUomCode") REFERENCES "uoms"("code") ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'items_purchaseUomCode_fkey'
  ) THEN
    ALTER TABLE "items"
      ADD CONSTRAINT "items_purchaseUomCode_fkey"
      FOREIGN KEY ("purchaseUomCode") REFERENCES "uoms"("code") ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'items_salesUomCode_fkey'
  ) THEN
    ALTER TABLE "items"
      ADD CONSTRAINT "items_salesUomCode_fkey"
      FOREIGN KEY ("salesUomCode") REFERENCES "uoms"("code") ON DELETE SET NULL;
  END IF;
END $$;

-- Serials
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SerialStatus') THEN
    CREATE TYPE "SerialStatus" AS ENUM ('AVAILABLE', 'ISSUED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "serials" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "itemId" TEXT NOT NULL REFERENCES "items"("id") ON DELETE CASCADE,
  "serialNo" TEXT NOT NULL,
  "status" "SerialStatus" NOT NULL DEFAULT 'AVAILABLE',
  "warehouseId" TEXT REFERENCES "warehouses"("id") ON DELETE SET NULL,
  "locationId" TEXT REFERENCES "locations"("id") ON DELETE SET NULL,
  "batchId" TEXT REFERENCES "batches"("id") ON DELETE SET NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "serials_tenant_serial_uq"
  ON "serials" ("tenantId", "serialNo");

CREATE INDEX IF NOT EXISTS "serials_item_idx"
  ON "serials" ("itemId");

CREATE INDEX IF NOT EXISTS "serials_warehouse_idx"
  ON "serials" ("warehouseId");

-- Ledger to serial join
CREATE TABLE IF NOT EXISTS "stock_ledger_entry_serials" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "ledgerEntryId" TEXT NOT NULL REFERENCES "stock_ledger_entries"("id") ON DELETE CASCADE,
  "serialId" TEXT NOT NULL REFERENCES "serials"("id") ON DELETE CASCADE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "stock_ledger_entry_serials_entry_idx"
  ON "stock_ledger_entry_serials" ("ledgerEntryId");

CREATE INDEX IF NOT EXISTS "stock_ledger_entry_serials_serial_idx"
  ON "stock_ledger_entry_serials" ("serialId");

-- RLS policies
ALTER TABLE "item_uoms" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "serials" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "stock_ledger_entry_serials" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'item_uoms' AND policyname = 'tenant_isolation_item_uoms'
  ) THEN
    CREATE POLICY "tenant_isolation_item_uoms"
      ON "item_uoms"
      USING ("tenantId" = current_setting('app.tenant', true));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'serials' AND policyname = 'tenant_isolation_serials'
  ) THEN
    CREATE POLICY "tenant_isolation_serials"
      ON "serials"
      USING ("tenantId" = current_setting('app.tenant', true));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'stock_ledger_entry_serials' AND policyname = 'tenant_isolation_stock_ledger_entry_serials'
  ) THEN
    CREATE POLICY "tenant_isolation_stock_ledger_entry_serials"
      ON "stock_ledger_entry_serials"
      USING ("tenantId" = current_setting('app.tenant', true));
  END IF;
END $$;
