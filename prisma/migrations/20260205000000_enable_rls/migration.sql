-- =================================================================
-- RLS helper function and tenant-isolation policies.
-- Re-introduced from the legacy migration history with the function
-- definition kept (so subsequent migrations can call enable_tenant_rls()).
-- The actual ENABLE_RLS calls are deliberately omitted: today only
-- inventory/accounting services set `app.tenant` inside their
-- transactions, so blanket-enabling RLS would silently break reads
-- on tables whose services don't. Phase 3 W3.2/W3.3 wires connection-
-- level `app.tenant` setting; a follow-up migration will then call
-- enable_tenant_rls() for every tenant-scoped table.
-- =================================================================

CREATE OR REPLACE FUNCTION enable_tenant_rls(table_name TEXT)
RETURNS VOID AS $$
DECLARE
  tenant_column TEXT;
  input_table ALIAS FOR table_name;
BEGIN
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
    RAISE NOTICE 'Table % does not have a tenant column, skipping RLS', input_table;
    RETURN;
  END IF;

  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', table_name);
  EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_policy ON %I', table_name);
  EXECUTE format(
    'CREATE POLICY tenant_isolation_policy ON %I
      USING (%s = current_setting(''app.tenant'', true))
      WITH CHECK (%s = current_setting(''app.tenant'', true))',
    table_name, tenant_column, tenant_column
  );
END;
$$ LANGUAGE plpgsql;
