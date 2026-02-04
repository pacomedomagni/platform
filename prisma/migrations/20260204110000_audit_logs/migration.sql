CREATE TABLE "audit_logs" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "userId" TEXT,
  "action" TEXT NOT NULL,
  "docType" TEXT NOT NULL,
  "docName" TEXT NOT NULL,
  "meta" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "audit_logs_tenantId_docType_idx" ON "audit_logs"("tenantId", "docType");
CREATE INDEX "audit_logs_docName_idx" ON "audit_logs"("docName");

ALTER TABLE "audit_logs"
ADD CONSTRAINT "audit_logs_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
