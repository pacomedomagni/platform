-- =================================================================
-- M3: replace the misleading "marketplace_orders_orderId_key" unique
-- constraint with a partial unique index that only applies when the
-- column is non-null.
--
-- Why: orderId is nullable (MarketplaceOrder rows can exist before the
-- internal Order has been created, or stay null if mapping fails). A
-- plain UNIQUE constraint on a nullable column technically permits
-- multiple NULL rows in Postgres, so the schema reads as "unique" but
-- the runtime behavior is permissive. That created two bugs:
--   1. Developer mental-model drift — Prisma surfaces @unique as a
--      hard guarantee in its TypeScript types.
--   2. No actual enforcement that two MarketplaceOrder rows in the
--      same tenant cannot ever both reference the same internal Order
--      (was relying on application code to check).
--
-- The partial unique index makes the intent explicit: when orderId is
-- non-null it must be unique; multiple null orderIds remain allowed.
-- =================================================================

DROP INDEX IF EXISTS "marketplace_orders_orderId_key";

CREATE UNIQUE INDEX "marketplace_orders_orderId_key"
    ON "marketplace_orders"("orderId")
    WHERE "orderId" IS NOT NULL;
