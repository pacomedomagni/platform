-- CreateEnum
CREATE TYPE "StockConsumptionStrategy" AS ENUM ('FIFO', 'FEFO');

-- AlterTable
ALTER TABLE "tenants"
ADD COLUMN     "allowNegativeStock" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "baseCurrency" TEXT NOT NULL DEFAULT 'USD',
ADD COLUMN     "stockConsumptionStrategy" "StockConsumptionStrategy" NOT NULL DEFAULT 'FIFO';

-- CreateTable
CREATE TABLE "currencies" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT,
    "decimals" INTEGER NOT NULL DEFAULT 2,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "currencies_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "exchange_rates" (
    "id" TEXT NOT NULL,
    "fromCode" TEXT NOT NULL,
    "toCode" TEXT NOT NULL,
    "rate" DECIMAL(18,9) NOT NULL,
    "rateDate" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exchange_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouses" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "defaultReceivingLocationId" TEXT,
    "defaultPickingLocationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "locations" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "parentId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT,
    "path" TEXT NOT NULL,
    "isPickable" BOOLEAN NOT NULL DEFAULT true,
    "isPutaway" BOOLEAN NOT NULL DEFAULT true,
    "isStaging" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "items" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isStockItem" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "hasBatch" BOOLEAN NOT NULL DEFAULT false,
    "hasSerial" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "batches" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "batchNo" TEXT NOT NULL,
    "mfgDate" DATE,
    "expDate" DATE,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouse_item_balances" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "actualQty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "reservedQty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warehouse_item_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bin_balances" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "batchId" TEXT,
    "actualQty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bin_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_fifo_layers" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "batchId" TEXT,
    "postingTs" TIMESTAMP(3) NOT NULL,
    "qtyRemaining" DECIMAL(18,6) NOT NULL,
    "incomingRate" DECIMAL(18,6) NOT NULL,
    "voucherType" TEXT NOT NULL,
    "voucherNo" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_fifo_layers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_ledger_entries" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "postingTs" TIMESTAMP(3) NOT NULL,
    "postingDate" DATE NOT NULL,
    "itemId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "fromLocationId" TEXT,
    "toLocationId" TEXT,
    "batchId" TEXT,
    "qty" DECIMAL(18,6) NOT NULL,
    "valuationRate" DECIMAL(18,6) NOT NULL,
    "stockValueDifference" DECIMAL(18,6) NOT NULL,
    "voucherType" TEXT NOT NULL,
    "voucherNo" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currency" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gl_entries" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "postingDate" DATE NOT NULL,
    "postingTs" TIMESTAMP(3) NOT NULL,
    "accountId" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "exchangeRate" DECIMAL(18,9) NOT NULL,
    "debitBc" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "creditBc" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "debitFc" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "creditFc" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "voucherType" TEXT NOT NULL,
    "voucherNo" TEXT NOT NULL,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gl_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "exchange_rates_fromCode_toCode_rateDate_key" ON "exchange_rates"("fromCode", "toCode", "rateDate");

-- CreateIndex
CREATE INDEX "exchange_rates_toCode_rateDate_idx" ON "exchange_rates"("toCode", "rateDate");

