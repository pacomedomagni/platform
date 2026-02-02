-- CreateTable
CREATE TABLE "doc_perms" (
    "id" TEXT NOT NULL,
    "docTypeName" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT true,
    "write" BOOLEAN NOT NULL DEFAULT false,
    "create" BOOLEAN NOT NULL DEFAULT false,
    "delete" BOOLEAN NOT NULL DEFAULT false,
    "submit" BOOLEAN NOT NULL DEFAULT false,
    "cancel" BOOLEAN NOT NULL DEFAULT false,
    "amend" BOOLEAN NOT NULL DEFAULT false,
    "report" BOOLEAN NOT NULL DEFAULT false,
    "idx" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "doc_perms_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "doc_perms_docTypeName_idx" ON "doc_perms"("docTypeName");

-- CreateIndex
CREATE INDEX "doc_perms_role_idx" ON "doc_perms"("role");

-- AddForeignKey
ALTER TABLE "doc_perms" ADD CONSTRAINT "doc_perms_docTypeName_fkey" FOREIGN KEY ("docTypeName") REFERENCES "doc_types"("name") ON DELETE CASCADE ON UPDATE CASCADE;
