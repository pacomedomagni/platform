-- =================================================================
-- Phase 2 W2.7 — inventory correctness primitives
--
-- 1. voucher_sequences table + next_voucher_seq() function
--    Replaces the find-max-then-retry loop in stock-movement.service which
--    can produce duplicate voucher numbers under concurrent load. The
--    function atomically reserves the next sequence per
--    (tenantId, voucherType, year, month) tuple.
--
-- 2. Running-balance helper for stock_ledger_entries (used by
--    getItemMovements rewrite) — no schema change required, just
--    documenting that the new code uses SUM(qty) OVER (...) rather
--    than client-side `total - newer` math.
-- =================================================================

CREATE TABLE IF NOT EXISTS voucher_sequences (
  "tenantId"    UUID NOT NULL,
  "voucherType" TEXT NOT NULL,
  "yearMonth"   TEXT NOT NULL,
  "lastSeq"     INT  NOT NULL DEFAULT 0,
  "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("tenantId", "voucherType", "yearMonth")
);

-- Atomic claim of the next sequence number. Uses INSERT ... ON CONFLICT
-- with UPDATE so a single SQL statement reserves the value, eliminating
-- the read-modify-write race.
CREATE OR REPLACE FUNCTION next_voucher_seq(
  p_tenant_id UUID,
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
  'Phase 2 W2.7: atomic per-(tenant, voucherType, yearMonth) sequence. '
  'Replaces the racey findFirst+1 retry loop in stock-movement.service.';
