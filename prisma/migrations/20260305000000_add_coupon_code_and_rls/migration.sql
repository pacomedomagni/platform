-- =================================================================
-- 1. Add couponCode column to orders table
-- =================================================================
ALTER TABLE "orders" ADD COLUMN "couponCode" TEXT;

-- =================================================================
-- 2. Enable RLS on all tenant-scoped tables that were missed
-- =================================================================

-- Re-create the helper function (was dropped in prior migration)
CREATE OR REPLACE FUNCTION enable_tenant_rls(table_name TEXT)
RETURNS VOID AS $$
DECLARE
  tenant_column TEXT;
  input_table ALIAS FOR table_name;
BEGIN
  -- Detect which tenant column naming convention is used
  IF EXISTS (
    SELECT 1 FROM information_schema.columns c
    WHERE c.table_schema = 'public'
    AND c.table_name = input_table
    AND c.column_name = 'tenantId'
  ) THEN
    tenant_column := '"tenantId"';
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns c
    WHERE c.table_schema = 'public'
    AND c.table_name = input_table
    AND c.column_name = 'tenant_id'
  ) THEN
    tenant_column := 'tenant_id';
  ELSE
    RAISE NOTICE 'Table % has no tenant column — skipping RLS', input_table;
    RETURN;
  END IF;

  -- Enable RLS on the table
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', input_table);

  -- Create tenant isolation policy (idempotent: drop first if exists)
  EXECUTE format(
    'DROP POLICY IF EXISTS tenant_isolation ON %I',
    input_table
  );
  EXECUTE format(
    'CREATE POLICY tenant_isolation ON %I USING (%s = current_setting(''app.tenant_id'', true))',
    input_table, tenant_column
  );

  RAISE NOTICE 'RLS enabled on table: %', input_table;
END;
$$ LANGUAGE plpgsql;

-- Auth & token tables
SELECT enable_tenant_rls('refresh_tokens');
SELECT enable_tenant_rls('email_verification_tokens');
SELECT enable_tenant_rls('merchant_email_verification_tokens');

-- Background processing
SELECT enable_tenant_rls('background_jobs');
SELECT enable_tenant_rls('notifications');

-- Webhooks
SELECT enable_tenant_rls('webhooks');
SELECT enable_tenant_rls('webhook_deliveries');
SELECT enable_tenant_rls('processed_webhook_events');

-- Storefront pages & themes
SELECT enable_tenant_rls('store_pages');
SELECT enable_tenant_rls('store_themes');

-- Coupons
SELECT enable_tenant_rls('coupon_usages');

-- Product variants & attributes
SELECT enable_tenant_rls('product_variants');
SELECT enable_tenant_rls('product_variant_attributes');
SELECT enable_tenant_rls('item_attribute_types');
SELECT enable_tenant_rls('item_attribute_values');

-- Reviews
SELECT enable_tenant_rls('product_reviews');
SELECT enable_tenant_rls('review_votes');

-- Gift cards
SELECT enable_tenant_rls('gift_cards');
SELECT enable_tenant_rls('gift_card_transactions');

-- Wishlists
SELECT enable_tenant_rls('wishlists');
SELECT enable_tenant_rls('wishlist_items');

-- Multi-currency
SELECT enable_tenant_rls('store_currencies');
SELECT enable_tenant_rls('product_price_overrides');
SELECT enable_tenant_rls('variant_price_overrides');

-- Shipping
SELECT enable_tenant_rls('shipping_carriers');
SELECT enable_tenant_rls('shipping_zones');
SELECT enable_tenant_rls('shipping_rates');
SELECT enable_tenant_rls('shipping_weight_tiers');
SELECT enable_tenant_rls('shipments');
SELECT enable_tenant_rls('shipment_events');

-- i18n / translations
SELECT enable_tenant_rls('store_languages');
SELECT enable_tenant_rls('product_translations');
SELECT enable_tenant_rls('category_translations');
SELECT enable_tenant_rls('attribute_translations');
SELECT enable_tenant_rls('shipping_rate_translations');
SELECT enable_tenant_rls('content_translations');

-- Customer preferences
SELECT enable_tenant_rls('store_customer_preferences');

-- Email
SELECT enable_tenant_rls('email_bounces');

-- Marketplace
SELECT enable_tenant_rls('marketplace_connections');
SELECT enable_tenant_rls('marketplace_listings');
SELECT enable_tenant_rls('marketplace_active_listings');
SELECT enable_tenant_rls('marketplace_orders');
SELECT enable_tenant_rls('marketplace_sync_logs');

-- Product imports
SELECT enable_tenant_rls('product_import_jobs');

-- OAuth
SELECT enable_tenant_rls('oauth_states');

-- Failed operations
SELECT enable_tenant_rls('failed_operations');

-- Clean up the helper function
DROP FUNCTION IF EXISTS enable_tenant_rls(TEXT);
