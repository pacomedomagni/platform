-- Add STOCK_RETURN to OperationType enum
ALTER TYPE "OperationType" ADD VALUE IF NOT EXISTS 'STOCK_RETURN';

-- Migrate NULL batchId in BinBalance to sentinel value '__NO_BATCH__'
-- This fixes the PostgreSQL NULL != NULL issue in the compound unique index
UPDATE "BinBalance"
SET "batchId" = '__NO_BATCH__'
WHERE "batchId" IS NULL;

-- Update the unique index to work correctly with the sentinel value
-- (The existing unique constraint already covers this since '__NO_BATCH__' is a real value)
