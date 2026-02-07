-- Migration: Add internationalization (i18n) support
-- Phase 2: E-commerce Features - Multi-Language

-- Store language configuration
CREATE TABLE IF NOT EXISTS "StoreLanguage" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "languageCode" TEXT NOT NULL, -- ISO 639-1 (en, es, fr, de, etc.)
    "countryCode" TEXT, -- ISO 3166-1 alpha-2 for regional variants (US, GB, MX)
    "name" TEXT NOT NULL, -- "English", "Español", etc.
    "nativeName" TEXT, -- "English", "Español", etc.
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StoreLanguage_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "StoreLanguage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE
);

-- Ensure only one default language per tenant
CREATE UNIQUE INDEX IF NOT EXISTS "StoreLanguage_tenantId_isDefault_key" 
ON "StoreLanguage" ("tenantId") WHERE "isDefault" = true;

-- Language code unique per tenant
CREATE UNIQUE INDEX IF NOT EXISTS "StoreLanguage_tenantId_languageCode_countryCode_key" 
ON "StoreLanguage" ("tenantId", "languageCode", COALESCE("countryCode", ''));

CREATE INDEX IF NOT EXISTS "StoreLanguage_tenantId_idx" ON "StoreLanguage" ("tenantId");

-- Product translations
CREATE TABLE IF NOT EXISTS "ProductTranslation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "productListingId" TEXT NOT NULL,
    "languageCode" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "shortDescription" TEXT,
    "longDescription" TEXT,
    "metaTitle" TEXT,
    "metaDescription" TEXT,
    "slug" TEXT, -- Localized URL slug
    "badge" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProductTranslation_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ProductTranslation_productListingId_fkey" FOREIGN KEY ("productListingId") REFERENCES "ProductListing"("id") ON DELETE CASCADE,
    CONSTRAINT "ProductTranslation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProductTranslation_productListingId_languageCode_key" 
ON "ProductTranslation" ("productListingId", "languageCode");

CREATE INDEX IF NOT EXISTS "ProductTranslation_tenantId_idx" ON "ProductTranslation" ("tenantId");
CREATE INDEX IF NOT EXISTS "ProductTranslation_tenantId_languageCode_slug_idx" 
ON "ProductTranslation" ("tenantId", "languageCode", "slug");

-- Category translations
CREATE TABLE IF NOT EXISTS "CategoryTranslation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "languageCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "slug" TEXT,
    "metaTitle" TEXT,
    "metaDescription" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CategoryTranslation_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CategoryTranslation_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ProductCategory"("id") ON DELETE CASCADE,
    CONSTRAINT "CategoryTranslation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "CategoryTranslation_categoryId_languageCode_key" 
ON "CategoryTranslation" ("categoryId", "languageCode");

CREATE INDEX IF NOT EXISTS "CategoryTranslation_tenantId_idx" ON "CategoryTranslation" ("tenantId");

