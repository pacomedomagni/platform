-- =================================================================
-- Enable row-level security on marketplace integration tables.
--
-- Prerequisite: PrismaService now applies a `$extends` query interceptor
-- (libs/db/src/lib/tenant-rls-extension.ts) that wraps every tenant-
-- scoped query in a $transaction and issues
--     SELECT set_config('app.tenant', <tenantId>, true)
-- on the same connection before running the query. Cross-tenant ops
-- (scheduled syncs, webhook handlers, OAuth callback, account-deletion
-- handler) are wrapped in `bypassTenantGuard()` or `runWithTenant()` so
-- they too set the right session variable.
--
-- The policies themselves were created by 20260427010000_marketplace_rls_prep.
-- This migration only flips the ENABLE / FORCE switches, so the rules now
-- start filtering rows.
--
-- The DO block tolerates a missing table (CONTINUE on absence) so the
-- migration is safe to apply against partially-migrated environments.
-- =================================================================

DO $$
DECLARE
  tbl TEXT;
  marketplace_tables TEXT[] := ARRAY[
    'marketplace_connections',
    'marketplace_listings',
    'marketplace_orders',
    'marketplace_returns',
    'marketplace_message_threads',
    'marketplace_messages',
    'marketplace_campaigns',
    'marketplace_violations',
    'marketplace_sync_logs'
  ];
  has_table BOOLEAN;
  has_policy BOOLEAN;
BEGIN
  FOREACH tbl IN ARRAY marketplace_tables
  LOOP
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = tbl
    ) INTO has_table;

    IF NOT has_table THEN
      RAISE NOTICE 'Table % does not exist; skipping RLS enable', tbl;
      CONTINUE;
    END IF;

    -- Defensive: re-create the policy if 20260427010000 was skipped or
    -- run in an environment where the table didn't exist yet. Idempotent.
    SELECT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = tbl
        AND policyname = 'tenant_isolation_policy'
    ) INTO has_policy;

    IF NOT has_policy THEN
      EXECUTE format(
        'CREATE POLICY tenant_isolation_policy ON %I
          USING ("tenantId" = current_setting(''app.tenant'', true))
          WITH CHECK ("tenantId" = current_setting(''app.tenant'', true))',
        tbl
      );
    END IF;

    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('ALTER TABLE %I FORCE  ROW LEVEL SECURITY', tbl);

    RAISE NOTICE 'RLS enabled on %', tbl;
  END LOOP;
END
$$;
