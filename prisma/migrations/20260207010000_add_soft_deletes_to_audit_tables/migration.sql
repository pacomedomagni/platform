-- Add soft delete support to audit-critical tables
-- These tables need historical preservation for compliance and audit purposes

-- Warehouses
ALTER TABLE "warehouses" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "warehouses_deletedAt_idx" ON "warehouses"("deletedAt");

-- Locations (storage bins)
ALTER TABLE "locations" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "locations_deletedAt_idx" ON "locations"("deletedAt");

-- Items (products)
ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "items_deletedAt_idx" ON "items"("deletedAt");

-- Bank Accounts
ALTER TABLE "bank_accounts" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "bank_accounts_deletedAt_idx" ON "bank_accounts"("deletedAt");

-- Suppliers
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "suppliers_deletedAt_idx" ON "suppliers"("deletedAt");

-- Customers
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "customers_deletedAt_idx" ON "customers"("deletedAt");

-- Accounts (Chart of Accounts)
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "accounts_deletedAt_idx" ON "accounts"("deletedAt");

-- Note: Stock ledger entries and GL entries should NEVER be deleted (hard or soft)
-- They are immutable audit logs and must be preserved indefinitely