-- Attribute translations (for product variants)
CREATE TABLE IF NOT EXISTS "AttributeTranslation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "attributeTypeId" TEXT, -- For attribute type names (Size, Color)
    "attributeValueId" TEXT, -- For attribute value names (Small, Blue)
    "languageCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AttributeTranslation_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AttributeTranslation_attributeTypeId_fkey" FOREIGN KEY ("attributeTypeId") REFERENCES "ItemAttributeType"("id") ON DELETE CASCADE,
    CONSTRAINT "AttributeTranslation_attributeValueId_fkey" FOREIGN KEY ("attributeValueId") REFERENCES "ItemAttributeValue"("id") ON DELETE CASCADE,
    CONSTRAINT "AttributeTranslation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE,
    -- Ensure exactly one of type or value is set
    CONSTRAINT "AttributeTranslation_check" CHECK (
        ("attributeTypeId" IS NOT NULL AND "attributeValueId" IS NULL) OR
        ("attributeTypeId" IS NULL AND "attributeValueId" IS NOT NULL)
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS "AttributeTranslation_typeId_languageCode_key" 
ON "AttributeTranslation" ("attributeTypeId", "languageCode") WHERE "attributeTypeId" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "AttributeTranslation_valueId_languageCode_key" 
ON "AttributeTranslation" ("attributeValueId", "languageCode") WHERE "attributeValueId" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "AttributeTranslation_tenantId_idx" ON "AttributeTranslation" ("tenantId");

-- Shipping rate translations
CREATE TABLE IF NOT EXISTS "ShippingRateTranslation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "shippingRateId" TEXT NOT NULL,
    "languageCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShippingRateTranslation_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ShippingRateTranslation_shippingRateId_fkey" FOREIGN KEY ("shippingRateId") REFERENCES "ShippingRate"("id") ON DELETE CASCADE,
    CONSTRAINT "ShippingRateTranslation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "ShippingRateTranslation_rateId_languageCode_key" 
ON "ShippingRateTranslation" ("shippingRateId", "languageCode");

CREATE INDEX IF NOT EXISTS "ShippingRateTranslation_tenantId_idx" ON "ShippingRateTranslation" ("tenantId");

-- Static content translations (UI strings, policies, etc.)
CREATE TABLE IF NOT EXISTS "ContentTranslation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "contentKey" TEXT NOT NULL, -- e.g., "checkout.shipping.title", "policy.returns"
    "languageCode" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "contentType" TEXT NOT NULL DEFAULT 'text', -- text, html, markdown
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ContentTranslation_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ContentTranslation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "ContentTranslation_tenantId_key_languageCode_key" 
ON "ContentTranslation" ("tenantId", "contentKey", "languageCode");

CREATE INDEX IF NOT EXISTS "ContentTranslation_tenantId_languageCode_idx" 
ON "ContentTranslation" ("tenantId", "languageCode");

-- Enable RLS on all i18n tables
ALTER TABLE "StoreLanguage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProductTranslation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CategoryTranslation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AttributeTranslation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ShippingRateTranslation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ContentTranslation" ENABLE ROW LEVEL SECURITY;

-- Helper function to set up common languages
CREATE OR REPLACE FUNCTION setup_store_languages(p_tenant_id TEXT, p_default_language TEXT DEFAULT 'en')
RETURNS void AS $$
DECLARE
    v_languages jsonb := '[
        {"code": "en", "name": "English", "nativeName": "English"},
        {"code": "es", "name": "Spanish", "nativeName": "Español"},
        {"code": "fr", "name": "French", "nativeName": "Français"},
        {"code": "de", "name": "German", "nativeName": "Deutsch"},
        {"code": "it", "name": "Italian", "nativeName": "Italiano"},
        {"code": "pt", "name": "Portuguese", "nativeName": "Português"},
        {"code": "nl", "name": "Dutch", "nativeName": "Nederlands"},
        {"code": "ja", "name": "Japanese", "nativeName": "日本語"},
        {"code": "zh", "name": "Chinese", "nativeName": "中文"},
        {"code": "ko", "name": "Korean", "nativeName": "한국어"},
        {"code": "ar", "name": "Arabic", "nativeName": "العربية"},
        {"code": "hi", "name": "Hindi", "nativeName": "हिन्दी"}
    ]'::jsonb;
    v_lang jsonb;
    v_sort_order int := 0;
BEGIN
    FOR v_lang IN SELECT * FROM jsonb_array_elements(v_languages)
    LOOP
        INSERT INTO "StoreLanguage" (
            "id", "tenantId", "languageCode", "name", "nativeName",
            "isDefault", "isEnabled", "sortOrder"
        ) VALUES (
            gen_random_uuid()::text,
            p_tenant_id,
            v_lang->>'code',
            v_lang->>'name',
            v_lang->>'nativeName',
            (v_lang->>'code' = p_default_language),
            (v_lang->>'code' = p_default_language), -- Only enable default by default
            v_sort_order
        )
        ON CONFLICT ("tenantId", "languageCode", COALESCE("countryCode", '')) DO NOTHING;
        v_sort_order := v_sort_order + 1;
    END LOOP;
END;
$$ LANGUAGE plpgsql;
