-- Migration: Add shipping carriers integration
-- Phase 2: E-commerce Features - Shipping

-- Shipping carriers configuration
CREATE TABLE IF NOT EXISTS "ShippingCarrier" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "name" TEXT NOT NULL, -- UPS, FedEx, USPS, DHL, etc.
    "code" TEXT NOT NULL, -- Identifier for the carrier (ups, fedex, usps, dhl)
    "type" TEXT NOT NULL DEFAULT 'api', -- api, flat, weight, custom
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "apiKey" TEXT, -- Encrypted carrier API key
    "apiSecret" TEXT, -- Encrypted carrier API secret
    "accountNumber" TEXT, -- Carrier account number
    "testMode" BOOLEAN NOT NULL DEFAULT true,
    "settings" JSONB DEFAULT '{}', -- Carrier-specific settings
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShippingCarrier_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ShippingCarrier_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE,
    CONSTRAINT "ShippingCarrier_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE
);

-- Carrier code unique per store
CREATE UNIQUE INDEX IF NOT EXISTS "ShippingCarrier_storeId_code_key" 
ON "ShippingCarrier" ("storeId", "code");

-- Index for tenant
CREATE INDEX IF NOT EXISTS "ShippingCarrier_tenantId_idx" ON "ShippingCarrier" ("tenantId");

-- Shipping zones (geographic groupings)
CREATE TABLE IF NOT EXISTS "ShippingZone" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "countries" TEXT[] DEFAULT '{}', -- ISO country codes
    "states" TEXT[] DEFAULT '{}', -- State/province codes
    "zipCodes" TEXT[] DEFAULT '{}', -- Zip/postal codes or patterns (90210, 90*)
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShippingZone_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ShippingZone_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE,
    CONSTRAINT "ShippingZone_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE
);

-- Only one default zone per store
CREATE UNIQUE INDEX IF NOT EXISTS "ShippingZone_storeId_isDefault_key" 
ON "ShippingZone" ("storeId") WHERE "isDefault" = true;

-- Index for tenant
CREATE INDEX IF NOT EXISTS "ShippingZone_tenantId_idx" ON "ShippingZone" ("tenantId");

-- Shipping rates (methods available per zone)
CREATE TABLE IF NOT EXISTS "ShippingRate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,
    "carrierId" TEXT, -- Optional: link to specific carrier
    "name" TEXT NOT NULL, -- "Standard Shipping", "Express", etc.
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'flat', -- flat, weight, price, carrier
    "price" DECIMAL(18, 4) NOT NULL DEFAULT 0,
    "minOrderAmount" DECIMAL(18, 4), -- Minimum order for this rate
    "maxOrderAmount" DECIMAL(18, 4), -- Maximum order for this rate
    "minWeight" DECIMAL(18, 4), -- Minimum weight in kg
    "maxWeight" DECIMAL(18, 4), -- Maximum weight in kg
    "freeShippingThreshold" DECIMAL(18, 4), -- Order amount for free shipping
    "estimatedDaysMin" INTEGER, -- Minimum delivery days
    "estimatedDaysMax" INTEGER, -- Maximum delivery days
    "carrierServiceCode" TEXT, -- Carrier-specific service code (ups_ground, fedex_2day)
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShippingRate_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ShippingRate_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "ShippingZone"("id") ON DELETE CASCADE,
    CONSTRAINT "ShippingRate_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "ShippingCarrier"("id") ON DELETE SET NULL,
    CONSTRAINT "ShippingRate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE
);

-- Index for tenant
CREATE INDEX IF NOT EXISTS "ShippingRate_tenantId_idx" ON "ShippingRate" ("tenantId");
CREATE INDEX IF NOT EXISTS "ShippingRate_zoneId_idx" ON "ShippingRate" ("zoneId");

-- Weight-based pricing tiers (for weight-based shipping)
CREATE TABLE IF NOT EXISTS "ShippingWeightTier" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "rateId" TEXT NOT NULL,
    "minWeight" DECIMAL(18, 4) NOT NULL DEFAULT 0,
    "maxWeight" DECIMAL(18, 4),
    "price" DECIMAL(18, 4) NOT NULL,
    "pricePerKg" DECIMAL(18, 4), -- Additional price per kg over minWeight
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShippingWeightTier_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ShippingWeightTier_rateId_fkey" FOREIGN KEY ("rateId") REFERENCES "ShippingRate"("id") ON DELETE CASCADE,
    CONSTRAINT "ShippingWeightTier_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE
);

-- Index for tenant
CREATE INDEX IF NOT EXISTS "ShippingWeightTier_tenantId_idx" ON "ShippingWeightTier" ("tenantId");

-- Shipments tracking
CREATE TABLE IF NOT EXISTS "Shipment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "carrierId" TEXT,
    "carrierName" TEXT NOT NULL,
    "trackingNumber" TEXT,
    "trackingUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending', -- pending, label_created, in_transit, delivered, failed
    "labelUrl" TEXT, -- Link to shipping label PDF
    "estimatedDelivery" TIMESTAMP(3),
    "actualDelivery" TIMESTAMP(3),
    "shippedAt" TIMESTAMP(3),
    "weight" DECIMAL(18, 4),
    "dimensions" JSONB, -- {length, width, height, unit}
    "cost" DECIMAL(18, 4), -- Actual shipping cost
    "metadata" JSONB DEFAULT '{}', -- Carrier-specific data
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Shipment_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Shipment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE,
    CONSTRAINT "Shipment_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "ShippingCarrier"("id") ON DELETE SET NULL,
    CONSTRAINT "Shipment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE
);

-- Index for tracking
CREATE INDEX IF NOT EXISTS "Shipment_orderId_idx" ON "Shipment" ("orderId");
CREATE INDEX IF NOT EXISTS "Shipment_trackingNumber_idx" ON "Shipment" ("trackingNumber");
CREATE INDEX IF NOT EXISTS "Shipment_tenantId_idx" ON "Shipment" ("tenantId");

-- Shipment tracking events
CREATE TABLE IF NOT EXISTS "ShipmentEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "rawData" JSONB, -- Original carrier data
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShipmentEvent_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ShipmentEvent_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE,
    CONSTRAINT "ShipmentEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE
);

-- Index for shipment events
CREATE INDEX IF NOT EXISTS "ShipmentEvent_shipmentId_idx" ON "ShipmentEvent" ("shipmentId");
CREATE INDEX IF NOT EXISTS "ShipmentEvent_tenantId_idx" ON "ShipmentEvent" ("tenantId");

-- Add shipping fields to Order
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "shippingMethod" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "shippingCarrier" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "shippingRateId" TEXT;

-- Add weight to items and products
ALTER TABLE "Item" ADD COLUMN IF NOT EXISTS "weight" DECIMAL(18, 4);
ALTER TABLE "Item" ADD COLUMN IF NOT EXISTS "weightUnit" TEXT DEFAULT 'kg';
ALTER TABLE "ProductVariant" ADD COLUMN IF NOT EXISTS "weight" DECIMAL(18, 4);
ALTER TABLE "ProductVariant" ADD COLUMN IF NOT EXISTS "weightUnit" TEXT DEFAULT 'kg';

-- Enable RLS on new tables
ALTER TABLE "ShippingCarrier" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ShippingZone" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ShippingRate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ShippingWeightTier" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Shipment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ShipmentEvent" ENABLE ROW LEVEL SECURITY;
