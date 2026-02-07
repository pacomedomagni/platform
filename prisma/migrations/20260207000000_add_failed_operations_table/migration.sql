-- CreateEnum
CREATE TYPE "OperationType" AS ENUM ('STOCK_DEDUCTION', 'COUPON_TRACKING', 'EMAIL_SEND', 'WEBHOOK_DELIVERY');

-- CreateEnum
CREATE TYPE "OperationStatus" AS ENUM ('PENDING', 'RETRYING', 'FAILED', 'SUCCEEDED');

-- CreateTable
CREATE TABLE "failed_operations" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "operationType" "OperationType" NOT NULL,
    "status" "OperationStatus" NOT NULL DEFAULT 'PENDING',
    "referenceId" TEXT NOT NULL,
    "referenceType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "errorMessage" TEXT,
    "errorStack" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "nextRetryAt" TIMESTAMP(3),
    "lastAttemptAt" TIMESTAMP(3),
    "succeededAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "failed_operations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "failed_operations_tenantId_status_idx" ON "failed_operations"("tenantId", "status");

-- CreateIndex
CREATE INDEX "failed_operations_nextRetryAt_idx" ON "failed_operations"("nextRetryAt");

-- CreateIndex
CREATE INDEX "failed_operations_referenceId_referenceType_idx" ON "failed_operations"("referenceId", "referenceType");

-- AddForeignKey
ALTER TABLE "failed_operations" ADD CONSTRAINT "failed_operations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Enable RLS on failed_operations
ALTER TABLE "failed_operations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "failed_operations" FORCE ROW LEVEL SECURITY;

-- Create tenant isolation policy
DROP POLICY IF EXISTS tenant_isolation_policy ON "failed_operations";
CREATE POLICY tenant_isolation_policy ON "failed_operations"
  USING ("tenantId" = current_setting('app.tenant', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant', true));
