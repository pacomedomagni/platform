-- =================================================================
-- Row-level security policies for marketplace integration tables.
--
-- This migration **defines** the policies but does NOT enable RLS.
-- Enablement is gated on a separate follow-up migration that flips
-- the switch once `app.tenant` is being set on every Prisma query
-- (today only inventory/accounting do this per-transaction; the
-- marketplace services issue queries without setting it, so blanket-
-- enabling now would silently return zero rows on every read).
--
-- The policies are written here so that:
--   1. Code review can vet the rule shape before the cutover.
--   2. The follow-up migration only needs `ALTER TABLE ... ENABLE
--      ROW LEVEL SECURITY` calls, no policy changes.
--   3. We have a single artifact documenting which marketplace
--      tables are tenant-isolated at the database layer.
--
-- The enable_tenant_rls() function (defined in 20260205000000_enable_rls)
-- is intentionally NOT called here. Re-create the policies idempotently
-- via DROP POLICY IF EXISTS / CREATE POLICY so the follow-up migration
-- can simply ALTER TABLE ... ENABLE ROW LEVEL SECURITY.
-- =================================================================

-- Helper repeated locally (the 20260205 helper enables RLS too; we
-- don't want that side-effect here, so we inline the policy shape).
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
BEGIN
  FOREACH tbl IN ARRAY marketplace_tables
  LOOP
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = tbl
    ) INTO has_table;

    IF NOT has_table THEN
      RAISE NOTICE 'Table % does not exist; skipping policy creation', tbl;
      CONTINUE;
    END IF;

    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_policy ON %I', tbl);
    EXECUTE format(
      'CREATE POLICY tenant_isolation_policy ON %I
        USING ("tenantId" = current_setting(''app.tenant'', true))
        WITH CHECK ("tenantId" = current_setting(''app.tenant'', true))',
      tbl
    );
  END LOOP;
END
$$;

-- Reminder for the follow-up migration that enables enforcement:
--
--   ALTER TABLE marketplace_connections    ENABLE ROW LEVEL SECURITY;
--   ALTER TABLE marketplace_connections    FORCE  ROW LEVEL SECURITY;
--   ALTER TABLE marketplace_listings       ENABLE ROW LEVEL SECURITY;
--   ALTER TABLE marketplace_listings       FORCE  ROW LEVEL SECURITY;
--   ALTER TABLE marketplace_orders         ENABLE ROW LEVEL SECURITY;
--   ALTER TABLE marketplace_orders         FORCE  ROW LEVEL SECURITY;
--   ALTER TABLE marketplace_returns        ENABLE ROW LEVEL SECURITY;
--   ALTER TABLE marketplace_returns        FORCE  ROW LEVEL SECURITY;
--   ALTER TABLE marketplace_message_threads ENABLE ROW LEVEL SECURITY;
--   ALTER TABLE marketplace_message_threads FORCE  ROW LEVEL SECURITY;
--   ALTER TABLE marketplace_messages       ENABLE ROW LEVEL SECURITY;
--   ALTER TABLE marketplace_messages       FORCE  ROW LEVEL SECURITY;
--   ALTER TABLE marketplace_campaigns      ENABLE ROW LEVEL SECURITY;
--   ALTER TABLE marketplace_campaigns      FORCE  ROW LEVEL SECURITY;
--   ALTER TABLE marketplace_violations     ENABLE ROW LEVEL SECURITY;
--   ALTER TABLE marketplace_violations     FORCE  ROW LEVEL SECURITY;
--   ALTER TABLE marketplace_sync_logs      ENABLE ROW LEVEL SECURITY;
--   ALTER TABLE marketplace_sync_logs      FORCE  ROW LEVEL SECURITY;
--
-- Prerequisite checklist for that follow-up:
--   [ ] PrismaService applies $extends or per-transaction
--       `SELECT set_config('app.tenant', ${tenantId}, true)` for every
--       query that reads/writes a tenant-scoped table.
--   [ ] All scheduled jobs (order/return/message sync, webhook handlers,
--       account-deletion processor) explicitly set app.tenant when
--       acting on a tenant's behalf, or wrap in `bypassTenantGuard()`.
--   [ ] Integration test runs against a real Postgres with RLS enabled
--       to catch any code path that forgets to set app.tenant.
