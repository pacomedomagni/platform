ALTER TABLE "accounts"
ADD COLUMN "rootType" TEXT,
ADD COLUMN "accountType" TEXT,
ADD COLUMN "isGroup" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "parentAccountCode" TEXT;
