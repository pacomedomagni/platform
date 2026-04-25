-- =================================================================
-- voucher_sequences: align with TEXT-based tenant id schema
--
-- Phase 2 W2.7 originally created voucher_sequences with tenantId UUID
-- (matching the legacy schema). After the init migration was rebuilt
-- from schema.prisma, every other tenant-scoped table holds tenantId
-- as TEXT. The leftover UUID column forced ::uuid casts at every call
-- site and made cross-table joins impossible without coercion.
--
-- This migration:
--   1. Recreates next_voucher_seq() with a TEXT signature.
--   2. ALTERs voucher_sequences.tenantId to TEXT in place (USING cast
--      preserves any rows that already exist).
-- =================================================================

ALTER TABLE voucher_sequences
  ALTER COLUMN "tenantId" TYPE TEXT USING "tenantId"::text;

DROP FUNCTION IF EXISTS next_voucher_seq(UUID, TEXT, TEXT);

CREATE OR REPLACE FUNCTION next_voucher_seq(
  p_tenant_id TEXT,
  p_voucher_type TEXT,
  p_year_month TEXT
)
RETURNS INT AS $$
DECLARE
  v_seq INT;
BEGIN
  INSERT INTO voucher_sequences ("tenantId", "voucherType", "yearMonth", "lastSeq", "updatedAt")
  VALUES (p_tenant_id, p_voucher_type, p_year_month, 1, NOW())
  ON CONFLICT ("tenantId", "voucherType", "yearMonth")
  DO UPDATE SET "lastSeq" = voucher_sequences."lastSeq" + 1,
                "updatedAt" = NOW()
  RETURNING "lastSeq" INTO v_seq;

  RETURN v_seq;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION next_voucher_seq IS
  'Atomic per-(tenant, voucherType, yearMonth) sequence. '
  'Replaces the racey findFirst+1 retry loop in stock-movement.service.';
