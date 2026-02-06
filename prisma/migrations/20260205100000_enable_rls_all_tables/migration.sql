-- =================================================================
-- Enable Row Level Security on ALL tenant-scoped tables
-- This migration ensures complete tenant isolation at the database level
-- =================================================================

-- Function to enable RLS on a table with tenant isolation
-- This is idempotent - safe to run multiple times
CREATE OR REPLACE FUNCTION enable_tenant_rls(table_name TEXT)
RETURNS VOID AS $$
BEGIN
  -- Enable RLS
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', table_name);
  
  -- Drop existing policy if exists (to make migration idempotent)
  EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_policy ON %I', table_name);
  
  -- Create tenant isolation policy
  -- Uses current_setting('app.tenant', true) which returns NULL if not set
  EXECUTE format(
    'CREATE POLICY tenant_isolation_policy ON %I
      USING ("tenantId" = current_setting(''app.tenant'', true))
      WITH CHECK ("tenantId" = current_setting(''app.tenant'', true))',
    table_name
  );
  
  RAISE NOTICE 'Enabled RLS on table: %', table_name;
END;
$$ LANGUAGE plpgsql;

-- =================================================================
-- Enable RLS on all tenant-scoped tables
-- Note: "users" already has RLS from previous migration
-- =================================================================

-- Core inventory tables
SELECT enable_tenant_rls('warehouses');
SELECT enable_tenant_rls('locations');
SELECT enable_tenant_rls('items');
SELECT enable_tenant_rls('item_uoms');
SELECT enable_tenant_rls('serials');
SELECT enable_tenant_rls('batches');
SELECT enable_tenant_rls('warehouse_item_balances');
SELECT enable_tenant_rls('bin_balances');
SELECT enable_tenant_rls('stock_fifo_layers');
SELECT enable_tenant_rls('stock_postings');
SELECT enable_tenant_rls('stock_ledger_entries');
SELECT enable_tenant_rls('stock_ledger_entry_serials');

-- Accounting tables
SELECT enable_tenant_rls('accounts');
SELECT enable_tenant_rls('gl_entries');

-- Party masters
SELECT enable_tenant_rls('customers');
SELECT enable_tenant_rls('suppliers');
SELECT enable_tenant_rls('addresses');
SELECT enable_tenant_rls('contacts');
SELECT enable_tenant_rls('contact_links');

-- Banking tables
SELECT enable_tenant_rls('banks');
SELECT enable_tenant_rls('bank_accounts');
SELECT enable_tenant_rls('bank_transactions');
SELECT enable_tenant_rls('bank_reconciliations');
SELECT enable_tenant_rls('bank_reconciliation_details');
SELECT enable_tenant_rls('bank_matching_rules');

-- Storefront tables
SELECT enable_tenant_rls('product_categories');
SELECT enable_tenant_rls('product_listings');
SELECT enable_tenant_rls('store_customers');
SELECT enable_tenant_rls('store_addresses');
SELECT enable_tenant_rls('password_resets');
SELECT enable_tenant_rls('carts');
SELECT enable_tenant_rls('cart_items');
SELECT enable_tenant_rls('orders');
SELECT enable_tenant_rls('order_items');
SELECT enable_tenant_rls('payments');
SELECT enable_tenant_rls('coupons');

-- Audit logs
SELECT enable_tenant_rls('audit_logs');

-- =================================================================
-- Create bypass role for system/background jobs
-- This allows migrations and system tasks to operate across tenants
-- =================================================================

-- Create a role that bypasses RLS (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'platform_system') THEN
    CREATE ROLE platform_system;
  END IF;
END $$;

-- Grant bypass permission to system role
ALTER ROLE platform_system BYPASSRLS;

-- =================================================================
-- Verify RLS is enabled on all tables
-- =================================================================

DO $$
DECLARE
  table_record RECORD;
  rls_count INT := 0;
BEGIN
  FOR table_record IN 
    SELECT schemaname, tablename 
    FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename NOT IN ('_prisma_migrations', 'tenants', 'currencies', 'exchange_rates', 'doc_types', 'doc_fields', 'doc_perms', 'uoms')
  LOOP
    IF EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = table_record.schemaname
      AND c.relname = table_record.tablename
      AND c.relrowsecurity = true
    ) THEN
      rls_count := rls_count + 1;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'RLS enabled on % tables', rls_count;
END $$;

-- Clean up the helper function
DROP FUNCTION IF EXISTS enable_tenant_rls(TEXT);
