-- CreateTable
CREATE TABLE "shipping_costs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "carrierCost" DECIMAL(18,4) NOT NULL,
    "customerPaid" DECIMAL(18,4) NOT NULL,
    "profit" DECIMAL(18,4) NOT NULL,
    "markupPercent" DECIMAL(5,2) NOT NULL,
    "carrier" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "apiCost" DECIMAL(10,4) NOT NULL DEFAULT 0.05,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shipping_costs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "shipments" ADD COLUMN "easypostShipmentId" TEXT,
ADD COLUMN "easypostTrackerId" TEXT,
ADD COLUMN "easypostRateId" TEXT,
ADD COLUMN "carrierAccount" TEXT,
ADD COLUMN "carrierCost" DECIMAL(18,4),
ADD COLUMN "customerCost" DECIMAL(18,4),
ADD COLUMN "platformProfit" DECIMAL(18,4),
ADD COLUMN "addressVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "verificationResult" JSONB,
ADD COLUMN "insuranceAmount" DECIMAL(18,2),
ADD COLUMN "insuranceCost" DECIMAL(18,4);

-- CreateIndex
CREATE INDEX "shipping_costs_tenantId_idx" ON "shipping_costs"("tenantId");

-- CreateIndex
CREATE INDEX "shipping_costs_orderId_idx" ON "shipping_costs"("orderId");

-- CreateIndex
CREATE INDEX "shipping_costs_createdAt_idx" ON "shipping_costs"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "platform_settings_key_key" ON "platform_settings"("key");

-- CreateIndex
CREATE UNIQUE INDEX "shipments_easypostShipmentId_key" ON "shipments"("easypostShipmentId");

-- AddForeignKey
ALTER TABLE "shipping_costs" ADD CONSTRAINT "shipping_costs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipping_costs" ADD CONSTRAINT "shipping_costs_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipping_costs" ADD CONSTRAINT "shipping_costs_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Insert default platform settings
INSERT INTO "platform_settings" ("id", "key", "value", "description", "updatedAt")
VALUES
    (gen_random_uuid(), 'shipping_markup_percent', '5.0', 'Default shipping markup percentage for all tenants', CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'easypost_webhook_secret', '', 'EasyPost webhook verification secret', CURRENT_TIMESTAMP);
