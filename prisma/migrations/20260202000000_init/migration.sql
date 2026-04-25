-- =================================================================
-- Consolidated init migration.
--
-- The pre-existing migration history was internally inconsistent:
-- some migrations used PascalCase table names against the schema's
-- snake_case @@map; some used UUID column types against TEXT FK
-- references; ~40 tables declared in the schema were never CREATEd
-- in any migration. The platform was kept running via `prisma db push`,
-- which silently bypassed the broken history.
--
-- This migration replaces the broken history with a single
-- prisma-generated init that exactly matches the schema. The legacy
-- migrations have been moved aside; subsequent migrations (Phase 1 W1.2
-- tenant scoping, Phase 2 W2.7 voucher_sequences, Phase 3 W3.5
-- MARKETPLACE_SYNC enum) are layered on top from 20260424000000+.
--
-- For environments that already recorded the old migration filenames
-- in `_prisma_migrations`, run `prisma migrate resolve` for those
-- entries before applying this baseline.
-- =================================================================

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "StockConsumptionStrategy" AS ENUM ('FIFO', 'FEFO');

-- CreateEnum
CREATE TYPE "SerialStatus" AS ENUM ('AVAILABLE', 'ISSUED');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'AUTHORIZED', 'CAPTURED', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED');

-- CreateEnum
CREATE TYPE "OperationType" AS ENUM ('STOCK_DEDUCTION', 'STOCK_RETURN', 'COUPON_TRACKING', 'EMAIL_SEND', 'WEBHOOK_DELIVERY', 'MARKETPLACE_SYNC');

-- CreateEnum
CREATE TYPE "OperationStatus" AS ENUM ('PENDING', 'RETRYING', 'FAILED', 'SUCCEEDED');

-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "businessName" TEXT,
    "email" TEXT,
    "domain" TEXT,
    "customDomain" TEXT,
    "customDomainStatus" TEXT NOT NULL DEFAULT 'not_set',
    "customDomainVerifiedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "baseCurrency" TEXT NOT NULL DEFAULT 'USD',
    "stockConsumptionStrategy" "StockConsumptionStrategy" NOT NULL DEFAULT 'FIFO',
    "allowNegativeStock" BOOLEAN NOT NULL DEFAULT false,
    "nextOrderNumber" INTEGER NOT NULL DEFAULT 1,
    "defaultTaxRate" DECIMAL(8,6) NOT NULL DEFAULT 0.0825,
    "defaultShippingRate" DECIMAL(18,2) NOT NULL DEFAULT 9.99,
    "freeShippingThreshold" DECIMAL(18,2) NOT NULL DEFAULT 100.00,
    "paymentProvider" TEXT,
    "paymentProviderStatus" TEXT NOT NULL DEFAULT 'pending',
    "stripeConnectAccountId" TEXT,
    "stripeChargesEnabled" BOOLEAN NOT NULL DEFAULT false,
    "stripePayoutsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "stripeDetailsSubmitted" BOOLEAN NOT NULL DEFAULT false,
    "squareMerchantId" TEXT,
    "squareLocationId" TEXT,
    "squareAccessToken" TEXT,
    "squareRefreshToken" TEXT,
    "squareAccessTokenExpiry" TIMESTAMP(3),
    "platformFeePercent" DECIMAL(5,2) NOT NULL DEFAULT 2.9,
    "platformFeeFixed" DECIMAL(18,2) NOT NULL DEFAULT 0.30,
    "onboardingStep" TEXT,
    "onboardingCompletedAt" TIMESTAMP(3),
    "storePublished" BOOLEAN NOT NULL DEFAULT false,
    "storePublishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL DEFAULT '',
    "firstName" TEXT,
    "lastName" TEXT,
    "tenantId" TEXT NOT NULL,
    "roles" TEXT[] DEFAULT ARRAY['user']::TEXT[],
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "emailVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "currencies" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT,
    "decimals" INTEGER NOT NULL DEFAULT 2,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "currencies_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "exchange_rates" (
    "id" TEXT NOT NULL,
    "fromCode" TEXT NOT NULL,
    "toCode" TEXT NOT NULL,
    "rate" DECIMAL(18,9) NOT NULL,
    "rateDate" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exchange_rates_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "warehouses" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "defaultReceivingLocationId" TEXT,
    "defaultPickingLocationId" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "locations" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "parentId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT,
    "path" TEXT NOT NULL,
    "isPickable" BOOLEAN NOT NULL DEFAULT true,
    "isPutaway" BOOLEAN NOT NULL DEFAULT true,
    "isStaging" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "items" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isStockItem" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "hasBatch" BOOLEAN NOT NULL DEFAULT false,
    "hasSerial" BOOLEAN NOT NULL DEFAULT false,
    "reorderLevel" DECIMAL(18,6),
    "reorderQty" DECIMAL(18,6),
    "incomeAccount" TEXT,
    "expenseAccount" TEXT,
    "stockAccount" TEXT,
    "cogsAccount" TEXT,
    "stockUomCode" TEXT,
    "purchaseUomCode" TEXT,
    "salesUomCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "uoms" (
    "code" TEXT NOT NULL,
    "name" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "uoms_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "item_uoms" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "uomCode" TEXT NOT NULL,
    "conversionFactor" DECIMAL(18,6) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "item_uoms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "serials" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "serialNo" TEXT NOT NULL,
    "status" "SerialStatus" NOT NULL DEFAULT 'AVAILABLE',
    "warehouseId" TEXT,
    "locationId" TEXT,
    "batchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "serials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "batches" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "batchNo" TEXT NOT NULL,
    "mfgDate" DATE,
    "expDate" DATE,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouse_item_balances" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "actualQty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "reservedQty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warehouse_item_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bin_balances" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "batchId" TEXT DEFAULT '__NO_BATCH__',
    "actualQty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "reservedQty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bin_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_fifo_layers" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "batchId" TEXT,
    "postingTs" TIMESTAMP(3) NOT NULL,
    "qtyOriginal" DECIMAL(18,6) NOT NULL,
    "qtyRemaining" DECIMAL(18,6) NOT NULL,
    "incomingRate" DECIMAL(18,6) NOT NULL,
    "isCancelled" BOOLEAN NOT NULL DEFAULT false,
    "sourceLayerId" TEXT,
    "voucherType" TEXT NOT NULL,
    "voucherNo" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_fifo_layers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_postings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "postingKey" TEXT NOT NULL,
    "voucherType" TEXT NOT NULL,
    "voucherNo" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_postings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
