-- Migration: Add multi-currency support
-- Phase 2: E-commerce Features - Multi-Currency

-- Currency configuration per store
CREATE TABLE IF NOT EXISTS "StoreCurrency" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "currencyCode" TEXT NOT NULL, -- ISO 4217 (USD, EUR, GBP, etc.)
    "symbol" TEXT NOT NULL, -- $, €, £, etc.
    "symbolPosition" TEXT NOT NULL DEFAULT 'before', -- before or after
    "decimalPlaces" INTEGER NOT NULL DEFAULT 2,
    "decimalSeparator" TEXT NOT NULL DEFAULT '.',
    "thousandsSeparator" TEXT NOT NULL DEFAULT ',',
    "exchangeRate" DECIMAL(18, 8) NOT NULL DEFAULT 1, -- Rate relative to base currency
    "isBaseCurrency" BOOLEAN NOT NULL DEFAULT false,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "lastRateUpdate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StoreCurrency_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "StoreCurrency_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE,
    CONSTRAINT "StoreCurrency_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE
);

-- Ensure only one base currency per store
CREATE UNIQUE INDEX IF NOT EXISTS "StoreCurrency_storeId_isBaseCurrency_key" 
ON "StoreCurrency" ("storeId") WHERE "isBaseCurrency" = true;

-- Currency code unique per store
CREATE UNIQUE INDEX IF NOT EXISTS "StoreCurrency_storeId_currencyCode_key" 
ON "StoreCurrency" ("storeId", "currencyCode");

-- Index for tenant
CREATE INDEX IF NOT EXISTS "StoreCurrency_tenantId_idx" ON "StoreCurrency" ("tenantId");

-- Product price overrides per currency
CREATE TABLE IF NOT EXISTS "ProductPriceOverride" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "productListingId" TEXT NOT NULL,
    "currencyCode" TEXT NOT NULL,
    "price" DECIMAL(18, 4) NOT NULL,
    "compareAtPrice" DECIMAL(18, 4),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProductPriceOverride_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ProductPriceOverride_productListingId_fkey" FOREIGN KEY ("productListingId") REFERENCES "ProductListing"("id") ON DELETE CASCADE,
    CONSTRAINT "ProductPriceOverride_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE
);

-- Unique price override per product/currency combo
CREATE UNIQUE INDEX IF NOT EXISTS "ProductPriceOverride_productListingId_currencyCode_key" 
ON "ProductPriceOverride" ("productListingId", "currencyCode");

-- Index for tenant
CREATE INDEX IF NOT EXISTS "ProductPriceOverride_tenantId_idx" ON "ProductPriceOverride" ("tenantId");

-- Variant price overrides per currency
CREATE TABLE IF NOT EXISTS "VariantPriceOverride" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "currencyCode" TEXT NOT NULL,
    "price" DECIMAL(18, 4) NOT NULL,
    "compareAtPrice" DECIMAL(18, 4),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VariantPriceOverride_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "VariantPriceOverride_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE,
    CONSTRAINT "VariantPriceOverride_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE
);

-- Unique override per variant/currency combo
CREATE UNIQUE INDEX IF NOT EXISTS "VariantPriceOverride_variantId_currencyCode_key" 
ON "VariantPriceOverride" ("variantId", "currencyCode");

-- Index for tenant
CREATE INDEX IF NOT EXISTS "VariantPriceOverride_tenantId_idx" ON "VariantPriceOverride" ("tenantId");

-- Add currency tracking to orders
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "currencyCode" TEXT DEFAULT 'USD';
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "exchangeRateUsed" DECIMAL(18, 8) DEFAULT 1;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "baseCurrencyTotal" DECIMAL(18, 4); -- Original total in base currency

-- Add currency to cart
ALTER TABLE "Cart" ADD COLUMN IF NOT EXISTS "currencyCode" TEXT DEFAULT 'USD';

-- Enable RLS on new tables
ALTER TABLE "StoreCurrency" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProductPriceOverride" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "VariantPriceOverride" ENABLE ROW LEVEL SECURITY;

-- Add common currency data for easy setup
-- This is a helper function stores can call to set up default currencies
CREATE OR REPLACE FUNCTION setup_store_currencies(p_store_id TEXT, p_tenant_id TEXT, p_base_currency TEXT DEFAULT 'USD')
RETURNS void AS $$
DECLARE
    v_currencies jsonb := '[
        {"code": "USD", "symbol": "$", "position": "before", "decimals": 2},
        {"code": "EUR", "symbol": "€", "position": "before", "decimals": 2},
        {"code": "GBP", "symbol": "£", "position": "before", "decimals": 2},
        {"code": "CAD", "symbol": "CA$", "position": "before", "decimals": 2},
        {"code": "AUD", "symbol": "A$", "position": "before", "decimals": 2},
        {"code": "JPY", "symbol": "¥", "position": "before", "decimals": 0},
        {"code": "CHF", "symbol": "CHF", "position": "after", "decimals": 2},
        {"code": "CNY", "symbol": "¥", "position": "before", "decimals": 2},
        {"code": "INR", "symbol": "₹", "position": "before", "decimals": 2},
        {"code": "MXN", "symbol": "MX$", "position": "before", "decimals": 2},
        {"code": "BRL", "symbol": "R$", "position": "before", "decimals": 2},
        {"code": "KRW", "symbol": "₩", "position": "before", "decimals": 0}
    ]'::jsonb;
    v_currency jsonb;
BEGIN
    FOR v_currency IN SELECT * FROM jsonb_array_elements(v_currencies)
    LOOP
        INSERT INTO "StoreCurrency" (
            "id", "tenantId", "storeId", "currencyCode", "symbol", 
            "symbolPosition", "decimalPlaces", "isBaseCurrency", "isEnabled"
        ) VALUES (
            gen_random_uuid()::text,
            p_tenant_id,
            p_store_id,
            v_currency->>'code',
            v_currency->>'symbol',
            v_currency->>'position',
            (v_currency->>'decimals')::int,
            (v_currency->>'code' = p_base_currency),
            (v_currency->>'code' = p_base_currency) -- Only enable base by default
        )
        ON CONFLICT ("storeId", "currencyCode") DO NOTHING;
    END LOOP;
END;
$$ LANGUAGE plpgsql;