-- CreateIndex
CREATE UNIQUE INDEX "warehouses_tenantId_code_key" ON "warehouses"("tenantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "warehouses_tenantId_name_key" ON "warehouses"("tenantId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "locations_tenantId_warehouseId_code_key" ON "locations"("tenantId", "warehouseId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "locations_tenantId_warehouseId_path_key" ON "locations"("tenantId", "warehouseId", "path");

-- CreateIndex
CREATE INDEX "locations_warehouseId_idx" ON "locations"("warehouseId");

-- CreateIndex
CREATE UNIQUE INDEX "items_tenantId_code_key" ON "items"("tenantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "batches_tenantId_itemId_batchNo_key" ON "batches"("tenantId", "itemId", "batchNo");

-- CreateIndex
CREATE INDEX "batches_itemId_idx" ON "batches"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "warehouse_item_balances_tenantId_itemId_warehouseId_key" ON "warehouse_item_balances"("tenantId", "itemId", "warehouseId");

-- CreateIndex
CREATE INDEX "warehouse_item_balances_warehouseId_idx" ON "warehouse_item_balances"("warehouseId");

-- CreateIndex
CREATE UNIQUE INDEX "bin_balances_tenantId_itemId_warehouseId_locationId_batchId_key" ON "bin_balances"("tenantId", "itemId", "warehouseId", "locationId", "batchId");

-- CreateIndex
CREATE INDEX "bin_balances_locationId_idx" ON "bin_balances"("locationId");

-- CreateIndex
CREATE INDEX "stock_fifo_layers_tenantId_itemId_warehouseId_postingTs_idx" ON "stock_fifo_layers"("tenantId", "itemId", "warehouseId", "postingTs");

-- CreateIndex
CREATE INDEX "stock_fifo_layers_batchId_idx" ON "stock_fifo_layers"("batchId");

-- CreateIndex
CREATE INDEX "stock_ledger_entries_tenantId_postingDate_idx" ON "stock_ledger_entries"("tenantId", "postingDate");

-- CreateIndex
CREATE INDEX "stock_ledger_entries_tenantId_itemId_warehouseId_idx" ON "stock_ledger_entries"("tenantId", "itemId", "warehouseId");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_tenantId_code_key" ON "accounts"("tenantId", "code");

-- CreateIndex
CREATE INDEX "gl_entries_tenantId_postingDate_idx" ON "gl_entries"("tenantId", "postingDate");

-- CreateIndex
CREATE INDEX "gl_entries_tenantId_voucherType_voucherNo_idx" ON "gl_entries"("tenantId", "voucherType", "voucherNo");

-- AddForeignKey
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "locations" ADD CONSTRAINT "locations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "locations" ADD CONSTRAINT "locations_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "locations" ADD CONSTRAINT "locations_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items" ADD CONSTRAINT "items_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batches" ADD CONSTRAINT "batches_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batches" ADD CONSTRAINT "batches_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_item_balances" ADD CONSTRAINT "warehouse_item_balances_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_item_balances" ADD CONSTRAINT "warehouse_item_balances_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_item_balances" ADD CONSTRAINT "warehouse_item_balances_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bin_balances" ADD CONSTRAINT "bin_balances_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bin_balances" ADD CONSTRAINT "bin_balances_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bin_balances" ADD CONSTRAINT "bin_balances_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bin_balances" ADD CONSTRAINT "bin_balances_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bin_balances" ADD CONSTRAINT "bin_balances_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_fifo_layers" ADD CONSTRAINT "stock_fifo_layers_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_fifo_layers" ADD CONSTRAINT "stock_fifo_layers_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_fifo_layers" ADD CONSTRAINT "stock_fifo_layers_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_fifo_layers" ADD CONSTRAINT "stock_fifo_layers_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_fifo_layers" ADD CONSTRAINT "stock_fifo_layers_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_ledger_entries" ADD CONSTRAINT "stock_ledger_entries_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_ledger_entries" ADD CONSTRAINT "stock_ledger_entries_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_ledger_entries" ADD CONSTRAINT "stock_ledger_entries_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_ledger_entries" ADD CONSTRAINT "stock_ledger_entries_fromLocationId_fkey" FOREIGN KEY ("fromLocationId") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_ledger_entries" ADD CONSTRAINT "stock_ledger_entries_toLocationId_fkey" FOREIGN KEY ("toLocationId") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_ledger_entries" ADD CONSTRAINT "stock_ledger_entries_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gl_entries" ADD CONSTRAINT "gl_entries_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gl_entries" ADD CONSTRAINT "gl_entries_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS (tenant-scoped tables)
ALTER TABLE "warehouses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "warehouses" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_policy ON "warehouses"
  USING ("tenantId" = current_setting('app.tenant', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant', true));

ALTER TABLE "locations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "locations" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_policy ON "locations"
  USING ("tenantId" = current_setting('app.tenant', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant', true));

ALTER TABLE "items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "items" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_policy ON "items"
  USING ("tenantId" = current_setting('app.tenant', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant', true));

ALTER TABLE "batches" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "batches" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_policy ON "batches"
  USING ("tenantId" = current_setting('app.tenant', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant', true));

ALTER TABLE "warehouse_item_balances" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "warehouse_item_balances" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_policy ON "warehouse_item_balances"
  USING ("tenantId" = current_setting('app.tenant', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant', true));

ALTER TABLE "bin_balances" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "bin_balances" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_policy ON "bin_balances"
  USING ("tenantId" = current_setting('app.tenant', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant', true));

ALTER TABLE "stock_fifo_layers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "stock_fifo_layers" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_policy ON "stock_fifo_layers"
  USING ("tenantId" = current_setting('app.tenant', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant', true));

ALTER TABLE "stock_ledger_entries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "stock_ledger_entries" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_policy ON "stock_ledger_entries"
  USING ("tenantId" = current_setting('app.tenant', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant', true));

ALTER TABLE "accounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "accounts" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_policy ON "accounts"
  USING ("tenantId" = current_setting('app.tenant', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant', true));

ALTER TABLE "gl_entries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "gl_entries" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_policy ON "gl_entries"
  USING ("tenantId" = current_setting('app.tenant', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant', true));