CREATE TABLE "stock_ledger_entries" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "postingTs" TIMESTAMP(3) NOT NULL,
    "postingDate" DATE NOT NULL,
    "itemId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "fromLocationId" TEXT,
    "toLocationId" TEXT,
    "batchId" TEXT,
    "fifoLayerId" TEXT,
    "qty" DECIMAL(18,6) NOT NULL,
    "valuationRate" DECIMAL(18,6) NOT NULL,
    "stockValueDifference" DECIMAL(18,6) NOT NULL,
    "voucherType" TEXT NOT NULL,
    "voucherNo" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_ledger_entry_serials" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ledgerEntryId" TEXT NOT NULL,
    "serialId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_ledger_entry_serials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rootType" TEXT,
    "accountType" TEXT,
    "isGroup" BOOLEAN NOT NULL DEFAULT false,
    "parentAccountCode" TEXT,
    "currency" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gl_entries" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "postingDate" DATE NOT NULL,
    "postingTs" TIMESTAMP(3) NOT NULL,
    "accountId" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "exchangeRate" DECIMAL(18,9) NOT NULL,
    "debitBc" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "creditBc" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "debitFc" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "creditFc" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "voucherType" TEXT NOT NULL,
    "voucherNo" TEXT NOT NULL,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gl_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerType" TEXT NOT NULL DEFAULT 'Company',
    "customerGroup" TEXT,
    "territory" TEXT,
    "taxId" TEXT,
    "taxCategory" TEXT,
    "defaultCurrency" TEXT,
    "defaultPriceList" TEXT,
    "defaultPaymentTerms" TEXT,
    "creditLimit" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "creditDays" INTEGER NOT NULL DEFAULT 0,
    "receivableAccount" TEXT,
    "primaryAddress" TEXT,
    "primaryContact" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isFrozen" BOOLEAN NOT NULL DEFAULT false,
    "website" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "supplierName" TEXT NOT NULL,
    "supplierType" TEXT NOT NULL DEFAULT 'Company',
    "supplierGroup" TEXT,
    "country" TEXT,
    "taxId" TEXT,
    "taxCategory" TEXT,
    "taxWithholdingCategory" TEXT,
    "defaultCurrency" TEXT,
    "defaultPriceList" TEXT,
    "defaultPaymentTerms" TEXT,
    "paymentDays" INTEGER NOT NULL DEFAULT 0,
    "payableAccount" TEXT,
    "expenseAccount" TEXT,
    "primaryAddress" TEXT,
    "primaryContact" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isFrozen" BOOLEAN NOT NULL DEFAULT false,
    "website" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "addresses" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "linkDoctype" TEXT NOT NULL,
    "linkName" TEXT NOT NULL,
    "addressType" TEXT NOT NULL DEFAULT 'Billing',
    "addressTitle" TEXT,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT NOT NULL DEFAULT 'United States',
    "postalCode" TEXT,
    "phone" TEXT,
    "fax" TEXT,
    "email" TEXT,
    "isPrimaryAddress" BOOLEAN NOT NULL DEFAULT false,
    "isShippingAddress" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contacts" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "fullName" TEXT,
    "salutation" TEXT,
    "designation" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "mobile" TEXT,
    "isPrimaryContact" BOOLEAN NOT NULL DEFAULT false,
    "isBillingContact" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_links" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "linkDoctype" TEXT NOT NULL,
    "linkName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "banks" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "website" TEXT,
    "swiftCode" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "banks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_accounts" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "bankCode" TEXT,
    "accountNumber" TEXT,
    "accountType" TEXT NOT NULL DEFAULT 'Current',
    "iban" TEXT,
    "branchCode" TEXT,
    "glAccount" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "bankBalance" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "lastSyncDate" DATE,
    "integrationId" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_transactions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "bankAccount" TEXT NOT NULL,
    "transactionDate" DATE NOT NULL,
    "amount" DECIMAL(18,6) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "transactionType" TEXT NOT NULL,
    "description" TEXT,
    "referenceNumber" TEXT,
    "partyType" TEXT,
    "party" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Unreconciled',
    "paymentEntry" TEXT,
    "invoice" TEXT,
    "reconciliationId" TEXT,
    "importBatch" TEXT,
    "externalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_reconciliations" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "bankAccount" TEXT NOT NULL,
    "fromDate" DATE NOT NULL,
    "toDate" DATE NOT NULL,
    "openingBalance" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "closingBalance" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "bankStatementBalance" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "difference" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "docstatus" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "notes" TEXT,
    "owner" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_reconciliations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_reconciliation_details" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "bankTransaction" TEXT,
    "glEntryId" TEXT,
    "voucherType" TEXT,
    "voucherNo" TEXT,
    "amount" DECIMAL(18,6) NOT NULL,
    "postingDate" DATE,
    "isMatched" BOOLEAN NOT NULL DEFAULT false,
    "clearanceDate" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bank_reconciliation_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_matching_rules" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "bankAccount" TEXT,
    "descriptionContains" TEXT,
    "descriptionRegex" TEXT,
    "amountMin" DECIMAL(18,6),
    "amountMax" DECIMAL(18,6),
    "transactionType" TEXT,
    "action" TEXT NOT NULL DEFAULT 'Create Payment Entry',
    "partyType" TEXT,
    "party" TEXT,
    "account" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_matching_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_categories" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "parentId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_listings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "categoryId" TEXT,
    "slug" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "shortDescription" TEXT,
    "longDescription" TEXT,
    "price" DECIMAL(18,2) NOT NULL,
    "compareAtPrice" DECIMAL(18,2),
    "costPrice" DECIMAL(18,2),
    "images" TEXT[],
    "badge" TEXT,
    "metaTitle" TEXT,
    "metaDescription" TEXT,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "averageRating" DECIMAL(3,2) DEFAULT 0,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "store_customers" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "phone" TEXT,
    "customerId" TEXT,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "emailVerifiedAt" TIMESTAMP(3),
    "acceptsMarketing" BOOLEAN NOT NULL DEFAULT false,
    "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,
    "onboardingStep" TEXT,
    "profileCompletionScore" INTEGER NOT NULL DEFAULT 0,
    "lastOnboardingInteraction" TIMESTAMP(3),
    "hasViewedProductTour" BOOLEAN NOT NULL DEFAULT false,
    "hasAddedToCart" BOOLEAN NOT NULL DEFAULT false,
    "hasCompletedFirstPurchase" BOOLEAN NOT NULL DEFAULT false,
    "hasAddedShippingAddress" BOOLEAN NOT NULL DEFAULT false,
    "lastLoginAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "tokenVersion" INTEGER NOT NULL DEFAULT 0,
    "adminNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "store_customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "store_addresses" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT 'Home',
    "firstName" TEXT,
    "lastName" TEXT,
    "company" TEXT,
    "addressLine1" TEXT NOT NULL,
    "addressLine2" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT,
    "postalCode" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'US',
    "phone" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "store_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_resets" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_resets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_verification_tokens" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_verification_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "carts" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "customerId" TEXT,
    "sessionToken" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "shippingAddressId" TEXT,
    "couponCode" TEXT,
    "discountAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "subtotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "shippingTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "taxTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "grandTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "abandonedAt" TIMESTAMP(3),
    "recoveredAt" TIMESTAMP(3),
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "carts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cart_items" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "cartId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "price" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cart_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "customerId" TEXT,
    "cartId" TEXT,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "billingFirstName" TEXT,
    "billingLastName" TEXT,
    "billingCompany" TEXT,
    "billingAddressLine1" TEXT,
    "billingAddressLine2" TEXT,
    "billingCity" TEXT,
    "billingState" TEXT,
    "billingPostalCode" TEXT,
    "billingCountry" TEXT,
    "shippingFirstName" TEXT,
    "shippingLastName" TEXT,
    "shippingCompany" TEXT,
    "shippingAddressLine1" TEXT,
    "shippingAddressLine2" TEXT,
    "shippingCity" TEXT,
    "shippingState" TEXT,
    "shippingPostalCode" TEXT,
    "shippingCountry" TEXT,
    "subtotal" DECIMAL(18,2) NOT NULL,
    "shippingTotal" DECIMAL(18,2) NOT NULL,
    "taxTotal" DECIMAL(18,2) NOT NULL,
    "discountTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "giftCardDiscount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "grandTotal" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "couponCode" TEXT,
    "paymentMethod" TEXT,
    "stripePaymentIntentId" TEXT,
    "stripeChargeId" TEXT,
    "shippingMethod" TEXT,
    "shippingCarrier" TEXT,
    "trackingNumber" TEXT,
    "shippedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "customerNotes" TEXT,
    "internalNotes" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT,
    "variantId" TEXT,
    "variantAttributes" JSONB,
    "sku" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(18,2) NOT NULL,
    "totalPrice" DECIMAL(18,2) NOT NULL,
    "quantityFulfilled" INTEGER NOT NULL DEFAULT 0,
    "quantityRefunded" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "method" TEXT NOT NULL DEFAULT 'card',
    "type" TEXT,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "stripePaymentIntentId" TEXT,
    "stripeChargeId" TEXT,
    "stripeRefundId" TEXT,
    "giftCardId" TEXT,
    "cardBrand" TEXT,
    "cardLast4" TEXT,
    "cardExpiry" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "authorizedAt" TIMESTAMP(3),
    "capturedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupons" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "discountType" TEXT NOT NULL DEFAULT 'percentage',
    "discountValue" DECIMAL(18,2) NOT NULL,
    "minimumOrderAmount" DECIMAL(18,2),
    "maximumDiscount" DECIMAL(18,2),
    "usageLimit" INTEGER,
    "usageLimitPerCustomer" INTEGER DEFAULT 1,
    "timesUsed" INTEGER NOT NULL DEFAULT 0,
    "startsAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coupons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupon_usages" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "couponId" TEXT NOT NULL,
    "customerId" TEXT,
    "orderId" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coupon_usages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_attribute_types" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "item_attribute_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_attribute_values" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "attributeTypeId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "displayValue" TEXT NOT NULL,
    "colorHex" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "item_attribute_values_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_variants" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "productListingId" TEXT NOT NULL,
    "sku" TEXT,
    "barcode" TEXT,
    "price" DECIMAL(18,2),
    "compareAtPrice" DECIMAL(18,2),
    "costPrice" DECIMAL(18,2),
    "itemId" TEXT,
    "imageUrl" TEXT,
    "stockQty" INTEGER NOT NULL DEFAULT 0,
    "trackInventory" BOOLEAN NOT NULL DEFAULT true,
    "allowBackorder" BOOLEAN NOT NULL DEFAULT false,
    "weight" DECIMAL(18,4),
    "weightUnit" TEXT NOT NULL DEFAULT 'kg',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_variant_attributes" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "attributeTypeId" TEXT NOT NULL,
    "attributeValueId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_variant_attributes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_reviews" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "productListingId" TEXT NOT NULL,
    "customerId" TEXT,
    "rating" INTEGER NOT NULL,
    "title" TEXT,
    "content" TEXT,
    "pros" TEXT,
    "cons" TEXT,
    "reviewerName" TEXT,
    "reviewerEmail" TEXT,
    "isVerifiedPurchase" BOOLEAN NOT NULL DEFAULT false,
    "images" TEXT[],
    "status" TEXT NOT NULL DEFAULT 'pending',
    "moderatedAt" TIMESTAMP(3),
    "moderatedBy" TEXT,
    "moderationNotes" TEXT,
    "helpfulCount" INTEGER NOT NULL DEFAULT 0,
    "notHelpfulCount" INTEGER NOT NULL DEFAULT 0,
    "adminResponse" TEXT,
    "adminRespondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_votes" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "customerId" TEXT,
    "sessionToken" TEXT,
    "isHelpful" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_votes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gift_cards" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "pin" TEXT,
    "initialValue" DECIMAL(18,2) NOT NULL,
    "currentBalance" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "sourceType" TEXT NOT NULL,
    "sourceOrderId" TEXT,
    "recipientEmail" TEXT,
    "recipientName" TEXT,
    "senderName" TEXT,
    "personalMessage" TEXT,
    "deliveryMethod" TEXT NOT NULL DEFAULT 'email',
    "deliveredAt" TIMESTAMP(3),
    "activatedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gift_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gift_card_transactions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "giftCardId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "balanceBefore" DECIMAL(18,2) NOT NULL,
    "balanceAfter" DECIMAL(18,2) NOT NULL,
    "orderId" TEXT,
    "notes" TEXT,
    "performedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gift_card_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wishlists" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'My Wishlist',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "shareToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wishlists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wishlist_items" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "wishlistId" TEXT NOT NULL,
    "productListingId" TEXT NOT NULL,
    "variantId" TEXT,
    "priceWhenAdded" DECIMAL(18,2),
    "priority" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wishlist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "store_currencies" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "currencyCode" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "symbolPosition" TEXT NOT NULL DEFAULT 'before',
    "decimalPlaces" INTEGER NOT NULL DEFAULT 2,
    "decimalSeparator" TEXT NOT NULL DEFAULT '.',
    "thousandsSeparator" TEXT NOT NULL DEFAULT ',',
    "exchangeRate" DECIMAL(18,8) NOT NULL DEFAULT 1,
    "isBaseCurrency" BOOLEAN NOT NULL DEFAULT false,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "lastRateUpdate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "store_currencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_price_overrides" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "productListingId" TEXT NOT NULL,
    "currencyCode" TEXT NOT NULL,
    "price" DECIMAL(18,4) NOT NULL,
    "compareAtPrice" DECIMAL(18,4),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_price_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "variant_price_overrides" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "currencyCode" TEXT NOT NULL,
    "price" DECIMAL(18,4) NOT NULL,
    "compareAtPrice" DECIMAL(18,4),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "variant_price_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipping_carriers" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'api',
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "apiKey" TEXT,
    "apiSecret" TEXT,
    "accountNumber" TEXT,
    "testMode" BOOLEAN NOT NULL DEFAULT true,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipping_carriers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipping_zones" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "countries" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "states" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "zipCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipping_zones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipping_rates" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,
    "carrierId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'flat',
    "price" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "minOrderAmount" DECIMAL(18,4),
    "maxOrderAmount" DECIMAL(18,4),
    "minWeight" DECIMAL(18,4),
    "maxWeight" DECIMAL(18,4),
    "freeShippingThreshold" DECIMAL(18,4),
    "estimatedDaysMin" INTEGER,
    "estimatedDaysMax" INTEGER,
    "carrierServiceCode" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipping_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipping_weight_tiers" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "rateId" TEXT NOT NULL,
    "minWeight" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "maxWeight" DECIMAL(18,4),
    "price" DECIMAL(18,4) NOT NULL,
    "pricePerKg" DECIMAL(18,4),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shipping_weight_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipments" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "carrierId" TEXT,
    "carrierName" TEXT NOT NULL,
    "trackingNumber" TEXT,
    "trackingUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "labelUrl" TEXT,
    "estimatedDelivery" TIMESTAMP(3),
    "actualDelivery" TIMESTAMP(3),
    "shippedAt" TIMESTAMP(3),
    "weight" DECIMAL(18,4),
    "dimensions" JSONB,
    "cost" DECIMAL(18,4),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipment_events" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "rawData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shipment_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "store_languages" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "languageCode" TEXT NOT NULL,
    "countryCode" TEXT,
    "name" TEXT NOT NULL,
    "nativeName" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "store_languages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_translations" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "productListingId" TEXT NOT NULL,
    "languageCode" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "shortDescription" TEXT,
    "longDescription" TEXT,
    "metaTitle" TEXT,
    "metaDescription" TEXT,
    "slug" TEXT,
    "badge" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "category_translations" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "languageCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "slug" TEXT,
    "metaTitle" TEXT,
    "metaDescription" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "category_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attribute_translations" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "attributeTypeId" TEXT,
    "attributeValueId" TEXT,
    "languageCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attribute_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipping_rate_translations" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "shippingRateId" TEXT NOT NULL,
    "languageCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipping_rate_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_translations" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "contentKey" TEXT NOT NULL,
    "languageCode" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "contentType" TEXT NOT NULL DEFAULT 'text',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "store_customer_preferences" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "marketing" BOOLEAN NOT NULL DEFAULT true,
    "orderUpdates" BOOLEAN NOT NULL DEFAULT true,
    "promotions" BOOLEAN NOT NULL DEFAULT true,
    "newsletter" BOOLEAN NOT NULL DEFAULT true,
    "unsubscribedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "store_customer_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_bounces" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "reason" TEXT,
    "bouncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "suppressed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "email_bounces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "store_themes" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "isCustom" BOOLEAN NOT NULL DEFAULT false,
    "isPreset" BOOLEAN NOT NULL DEFAULT false,
    "colors" JSONB NOT NULL,
    "fontFamily" TEXT NOT NULL DEFAULT 'Inter',
    "headingFont" TEXT,
    "fontSize" TEXT NOT NULL DEFAULT 'base',
    "fontWeightBody" INTEGER NOT NULL DEFAULT 400,
    "fontWeightHeading" INTEGER NOT NULL DEFAULT 700,
    "layoutStyle" TEXT NOT NULL DEFAULT 'standard',
    "headerStyle" TEXT NOT NULL DEFAULT 'classic',
    "footerStyle" TEXT NOT NULL DEFAULT 'standard',
    "spacing" TEXT NOT NULL DEFAULT 'comfortable',
    "containerMaxWidth" TEXT NOT NULL DEFAULT '1280px',
    "buttonStyle" TEXT NOT NULL DEFAULT 'rounded',
    "buttonSize" TEXT NOT NULL DEFAULT 'md',
    "cardStyle" TEXT NOT NULL DEFAULT 'shadow',
    "cardRadius" TEXT NOT NULL DEFAULT 'lg',
    "inputStyle" TEXT NOT NULL DEFAULT 'outlined',
    "productGridColumns" INTEGER NOT NULL DEFAULT 3,
    "productImageRatio" TEXT NOT NULL DEFAULT 'square',
    "showQuickView" BOOLEAN NOT NULL DEFAULT true,
    "showWishlist" BOOLEAN NOT NULL DEFAULT true,
    "customCSS" TEXT,
    "logoUrl" TEXT,
    "faviconUrl" TEXT,
    "previewImageUrl" TEXT,
    "tags" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "store_themes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_connections" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "refreshToken" TEXT,
    "accessToken" TEXT,
    "accessTokenExpiry" TIMESTAMP(3),
    "platformConfig" JSONB NOT NULL DEFAULT '{}',
    "marketplaceId" TEXT,
    "siteId" INTEGER,
    "fulfillmentPolicyId" TEXT,
    "paymentPolicyId" TEXT,
    "returnPolicyId" TEXT,
    "locationKey" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isConnected" BOOLEAN NOT NULL DEFAULT false,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "autoSyncInventory" BOOLEAN NOT NULL DEFAULT true,
    "autoSyncOrders" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketplace_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_listings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "productListingId" TEXT NOT NULL,
    "warehouseId" TEXT,
    "externalOfferId" TEXT,
    "externalListingId" TEXT,
    "externalItemId" TEXT,
    "sku" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "description" TEXT NOT NULL,
    "price" DECIMAL(18,2) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "condition" TEXT NOT NULL,
    "conditionDescription" TEXT,
    "categoryId" TEXT NOT NULL,
    "secondaryCategoryId" TEXT,
    "privateListing" BOOLEAN NOT NULL DEFAULT false,
    "lotSize" INTEGER,
    "epid" TEXT,
    "itemLocationCity" TEXT,
    "itemLocationState" TEXT,
    "itemLocationPostalCode" TEXT,
    "itemLocationCountry" TEXT,
    "format" TEXT NOT NULL DEFAULT 'FIXED_PRICE',
    "startPrice" DECIMAL(18,2),
    "reservePrice" DECIMAL(18,2),
    "buyItNowPrice" DECIMAL(18,2),
    "listingDuration" TEXT,
    "bestOfferEnabled" BOOLEAN NOT NULL DEFAULT false,
    "autoAcceptPrice" DECIMAL(18,2),
    "autoDeclinePrice" DECIMAL(18,2),
    "isVariation" BOOLEAN NOT NULL DEFAULT false,
    "parentListingId" TEXT,
    "inventoryGroupKey" TEXT,
    "variantAspects" JSONB,
    "platformData" JSONB NOT NULL DEFAULT '{}',
    "photos" JSONB NOT NULL DEFAULT '[]',
    "itemSpecifics" JSONB,
    "packageType" TEXT,
    "weightValue" DECIMAL(18,4),
    "weightUnit" TEXT,
    "dimensionLength" DECIMAL(18,4),
    "dimensionWidth" DECIMAL(18,4),
    "dimensionHeight" DECIMAL(18,4),
    "dimensionUnit" TEXT,
    "fulfillmentPolicyId" TEXT,
    "paymentPolicyId" TEXT,
    "returnPolicyId" TEXT,
    "status" TEXT NOT NULL,
    "syncStatus" TEXT NOT NULL DEFAULT 'pending',
    "errorMessage" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedById" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "inventoryItemPayload" JSONB,
    "offerPayload" JSONB,
    "publishResult" JSONB,
    "publishedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketplace_listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_orders" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "orderId" TEXT,
    "externalOrderId" TEXT NOT NULL,
    "buyerUsername" TEXT NOT NULL,
    "buyerEmail" TEXT,
    "shippingName" TEXT NOT NULL,
    "shippingStreet1" TEXT NOT NULL,
    "shippingStreet2" TEXT,
    "shippingCity" TEXT NOT NULL,
    "shippingState" TEXT,
    "shippingPostalCode" TEXT NOT NULL,
    "shippingCountry" TEXT NOT NULL,
    "subtotal" DECIMAL(18,2) NOT NULL,
    "shippingCost" DECIMAL(18,2) NOT NULL,
    "taxAmount" DECIMAL(18,2) NOT NULL,
    "total" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "externalStatus" TEXT NOT NULL,
    "paymentStatus" TEXT NOT NULL,
    "fulfillmentStatus" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "orderDate" TIMESTAMP(3) NOT NULL,
    "paymentDate" TIMESTAMP(3),
    "syncStatus" TEXT NOT NULL DEFAULT 'pending',
    "syncedToOrderAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "itemsData" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketplace_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_sync_logs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "syncType" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "itemsTotal" INTEGER NOT NULL DEFAULT 0,
    "itemsSuccess" INTEGER NOT NULL DEFAULT 0,
    "itemsFailed" INTEGER NOT NULL DEFAULT 0,
    "details" TEXT,
    "errorMessage" TEXT,
    "metadata" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "marketplace_sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_returns" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "marketplaceOrderId" TEXT,
    "externalReturnId" TEXT NOT NULL,
    "externalOrderId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "buyerComments" TEXT,
    "sellerComments" TEXT,
    "status" TEXT NOT NULL,
    "buyerUsername" TEXT NOT NULL,
    "itemsData" JSONB NOT NULL,
    "refundAmount" DECIMAL(18,2),
    "refundCurrency" TEXT NOT NULL DEFAULT 'USD',
    "refundStatus" TEXT,
    "requestDate" TIMESTAMP(3) NOT NULL,
    "responseDate" TIMESTAMP(3),
    "receivedDate" TIMESTAMP(3),
    "refundDate" TIMESTAMP(3),
    "syncStatus" TEXT NOT NULL DEFAULT 'pending',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketplace_returns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_message_threads" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "externalThreadId" TEXT NOT NULL,
    "externalItemId" TEXT,
    "itemTitle" TEXT,
    "buyerUsername" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "lastMessageDate" TIMESTAMP(3) NOT NULL,
    "syncStatus" TEXT NOT NULL DEFAULT 'pending',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketplace_message_threads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_messages" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "externalMessageId" TEXT NOT NULL,
    "sender" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "sentDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marketplace_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_campaigns" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "externalCampaignId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "campaignType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "budgetAmount" DECIMAL(18,2),
    "budgetCurrency" TEXT NOT NULL DEFAULT 'USD',
    "bidPercentage" DECIMAL(5,2),
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "sales" INTEGER NOT NULL DEFAULT 0,
    "spend" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "syncStatus" TEXT NOT NULL DEFAULT 'pending',
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketplace_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_violations" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "externalViolationId" TEXT NOT NULL,
    "complianceType" TEXT NOT NULL,
    "listingId" TEXT,
    "reasonCode" TEXT,
    "message" TEXT,
    "severity" TEXT,
    "violationData" JSONB,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketplace_violations_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "webhooks" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "events" TEXT[],
    "secret" TEXT NOT NULL,
    "headers" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "webhooks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_deliveries" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "webhookId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL DEFAULT 0,
    "response" TEXT,
    "error" TEXT,
    "duration" INTEGER NOT NULL DEFAULT 0,
    "success" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processed_webhook_events" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processed_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oauth_states" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oauth_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "merchant_email_verification_tokens" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "merchant_email_verification_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "store_pages" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "store_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_import_jobs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "processedRows" INTEGER NOT NULL DEFAULT 0,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB NOT NULL DEFAULT '[]',
    "payload" JSONB,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_import_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "background_jobs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "error" TEXT,
    "result" JSONB,
    "scheduledAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "background_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "data" JSONB,
    "link" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT,
    "customerId" TEXT,
    "tenantId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_domain_key" ON "tenants"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_customDomain_key" ON "tenants"("customDomain");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_stripeConnectAccountId_key" ON "tenants"("stripeConnectAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_squareMerchantId_key" ON "tenants"("squareMerchantId");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_tenantId_idx" ON "users"("tenantId");

-- CreateIndex
CREATE INDEX "exchange_rates_toCode_rateDate_idx" ON "exchange_rates"("toCode", "rateDate");

-- CreateIndex
CREATE UNIQUE INDEX "exchange_rates_fromCode_toCode_rateDate_key" ON "exchange_rates"("fromCode", "toCode", "rateDate");

-- CreateIndex
CREATE UNIQUE INDEX "doc_types_name_key" ON "doc_types"("name");

-- CreateIndex
CREATE INDEX "doc_fields_docTypeName_idx" ON "doc_fields"("docTypeName");

-- CreateIndex
CREATE INDEX "doc_perms_docTypeName_idx" ON "doc_perms"("docTypeName");

-- CreateIndex
CREATE INDEX "doc_perms_role_idx" ON "doc_perms"("role");

-- CreateIndex
CREATE INDEX "warehouses_tenantId_deletedAt_idx" ON "warehouses"("tenantId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "warehouses_tenantId_code_key" ON "warehouses"("tenantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "warehouses_tenantId_name_key" ON "warehouses"("tenantId", "name");

-- CreateIndex
CREATE INDEX "locations_warehouseId_idx" ON "locations"("warehouseId");

-- CreateIndex
CREATE INDEX "locations_tenantId_deletedAt_idx" ON "locations"("tenantId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "locations_tenantId_warehouseId_code_key" ON "locations"("tenantId", "warehouseId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "locations_tenantId_warehouseId_path_key" ON "locations"("tenantId", "warehouseId", "path");

-- CreateIndex
CREATE UNIQUE INDEX "items_tenantId_code_key" ON "items"("tenantId", "code");

-- CreateIndex
CREATE INDEX "item_uoms_itemId_idx" ON "item_uoms"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "item_uoms_tenantId_itemId_uomCode_key" ON "item_uoms"("tenantId", "itemId", "uomCode");

-- CreateIndex
CREATE INDEX "serials_itemId_idx" ON "serials"("itemId");

-- CreateIndex
CREATE INDEX "serials_warehouseId_idx" ON "serials"("warehouseId");

-- CreateIndex
CREATE UNIQUE INDEX "serials_tenantId_serialNo_key" ON "serials"("tenantId", "serialNo");

-- CreateIndex
CREATE INDEX "batches_itemId_idx" ON "batches"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "batches_tenantId_itemId_batchNo_key" ON "batches"("tenantId", "itemId", "batchNo");

-- CreateIndex
CREATE INDEX "warehouse_item_balances_warehouseId_idx" ON "warehouse_item_balances"("warehouseId");

-- CreateIndex
CREATE UNIQUE INDEX "warehouse_item_balances_tenantId_itemId_warehouseId_key" ON "warehouse_item_balances"("tenantId", "itemId", "warehouseId");

-- CreateIndex
CREATE INDEX "bin_balances_locationId_idx" ON "bin_balances"("locationId");

-- CreateIndex
CREATE UNIQUE INDEX "bin_balances_tenantId_itemId_warehouseId_locationId_batchId_key" ON "bin_balances"("tenantId", "itemId", "warehouseId", "locationId", "batchId");

-- CreateIndex
CREATE INDEX "stock_fifo_layers_tenantId_itemId_warehouseId_postingTs_idx" ON "stock_fifo_layers"("tenantId", "itemId", "warehouseId", "postingTs");

-- CreateIndex
CREATE INDEX "stock_fifo_layers_batchId_idx" ON "stock_fifo_layers"("batchId");

-- CreateIndex
CREATE INDEX "stock_fifo_layers_sourceLayerId_idx" ON "stock_fifo_layers"("sourceLayerId");

-- CreateIndex
CREATE INDEX "stock_postings_tenantId_voucherType_voucherNo_idx" ON "stock_postings"("tenantId", "voucherType", "voucherNo");

-- CreateIndex
CREATE UNIQUE INDEX "stock_postings_tenantId_postingKey_key" ON "stock_postings"("tenantId", "postingKey");

-- CreateIndex
CREATE INDEX "audit_logs_tenantId_docType_idx" ON "audit_logs"("tenantId", "docType");

-- CreateIndex
CREATE INDEX "audit_logs_docName_idx" ON "audit_logs"("docName");

-- CreateIndex
CREATE INDEX "stock_ledger_entries_tenantId_postingDate_idx" ON "stock_ledger_entries"("tenantId", "postingDate");

-- CreateIndex
CREATE INDEX "stock_ledger_entries_tenantId_itemId_warehouseId_idx" ON "stock_ledger_entries"("tenantId", "itemId", "warehouseId");

-- CreateIndex
CREATE INDEX "stock_ledger_entries_tenantId_voucherType_voucherNo_idx" ON "stock_ledger_entries"("tenantId", "voucherType", "voucherNo");

-- CreateIndex
CREATE INDEX "stock_ledger_entry_serials_ledgerEntryId_idx" ON "stock_ledger_entry_serials"("ledgerEntryId");

-- CreateIndex
CREATE INDEX "stock_ledger_entry_serials_serialId_idx" ON "stock_ledger_entry_serials"("serialId");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_tenantId_code_key" ON "accounts"("tenantId", "code");

-- CreateIndex
CREATE INDEX "gl_entries_tenantId_postingDate_idx" ON "gl_entries"("tenantId", "postingDate");

-- CreateIndex
CREATE INDEX "gl_entries_tenantId_voucherType_voucherNo_idx" ON "gl_entries"("tenantId", "voucherType", "voucherNo");

-- CreateIndex
CREATE INDEX "customers_tenantId_customerName_idx" ON "customers"("tenantId", "customerName");

-- CreateIndex
CREATE INDEX "customers_tenantId_customerGroup_idx" ON "customers"("tenantId", "customerGroup");

-- CreateIndex
CREATE UNIQUE INDEX "customers_tenantId_code_key" ON "customers"("tenantId", "code");

-- CreateIndex
CREATE INDEX "suppliers_tenantId_supplierName_idx" ON "suppliers"("tenantId", "supplierName");

-- CreateIndex
CREATE INDEX "suppliers_tenantId_supplierGroup_idx" ON "suppliers"("tenantId", "supplierGroup");

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_tenantId_code_key" ON "suppliers"("tenantId", "code");

-- CreateIndex
CREATE INDEX "addresses_tenantId_idx" ON "addresses"("tenantId");

-- CreateIndex
CREATE INDEX "addresses_tenantId_linkDoctype_linkName_idx" ON "addresses"("tenantId", "linkDoctype", "linkName");

-- CreateIndex
CREATE INDEX "contacts_tenantId_idx" ON "contacts"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "contacts_tenantId_name_key" ON "contacts"("tenantId", "name");

-- CreateIndex
CREATE INDEX "contact_links_contactId_idx" ON "contact_links"("contactId");

-- CreateIndex
CREATE INDEX "contact_links_tenantId_linkDoctype_linkName_idx" ON "contact_links"("tenantId", "linkDoctype", "linkName");

-- CreateIndex
CREATE UNIQUE INDEX "contact_links_tenantId_contactId_linkDoctype_linkName_key" ON "contact_links"("tenantId", "contactId", "linkDoctype", "linkName");

-- CreateIndex
CREATE INDEX "banks_tenantId_idx" ON "banks"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "banks_tenantId_code_key" ON "banks"("tenantId", "code");

-- CreateIndex
CREATE INDEX "bank_accounts_tenantId_idx" ON "bank_accounts"("tenantId");

-- CreateIndex
CREATE INDEX "bank_accounts_tenantId_glAccount_idx" ON "bank_accounts"("tenantId", "glAccount");

-- CreateIndex
CREATE UNIQUE INDEX "bank_accounts_tenantId_name_key" ON "bank_accounts"("tenantId", "name");

-- CreateIndex
CREATE INDEX "bank_transactions_tenantId_idx" ON "bank_transactions"("tenantId");

-- CreateIndex
CREATE INDEX "bank_transactions_tenantId_bankAccount_idx" ON "bank_transactions"("tenantId", "bankAccount");

-- CreateIndex
CREATE INDEX "bank_transactions_tenantId_transactionDate_idx" ON "bank_transactions"("tenantId", "transactionDate");

-- CreateIndex
CREATE INDEX "bank_transactions_tenantId_status_idx" ON "bank_transactions"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "bank_transactions_tenantId_name_key" ON "bank_transactions"("tenantId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "bank_transactions_tenantId_externalId_key" ON "bank_transactions"("tenantId", "externalId");

-- CreateIndex
CREATE INDEX "bank_reconciliations_tenantId_idx" ON "bank_reconciliations"("tenantId");

-- CreateIndex
CREATE INDEX "bank_reconciliations_tenantId_bankAccount_idx" ON "bank_reconciliations"("tenantId", "bankAccount");

-- CreateIndex
CREATE UNIQUE INDEX "bank_reconciliations_tenantId_name_key" ON "bank_reconciliations"("tenantId", "name");

-- CreateIndex
CREATE INDEX "bank_reconciliation_details_parentId_idx" ON "bank_reconciliation_details"("parentId");

-- CreateIndex
CREATE INDEX "bank_reconciliation_details_tenantId_idx" ON "bank_reconciliation_details"("tenantId");

-- CreateIndex
CREATE INDEX "bank_matching_rules_tenantId_idx" ON "bank_matching_rules"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "bank_matching_rules_tenantId_name_key" ON "bank_matching_rules"("tenantId", "name");

-- CreateIndex
CREATE INDEX "product_categories_tenantId_isActive_idx" ON "product_categories"("tenantId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "product_categories_tenantId_slug_key" ON "product_categories"("tenantId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "product_listings_itemId_key" ON "product_listings"("itemId");

-- CreateIndex
CREATE INDEX "product_listings_tenantId_isPublished_idx" ON "product_listings"("tenantId", "isPublished");

-- CreateIndex
CREATE INDEX "product_listings_tenantId_categoryId_idx" ON "product_listings"("tenantId", "categoryId");

-- CreateIndex
CREATE INDEX "product_listings_tenantId_isFeatured_idx" ON "product_listings"("tenantId", "isFeatured");

-- CreateIndex
CREATE INDEX "product_listings_tenantId_deletedAt_idx" ON "product_listings"("tenantId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "product_listings_tenantId_slug_key" ON "product_listings"("tenantId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "product_listings_tenantId_itemId_key" ON "product_listings"("tenantId", "itemId");

-- CreateIndex
CREATE INDEX "store_customers_tenantId_isActive_idx" ON "store_customers"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX "store_customers_id_tokenVersion_idx" ON "store_customers"("id", "tokenVersion");

-- CreateIndex
CREATE UNIQUE INDEX "store_customers_tenantId_email_key" ON "store_customers"("tenantId", "email");

-- CreateIndex
CREATE INDEX "store_addresses_customerId_idx" ON "store_addresses"("customerId");

-- CreateIndex
CREATE INDEX "store_addresses_tenantId_customerId_idx" ON "store_addresses"("tenantId", "customerId");

-- CreateIndex
CREATE UNIQUE INDEX "password_resets_token_key" ON "password_resets"("token");

-- CreateIndex
CREATE INDEX "password_resets_customerId_idx" ON "password_resets"("customerId");

-- CreateIndex
CREATE INDEX "password_resets_token_idx" ON "password_resets"("token");

-- CreateIndex
CREATE UNIQUE INDEX "email_verification_tokens_token_key" ON "email_verification_tokens"("token");

-- CreateIndex
CREATE INDEX "email_verification_tokens_customerId_idx" ON "email_verification_tokens"("customerId");

-- CreateIndex
CREATE INDEX "email_verification_tokens_token_idx" ON "email_verification_tokens"("token");

-- CreateIndex
CREATE INDEX "carts_tenantId_customerId_idx" ON "carts"("tenantId", "customerId");

-- CreateIndex
CREATE INDEX "carts_tenantId_status_idx" ON "carts"("tenantId", "status");

-- CreateIndex
CREATE INDEX "carts_tenantId_updatedAt_idx" ON "carts"("tenantId", "updatedAt");

-- CreateIndex
CREATE INDEX "carts_tenantId_expiresAt_idx" ON "carts"("tenantId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "carts_tenantId_sessionToken_key" ON "carts"("tenantId", "sessionToken");

-- CreateIndex
CREATE INDEX "cart_items_cartId_idx" ON "cart_items"("cartId");

-- CreateIndex
CREATE UNIQUE INDEX "cart_items_cartId_productId_variantId_key" ON "cart_items"("cartId", "productId", "variantId");

-- CreateIndex
CREATE UNIQUE INDEX "orders_cartId_key" ON "orders"("cartId");

-- CreateIndex
CREATE INDEX "orders_tenantId_customerId_idx" ON "orders"("tenantId", "customerId");

-- CreateIndex
CREATE INDEX "orders_tenantId_status_idx" ON "orders"("tenantId", "status");

-- CreateIndex
CREATE INDEX "orders_tenantId_createdAt_idx" ON "orders"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "orders_stripePaymentIntentId_idx" ON "orders"("stripePaymentIntentId");

-- CreateIndex
CREATE INDEX "orders_tenantId_paymentStatus_idx" ON "orders"("tenantId", "paymentStatus");

-- CreateIndex
CREATE UNIQUE INDEX "orders_tenantId_orderNumber_key" ON "orders"("tenantId", "orderNumber");

-- CreateIndex
CREATE INDEX "order_items_orderId_idx" ON "order_items"("orderId");

-- CreateIndex
CREATE INDEX "payments_orderId_idx" ON "payments"("orderId");

-- CreateIndex
CREATE INDEX "payments_giftCardId_idx" ON "payments"("giftCardId");

-- CreateIndex
CREATE INDEX "payments_tenantId_status_idx" ON "payments"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "payments_tenantId_stripePaymentIntentId_key" ON "payments"("tenantId", "stripePaymentIntentId");

-- CreateIndex
CREATE INDEX "coupons_tenantId_isActive_idx" ON "coupons"("tenantId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "coupons_tenantId_code_key" ON "coupons"("tenantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "coupon_usages_orderId_key" ON "coupon_usages"("orderId");

-- CreateIndex
CREATE INDEX "coupon_usages_tenantId_couponId_idx" ON "coupon_usages"("tenantId", "couponId");

-- CreateIndex
CREATE INDEX "coupon_usages_tenantId_customerId_idx" ON "coupon_usages"("tenantId", "customerId");

-- CreateIndex
CREATE UNIQUE INDEX "coupon_usages_tenantId_couponId_customerId_orderId_key" ON "coupon_usages"("tenantId", "couponId", "customerId", "orderId");

-- CreateIndex
CREATE INDEX "item_attribute_types_tenantId_idx" ON "item_attribute_types"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "item_attribute_types_tenantId_name_key" ON "item_attribute_types"("tenantId", "name");

-- CreateIndex
CREATE INDEX "item_attribute_values_tenantId_idx" ON "item_attribute_values"("tenantId");

-- CreateIndex
CREATE INDEX "item_attribute_values_attributeTypeId_idx" ON "item_attribute_values"("attributeTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "item_attribute_values_attributeTypeId_value_key" ON "item_attribute_values"("attributeTypeId", "value");

-- CreateIndex
CREATE INDEX "product_variants_tenantId_idx" ON "product_variants"("tenantId");

-- CreateIndex
CREATE INDEX "product_variants_productListingId_idx" ON "product_variants"("productListingId");

-- CreateIndex
CREATE INDEX "product_variant_attributes_tenantId_idx" ON "product_variant_attributes"("tenantId");

-- CreateIndex
CREATE INDEX "product_variant_attributes_variantId_idx" ON "product_variant_attributes"("variantId");

-- CreateIndex
CREATE UNIQUE INDEX "product_variant_attributes_tenantId_variantId_attributeType_key" ON "product_variant_attributes"("tenantId", "variantId", "attributeTypeId");

-- CreateIndex
CREATE INDEX "product_reviews_tenantId_idx" ON "product_reviews"("tenantId");

-- CreateIndex
CREATE INDEX "product_reviews_productListingId_idx" ON "product_reviews"("productListingId");

-- CreateIndex
CREATE INDEX "product_reviews_customerId_idx" ON "product_reviews"("customerId");

-- CreateIndex
CREATE INDEX "product_reviews_tenantId_status_idx" ON "product_reviews"("tenantId", "status");

-- CreateIndex
CREATE INDEX "review_votes_tenantId_idx" ON "review_votes"("tenantId");

-- CreateIndex
CREATE INDEX "review_votes_reviewId_idx" ON "review_votes"("reviewId");

-- CreateIndex
CREATE UNIQUE INDEX "review_votes_tenantId_reviewId_customerId_key" ON "review_votes"("tenantId", "reviewId", "customerId");

-- CreateIndex
CREATE UNIQUE INDEX "review_votes_tenantId_reviewId_sessionToken_key" ON "review_votes"("tenantId", "reviewId", "sessionToken");

-- CreateIndex
CREATE INDEX "gift_cards_tenantId_idx" ON "gift_cards"("tenantId");

-- CreateIndex
CREATE INDEX "gift_cards_tenantId_status_idx" ON "gift_cards"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "gift_cards_tenantId_code_key" ON "gift_cards"("tenantId", "code");

-- CreateIndex
CREATE INDEX "gift_card_transactions_giftCardId_idx" ON "gift_card_transactions"("giftCardId");

-- CreateIndex
CREATE INDEX "gift_card_transactions_orderId_idx" ON "gift_card_transactions"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "wishlists_shareToken_key" ON "wishlists"("shareToken");

-- CreateIndex
CREATE INDEX "wishlists_tenantId_idx" ON "wishlists"("tenantId");

-- CreateIndex
CREATE INDEX "wishlists_customerId_idx" ON "wishlists"("customerId");

-- CreateIndex
CREATE INDEX "wishlist_items_tenantId_idx" ON "wishlist_items"("tenantId");

-- CreateIndex
CREATE INDEX "wishlist_items_wishlistId_idx" ON "wishlist_items"("wishlistId");

-- CreateIndex
CREATE INDEX "wishlist_items_productListingId_idx" ON "wishlist_items"("productListingId");

-- CreateIndex
CREATE UNIQUE INDEX "wishlist_items_wishlistId_productListingId_variantId_key" ON "wishlist_items"("wishlistId", "productListingId", "variantId");

-- CreateIndex
CREATE INDEX "store_currencies_tenantId_idx" ON "store_currencies"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "store_currencies_tenantId_currencyCode_key" ON "store_currencies"("tenantId", "currencyCode");

-- CreateIndex
CREATE INDEX "product_price_overrides_tenantId_idx" ON "product_price_overrides"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "product_price_overrides_productListingId_currencyCode_key" ON "product_price_overrides"("productListingId", "currencyCode");

-- CreateIndex
CREATE INDEX "variant_price_overrides_tenantId_idx" ON "variant_price_overrides"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "variant_price_overrides_variantId_currencyCode_key" ON "variant_price_overrides"("variantId", "currencyCode");

-- CreateIndex
CREATE INDEX "shipping_carriers_tenantId_idx" ON "shipping_carriers"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "shipping_carriers_tenantId_code_key" ON "shipping_carriers"("tenantId", "code");

-- CreateIndex
CREATE INDEX "shipping_zones_tenantId_idx" ON "shipping_zones"("tenantId");

-- CreateIndex
CREATE INDEX "shipping_rates_tenantId_idx" ON "shipping_rates"("tenantId");

-- CreateIndex
CREATE INDEX "shipping_rates_zoneId_idx" ON "shipping_rates"("zoneId");

-- CreateIndex
CREATE INDEX "shipping_weight_tiers_tenantId_idx" ON "shipping_weight_tiers"("tenantId");

-- CreateIndex
CREATE INDEX "shipments_orderId_idx" ON "shipments"("orderId");

-- CreateIndex
CREATE INDEX "shipments_trackingNumber_idx" ON "shipments"("trackingNumber");

-- CreateIndex
CREATE INDEX "shipments_tenantId_idx" ON "shipments"("tenantId");

-- CreateIndex
CREATE INDEX "shipment_events_shipmentId_idx" ON "shipment_events"("shipmentId");

-- CreateIndex
CREATE INDEX "shipment_events_tenantId_idx" ON "shipment_events"("tenantId");

-- CreateIndex
CREATE INDEX "store_languages_tenantId_idx" ON "store_languages"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "store_languages_tenantId_languageCode_countryCode_key" ON "store_languages"("tenantId", "languageCode", "countryCode");

-- CreateIndex
CREATE INDEX "product_translations_tenantId_idx" ON "product_translations"("tenantId");

-- CreateIndex
CREATE INDEX "product_translations_tenantId_languageCode_slug_idx" ON "product_translations"("tenantId", "languageCode", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "product_translations_productListingId_languageCode_key" ON "product_translations"("productListingId", "languageCode");

-- CreateIndex
CREATE INDEX "category_translations_tenantId_idx" ON "category_translations"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "category_translations_categoryId_languageCode_key" ON "category_translations"("categoryId", "languageCode");

-- CreateIndex
CREATE INDEX "attribute_translations_tenantId_idx" ON "attribute_translations"("tenantId");

-- CreateIndex
CREATE INDEX "shipping_rate_translations_tenantId_idx" ON "shipping_rate_translations"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "shipping_rate_translations_shippingRateId_languageCode_key" ON "shipping_rate_translations"("shippingRateId", "languageCode");

-- CreateIndex
CREATE INDEX "content_translations_tenantId_languageCode_idx" ON "content_translations"("tenantId", "languageCode");

-- CreateIndex
CREATE UNIQUE INDEX "content_translations_tenantId_contentKey_languageCode_key" ON "content_translations"("tenantId", "contentKey", "languageCode");

-- CreateIndex
CREATE UNIQUE INDEX "store_customer_preferences_customerId_key" ON "store_customer_preferences"("customerId");

-- CreateIndex
CREATE INDEX "store_customer_preferences_tenantId_idx" ON "store_customer_preferences"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "store_customer_preferences_tenantId_customerId_key" ON "store_customer_preferences"("tenantId", "customerId");

-- CreateIndex
CREATE INDEX "email_bounces_tenantId_email_idx" ON "email_bounces"("tenantId", "email");

-- CreateIndex
CREATE INDEX "email_bounces_suppressed_idx" ON "email_bounces"("suppressed");

-- CreateIndex
CREATE INDEX "email_bounces_tenantId_suppressed_idx" ON "email_bounces"("tenantId", "suppressed");

-- CreateIndex
CREATE INDEX "store_themes_tenantId_isActive_idx" ON "store_themes"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX "store_themes_tenantId_isPreset_idx" ON "store_themes"("tenantId", "isPreset");

-- CreateIndex
CREATE UNIQUE INDEX "store_themes_tenantId_slug_key" ON "store_themes"("tenantId", "slug");

-- CreateIndex
CREATE INDEX "marketplace_connections_tenantId_platform_idx" ON "marketplace_connections"("tenantId", "platform");

-- CreateIndex
CREATE INDEX "marketplace_connections_tenantId_isActive_idx" ON "marketplace_connections"("tenantId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_connections_tenantId_platform_name_key" ON "marketplace_connections"("tenantId", "platform", "name");

-- CreateIndex
CREATE INDEX "marketplace_listings_tenantId_status_idx" ON "marketplace_listings"("tenantId", "status");

-- CreateIndex
CREATE INDEX "marketplace_listings_connectionId_idx" ON "marketplace_listings"("connectionId");

-- CreateIndex
CREATE INDEX "marketplace_listings_productListingId_idx" ON "marketplace_listings"("productListingId");

-- CreateIndex
CREATE INDEX "marketplace_listings_externalListingId_idx" ON "marketplace_listings"("externalListingId");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_listings_connectionId_sku_key" ON "marketplace_listings"("connectionId", "sku");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_listings_tenantId_externalOfferId_key" ON "marketplace_listings"("tenantId", "externalOfferId");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_listings_tenantId_externalListingId_key" ON "marketplace_listings"("tenantId", "externalListingId");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_orders_orderId_key" ON "marketplace_orders"("orderId");

-- CreateIndex
CREATE INDEX "marketplace_orders_tenantId_connectionId_idx" ON "marketplace_orders"("tenantId", "connectionId");

-- CreateIndex
CREATE INDEX "marketplace_orders_connectionId_syncStatus_idx" ON "marketplace_orders"("connectionId", "syncStatus");

-- CreateIndex
CREATE INDEX "marketplace_orders_externalOrderId_idx" ON "marketplace_orders"("externalOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_orders_tenantId_externalOrderId_key" ON "marketplace_orders"("tenantId", "externalOrderId");

-- CreateIndex
CREATE INDEX "marketplace_sync_logs_tenantId_connectionId_idx" ON "marketplace_sync_logs"("tenantId", "connectionId");

-- CreateIndex
CREATE INDEX "marketplace_sync_logs_syncType_status_idx" ON "marketplace_sync_logs"("syncType", "status");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_returns_externalReturnId_key" ON "marketplace_returns"("externalReturnId");

-- CreateIndex
CREATE INDEX "marketplace_returns_tenantId_connectionId_idx" ON "marketplace_returns"("tenantId", "connectionId");

-- CreateIndex
CREATE INDEX "marketplace_returns_externalReturnId_idx" ON "marketplace_returns"("externalReturnId");

-- CreateIndex
CREATE INDEX "marketplace_returns_externalOrderId_idx" ON "marketplace_returns"("externalOrderId");

-- CreateIndex
CREATE INDEX "marketplace_returns_tenantId_status_idx" ON "marketplace_returns"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_message_threads_externalThreadId_key" ON "marketplace_message_threads"("externalThreadId");

-- CreateIndex
CREATE INDEX "marketplace_message_threads_tenantId_connectionId_idx" ON "marketplace_message_threads"("tenantId", "connectionId");

-- CreateIndex
CREATE INDEX "marketplace_message_threads_tenantId_isRead_idx" ON "marketplace_message_threads"("tenantId", "isRead");

-- CreateIndex
CREATE INDEX "marketplace_message_threads_tenantId_status_idx" ON "marketplace_message_threads"("tenantId", "status");

-- CreateIndex
CREATE INDEX "marketplace_messages_tenantId_idx" ON "marketplace_messages"("tenantId");

-- CreateIndex
CREATE INDEX "marketplace_messages_threadId_sentDate_idx" ON "marketplace_messages"("threadId", "sentDate");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_messages_tenantId_externalMessageId_key" ON "marketplace_messages"("tenantId", "externalMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_campaigns_externalCampaignId_key" ON "marketplace_campaigns"("externalCampaignId");

-- CreateIndex
CREATE INDEX "marketplace_campaigns_tenantId_connectionId_idx" ON "marketplace_campaigns"("tenantId", "connectionId");

-- CreateIndex
CREATE INDEX "marketplace_campaigns_status_idx" ON "marketplace_campaigns"("status");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_violations_externalViolationId_key" ON "marketplace_violations"("externalViolationId");

-- CreateIndex
CREATE INDEX "marketplace_violations_tenantId_connectionId_idx" ON "marketplace_violations"("tenantId", "connectionId");

-- CreateIndex
CREATE INDEX "marketplace_violations_status_idx" ON "marketplace_violations"("status");

-- CreateIndex
CREATE INDEX "marketplace_violations_complianceType_idx" ON "marketplace_violations"("complianceType");

-- CreateIndex
CREATE INDEX "failed_operations_tenantId_status_idx" ON "failed_operations"("tenantId", "status");

-- CreateIndex
CREATE INDEX "failed_operations_nextRetryAt_idx" ON "failed_operations"("nextRetryAt");

-- CreateIndex
CREATE INDEX "failed_operations_referenceId_referenceType_idx" ON "failed_operations"("referenceId", "referenceType");

-- CreateIndex
CREATE INDEX "webhooks_tenantId_status_idx" ON "webhooks"("tenantId", "status");

-- CreateIndex
CREATE INDEX "webhook_deliveries_tenantId_createdAt_idx" ON "webhook_deliveries"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "webhook_deliveries_webhookId_createdAt_idx" ON "webhook_deliveries"("webhookId", "createdAt");

-- CreateIndex
CREATE INDEX "processed_webhook_events_tenantId_idx" ON "processed_webhook_events"("tenantId");

-- CreateIndex
CREATE INDEX "processed_webhook_events_eventId_idx" ON "processed_webhook_events"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "processed_webhook_events_tenantId_eventId_key" ON "processed_webhook_events"("tenantId", "eventId");

-- CreateIndex
CREATE INDEX "oauth_states_expiresAt_idx" ON "oauth_states"("expiresAt");

-- CreateIndex
CREATE INDEX "merchant_email_verification_tokens_tenantId_idx" ON "merchant_email_verification_tokens"("tenantId");

-- CreateIndex
CREATE INDEX "merchant_email_verification_tokens_userId_idx" ON "merchant_email_verification_tokens"("userId");

-- CreateIndex
CREATE INDEX "merchant_email_verification_tokens_token_idx" ON "merchant_email_verification_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "merchant_email_verification_tokens_tenantId_token_key" ON "merchant_email_verification_tokens"("tenantId", "token");

-- CreateIndex
CREATE INDEX "store_pages_tenantId_idx" ON "store_pages"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "store_pages_tenantId_slug_key" ON "store_pages"("tenantId", "slug");

-- CreateIndex
CREATE INDEX "product_import_jobs_tenantId_idx" ON "product_import_jobs"("tenantId");

-- CreateIndex
CREATE INDEX "background_jobs_tenantId_idx" ON "background_jobs"("tenantId");

-- CreateIndex
CREATE INDEX "background_jobs_status_scheduledAt_idx" ON "background_jobs"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "background_jobs_tenantId_type_idx" ON "background_jobs"("tenantId", "type");

-- CreateIndex
CREATE INDEX "notifications_tenantId_idx" ON "notifications"("tenantId");

-- CreateIndex
CREATE INDEX "notifications_tenantId_userId_idx" ON "notifications"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "notifications_tenantId_userId_isRead_idx" ON "notifications"("tenantId", "userId", "isRead");

-- CreateIndex
CREATE INDEX "notifications_tenantId_userId_createdAt_idx" ON "notifications"("tenantId", "userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");

-- CreateIndex
CREATE INDEX "refresh_tokens_token_idx" ON "refresh_tokens"("token");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");

-- CreateIndex
CREATE INDEX "refresh_tokens_customerId_idx" ON "refresh_tokens"("customerId");

-- CreateIndex
CREATE INDEX "refresh_tokens_expiresAt_idx" ON "refresh_tokens"("expiresAt");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doc_fields" ADD CONSTRAINT "doc_fields_docTypeName_fkey" FOREIGN KEY ("docTypeName") REFERENCES "doc_types"("name") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doc_perms" ADD CONSTRAINT "doc_perms_docTypeName_fkey" FOREIGN KEY ("docTypeName") REFERENCES "doc_types"("name") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "locations" ADD CONSTRAINT "locations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "locations" ADD CONSTRAINT "locations_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "locations" ADD CONSTRAINT "locations_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items" ADD CONSTRAINT "items_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items" ADD CONSTRAINT "items_stockUomCode_fkey" FOREIGN KEY ("stockUomCode") REFERENCES "uoms"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items" ADD CONSTRAINT "items_purchaseUomCode_fkey" FOREIGN KEY ("purchaseUomCode") REFERENCES "uoms"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items" ADD CONSTRAINT "items_salesUomCode_fkey" FOREIGN KEY ("salesUomCode") REFERENCES "uoms"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_uoms" ADD CONSTRAINT "item_uoms_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_uoms" ADD CONSTRAINT "item_uoms_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_uoms" ADD CONSTRAINT "item_uoms_uomCode_fkey" FOREIGN KEY ("uomCode") REFERENCES "uoms"("code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "serials" ADD CONSTRAINT "serials_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "serials" ADD CONSTRAINT "serials_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "serials" ADD CONSTRAINT "serials_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "serials" ADD CONSTRAINT "serials_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "serials" ADD CONSTRAINT "serials_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batches" ADD CONSTRAINT "batches_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batches" ADD CONSTRAINT "batches_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_item_balances" ADD CONSTRAINT "warehouse_item_balances_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_item_balances" ADD CONSTRAINT "warehouse_item_balances_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_item_balances" ADD CONSTRAINT "warehouse_item_balances_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bin_balances" ADD CONSTRAINT "bin_balances_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bin_balances" ADD CONSTRAINT "bin_balances_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bin_balances" ADD CONSTRAINT "bin_balances_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bin_balances" ADD CONSTRAINT "bin_balances_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bin_balances" ADD CONSTRAINT "bin_balances_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_fifo_layers" ADD CONSTRAINT "stock_fifo_layers_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_fifo_layers" ADD CONSTRAINT "stock_fifo_layers_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_fifo_layers" ADD CONSTRAINT "stock_fifo_layers_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_fifo_layers" ADD CONSTRAINT "stock_fifo_layers_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_fifo_layers" ADD CONSTRAINT "stock_fifo_layers_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_fifo_layers" ADD CONSTRAINT "stock_fifo_layers_sourceLayerId_fkey" FOREIGN KEY ("sourceLayerId") REFERENCES "stock_fifo_layers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_postings" ADD CONSTRAINT "stock_postings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_ledger_entries" ADD CONSTRAINT "stock_ledger_entries_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_ledger_entries" ADD CONSTRAINT "stock_ledger_entries_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_ledger_entries" ADD CONSTRAINT "stock_ledger_entries_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_ledger_entries" ADD CONSTRAINT "stock_ledger_entries_fromLocationId_fkey" FOREIGN KEY ("fromLocationId") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_ledger_entries" ADD CONSTRAINT "stock_ledger_entries_toLocationId_fkey" FOREIGN KEY ("toLocationId") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_ledger_entries" ADD CONSTRAINT "stock_ledger_entries_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_ledger_entries" ADD CONSTRAINT "stock_ledger_entries_fifoLayerId_fkey" FOREIGN KEY ("fifoLayerId") REFERENCES "stock_fifo_layers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_ledger_entry_serials" ADD CONSTRAINT "stock_ledger_entry_serials_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_ledger_entry_serials" ADD CONSTRAINT "stock_ledger_entry_serials_ledgerEntryId_fkey" FOREIGN KEY ("ledgerEntryId") REFERENCES "stock_ledger_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_ledger_entry_serials" ADD CONSTRAINT "stock_ledger_entry_serials_serialId_fkey" FOREIGN KEY ("serialId") REFERENCES "serials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gl_entries" ADD CONSTRAINT "gl_entries_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gl_entries" ADD CONSTRAINT "gl_entries_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_links" ADD CONSTRAINT "contact_links_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_links" ADD CONSTRAINT "contact_links_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "banks" ADD CONSTRAINT "banks_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_reconciliations" ADD CONSTRAINT "bank_reconciliations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_reconciliation_details" ADD CONSTRAINT "bank_reconciliation_details_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_reconciliation_details" ADD CONSTRAINT "bank_reconciliation_details_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "bank_reconciliations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_matching_rules" ADD CONSTRAINT "bank_matching_rules_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "product_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_listings" ADD CONSTRAINT "product_listings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_listings" ADD CONSTRAINT "product_listings_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_listings" ADD CONSTRAINT "product_listings_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "product_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_customers" ADD CONSTRAINT "store_customers_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_customers" ADD CONSTRAINT "store_customers_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_addresses" ADD CONSTRAINT "store_addresses_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_addresses" ADD CONSTRAINT "store_addresses_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "store_customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_resets" ADD CONSTRAINT "password_resets_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_resets" ADD CONSTRAINT "password_resets_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "store_customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_verification_tokens" ADD CONSTRAINT "email_verification_tokens_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_verification_tokens" ADD CONSTRAINT "email_verification_tokens_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "store_customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carts" ADD CONSTRAINT "carts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carts" ADD CONSTRAINT "carts_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "store_customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "carts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "store_customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "carts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product_listings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_giftCardId_fkey" FOREIGN KEY ("giftCardId") REFERENCES "gift_cards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_usages" ADD CONSTRAINT "coupon_usages_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_usages" ADD CONSTRAINT "coupon_usages_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "coupons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_usages" ADD CONSTRAINT "coupon_usages_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "store_customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_usages" ADD CONSTRAINT "coupon_usages_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_attribute_types" ADD CONSTRAINT "item_attribute_types_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_attribute_values" ADD CONSTRAINT "item_attribute_values_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_attribute_values" ADD CONSTRAINT "item_attribute_values_attributeTypeId_fkey" FOREIGN KEY ("attributeTypeId") REFERENCES "item_attribute_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_productListingId_fkey" FOREIGN KEY ("productListingId") REFERENCES "product_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variant_attributes" ADD CONSTRAINT "product_variant_attributes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variant_attributes" ADD CONSTRAINT "product_variant_attributes_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variant_attributes" ADD CONSTRAINT "product_variant_attributes_attributeTypeId_fkey" FOREIGN KEY ("attributeTypeId") REFERENCES "item_attribute_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variant_attributes" ADD CONSTRAINT "product_variant_attributes_attributeValueId_fkey" FOREIGN KEY ("attributeValueId") REFERENCES "item_attribute_values"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_productListingId_fkey" FOREIGN KEY ("productListingId") REFERENCES "product_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "store_customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_votes" ADD CONSTRAINT "review_votes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_votes" ADD CONSTRAINT "review_votes_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "product_reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gift_cards" ADD CONSTRAINT "gift_cards_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gift_cards" ADD CONSTRAINT "gift_cards_sourceOrderId_fkey" FOREIGN KEY ("sourceOrderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gift_card_transactions" ADD CONSTRAINT "gift_card_transactions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gift_card_transactions" ADD CONSTRAINT "gift_card_transactions_giftCardId_fkey" FOREIGN KEY ("giftCardId") REFERENCES "gift_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gift_card_transactions" ADD CONSTRAINT "gift_card_transactions_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishlists" ADD CONSTRAINT "wishlists_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishlists" ADD CONSTRAINT "wishlists_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "store_customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_wishlistId_fkey" FOREIGN KEY ("wishlistId") REFERENCES "wishlists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_productListingId_fkey" FOREIGN KEY ("productListingId") REFERENCES "product_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_currencies" ADD CONSTRAINT "store_currencies_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_price_overrides" ADD CONSTRAINT "product_price_overrides_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_price_overrides" ADD CONSTRAINT "product_price_overrides_productListingId_fkey" FOREIGN KEY ("productListingId") REFERENCES "product_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variant_price_overrides" ADD CONSTRAINT "variant_price_overrides_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variant_price_overrides" ADD CONSTRAINT "variant_price_overrides_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipping_carriers" ADD CONSTRAINT "shipping_carriers_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipping_zones" ADD CONSTRAINT "shipping_zones_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipping_rates" ADD CONSTRAINT "shipping_rates_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipping_rates" ADD CONSTRAINT "shipping_rates_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "shipping_zones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipping_rates" ADD CONSTRAINT "shipping_rates_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "shipping_carriers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipping_weight_tiers" ADD CONSTRAINT "shipping_weight_tiers_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipping_weight_tiers" ADD CONSTRAINT "shipping_weight_tiers_rateId_fkey" FOREIGN KEY ("rateId") REFERENCES "shipping_rates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "shipping_carriers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_events" ADD CONSTRAINT "shipment_events_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_events" ADD CONSTRAINT "shipment_events_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_languages" ADD CONSTRAINT "store_languages_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_translations" ADD CONSTRAINT "product_translations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_translations" ADD CONSTRAINT "product_translations_productListingId_fkey" FOREIGN KEY ("productListingId") REFERENCES "product_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_translations" ADD CONSTRAINT "category_translations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_translations" ADD CONSTRAINT "category_translations_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "product_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attribute_translations" ADD CONSTRAINT "attribute_translations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attribute_translations" ADD CONSTRAINT "attribute_translations_attributeTypeId_fkey" FOREIGN KEY ("attributeTypeId") REFERENCES "item_attribute_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attribute_translations" ADD CONSTRAINT "attribute_translations_attributeValueId_fkey" FOREIGN KEY ("attributeValueId") REFERENCES "item_attribute_values"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipping_rate_translations" ADD CONSTRAINT "shipping_rate_translations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipping_rate_translations" ADD CONSTRAINT "shipping_rate_translations_shippingRateId_fkey" FOREIGN KEY ("shippingRateId") REFERENCES "shipping_rates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_translations" ADD CONSTRAINT "content_translations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_customer_preferences" ADD CONSTRAINT "store_customer_preferences_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_customer_preferences" ADD CONSTRAINT "store_customer_preferences_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "store_customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_bounces" ADD CONSTRAINT "email_bounces_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_themes" ADD CONSTRAINT "store_themes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_connections" ADD CONSTRAINT "marketplace_connections_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_listings" ADD CONSTRAINT "marketplace_listings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_listings" ADD CONSTRAINT "marketplace_listings_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "marketplace_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_listings" ADD CONSTRAINT "marketplace_listings_productListingId_fkey" FOREIGN KEY ("productListingId") REFERENCES "product_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_listings" ADD CONSTRAINT "marketplace_listings_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_listings" ADD CONSTRAINT "marketplace_listings_parentListingId_fkey" FOREIGN KEY ("parentListingId") REFERENCES "marketplace_listings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_listings" ADD CONSTRAINT "marketplace_listings_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_listings" ADD CONSTRAINT "marketplace_listings_rejectedById_fkey" FOREIGN KEY ("rejectedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_orders" ADD CONSTRAINT "marketplace_orders_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_orders" ADD CONSTRAINT "marketplace_orders_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "marketplace_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_orders" ADD CONSTRAINT "marketplace_orders_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_sync_logs" ADD CONSTRAINT "marketplace_sync_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_sync_logs" ADD CONSTRAINT "marketplace_sync_logs_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "marketplace_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_returns" ADD CONSTRAINT "marketplace_returns_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_returns" ADD CONSTRAINT "marketplace_returns_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "marketplace_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_returns" ADD CONSTRAINT "marketplace_returns_marketplaceOrderId_fkey" FOREIGN KEY ("marketplaceOrderId") REFERENCES "marketplace_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_message_threads" ADD CONSTRAINT "marketplace_message_threads_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_message_threads" ADD CONSTRAINT "marketplace_message_threads_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "marketplace_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_messages" ADD CONSTRAINT "marketplace_messages_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_messages" ADD CONSTRAINT "marketplace_messages_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "marketplace_message_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_campaigns" ADD CONSTRAINT "marketplace_campaigns_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_campaigns" ADD CONSTRAINT "marketplace_campaigns_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "marketplace_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_violations" ADD CONSTRAINT "marketplace_violations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_violations" ADD CONSTRAINT "marketplace_violations_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "marketplace_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "failed_operations" ADD CONSTRAINT "failed_operations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_webhookId_fkey" FOREIGN KEY ("webhookId") REFERENCES "webhooks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processed_webhook_events" ADD CONSTRAINT "processed_webhook_events_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oauth_states" ADD CONSTRAINT "oauth_states_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_email_verification_tokens" ADD CONSTRAINT "merchant_email_verification_tokens_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_email_verification_tokens" ADD CONSTRAINT "merchant_email_verification_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_pages" ADD CONSTRAINT "store_pages_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_import_jobs" ADD CONSTRAINT "product_import_jobs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "background_jobs" ADD CONSTRAINT "background_jobs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "store_customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

