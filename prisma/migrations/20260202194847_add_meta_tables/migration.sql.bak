-- CreateTable
CREATE TABLE "doc_types" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "isSingle" BOOLEAN NOT NULL DEFAULT false,
    "isChild" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "tableName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "doc_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doc_fields" (
    "id" TEXT NOT NULL,
    "docTypeName" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "unique" BOOLEAN NOT NULL DEFAULT false,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "readonly" BOOLEAN NOT NULL DEFAULT false,
    "options" TEXT,
    "target" TEXT,
    "idx" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "doc_fields_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "doc_types_name_key" ON "doc_types"("name");

-- CreateIndex
CREATE INDEX "doc_fields_docTypeName_idx" ON "doc_fields"("docTypeName");

-- AddForeignKey
ALTER TABLE "doc_fields" ADD CONSTRAINT "doc_fields_docTypeName_fkey" FOREIGN KEY ("docTypeName") REFERENCES "doc_types"("name") ON DELETE CASCADE ON UPDATE CASCADE;
