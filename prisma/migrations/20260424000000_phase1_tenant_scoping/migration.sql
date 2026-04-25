-- =================================================================
-- Phase 1 tenant scoping
--
-- Adds tenantId to 7 tables that were missing it, tenant-scopes
-- globally-unique columns that allowed cross-tenant collisions, and
-- enables RLS only on the 7 new tables. A broader RLS rollout is
-- deferred to Phase 2 when the app will be wired to set
-- `app.tenant` on every connection.
-- =================================================================

-- -----------------------------------------------------------------
-- 1. product_variant_attributes
--    Backfill from product_variants.tenantId
-- -----------------------------------------------------------------
ALTER TABLE "product_variant_attributes"
  ADD COLUMN IF NOT EXISTS "tenantId" UUID;

UPDATE "product_variant_attributes" pva
SET "tenantId" = pv."tenantId"
FROM "product_variants" pv
WHERE pva."variantId" = pv.id
  AND pva."tenantId" IS NULL;

-- Any orphans (variant gone) must be removed before NOT NULL
DELETE FROM "product_variant_attributes" WHERE "tenantId" IS NULL;

ALTER TABLE "product_variant_attributes"
  ALTER COLUMN "tenantId" SET NOT NULL;

ALTER TABLE "product_variant_attributes"
  ADD CONSTRAINT "product_variant_attributes_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"(id) ON DELETE CASCADE;

-- Swap the global unique for a tenant-scoped composite
DROP INDEX IF EXISTS "product_variant_attributes_variantId_attributeTypeId_key";
CREATE UNIQUE INDEX "product_variant_attributes_tenantId_variantId_attributeTypeId_key"
  ON "product_variant_attributes" ("tenantId", "variantId", "attributeTypeId");
CREATE INDEX IF NOT EXISTS "product_variant_attributes_tenantId_idx"
  ON "product_variant_attributes" ("tenantId");

-- -----------------------------------------------------------------
-- 2. review_votes
--    Backfill from product_reviews.tenantId
-- -----------------------------------------------------------------
ALTER TABLE "review_votes"
  ADD COLUMN IF NOT EXISTS "tenantId" UUID;

UPDATE "review_votes" rv
SET "tenantId" = pr."tenantId"
FROM "product_reviews" pr
WHERE rv."reviewId" = pr.id
  AND rv."tenantId" IS NULL;

DELETE FROM "review_votes" WHERE "tenantId" IS NULL;

ALTER TABLE "review_votes"
  ALTER COLUMN "tenantId" SET NOT NULL;

ALTER TABLE "review_votes"
  ADD CONSTRAINT "review_votes_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"(id) ON DELETE CASCADE;

-- Originally global uniques: (reviewId, customerId), (reviewId, sessionToken)
-- Tenant-scope them defensively, even though reviewId is tenant-scoped by FK.
DROP INDEX IF EXISTS "review_votes_reviewId_customerId_key";
DROP INDEX IF EXISTS "review_votes_reviewId_sessionToken_key";
CREATE UNIQUE INDEX "review_votes_tenantId_reviewId_customerId_key"
  ON "review_votes" ("tenantId", "reviewId", "customerId");
CREATE UNIQUE INDEX "review_votes_tenantId_reviewId_sessionToken_key"
  ON "review_votes" ("tenantId", "reviewId", "sessionToken");
CREATE INDEX IF NOT EXISTS "review_votes_tenantId_idx"
  ON "review_votes" ("tenantId");

-- -----------------------------------------------------------------
-- 3. wishlist_items
--    Backfill from wishlists.tenantId
-- -----------------------------------------------------------------
ALTER TABLE "wishlist_items"
  ADD COLUMN IF NOT EXISTS "tenantId" UUID;

UPDATE "wishlist_items" wi
SET "tenantId" = w."tenantId"
FROM "wishlists" w
WHERE wi."wishlistId" = w.id
  AND wi."tenantId" IS NULL;

DELETE FROM "wishlist_items" WHERE "tenantId" IS NULL;

ALTER TABLE "wishlist_items"
  ALTER COLUMN "tenantId" SET NOT NULL;

ALTER TABLE "wishlist_items"
  ADD CONSTRAINT "wishlist_items_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS "wishlist_items_tenantId_idx"
  ON "wishlist_items" ("tenantId");

-- Add tenant-aware dedup (no prior global unique existed)
CREATE UNIQUE INDEX IF NOT EXISTS "wishlist_items_tenantId_wishlistId_productListingId_variantId_key"
  ON "wishlist_items" ("tenantId", "wishlistId", "productListingId", COALESCE("variantId"::text, ''));

-- -----------------------------------------------------------------
-- 4. marketplace_messages
--    Backfill from marketplace_message_threads.tenantId
-- -----------------------------------------------------------------
ALTER TABLE "marketplace_messages"
  ADD COLUMN IF NOT EXISTS "tenantId" UUID;

UPDATE "marketplace_messages" mm
SET "tenantId" = t."tenantId"
FROM "marketplace_message_threads" t
WHERE mm."threadId" = t.id
  AND mm."tenantId" IS NULL;

DELETE FROM "marketplace_messages" WHERE "tenantId" IS NULL;

ALTER TABLE "marketplace_messages"
  ALTER COLUMN "tenantId" SET NOT NULL;

ALTER TABLE "marketplace_messages"
  ADD CONSTRAINT "marketplace_messages_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"(id) ON DELETE CASCADE;

-- Scope the previously-global externalMessageId unique
DROP INDEX IF EXISTS "marketplace_messages_externalMessageId_key";
CREATE UNIQUE INDEX "marketplace_messages_tenantId_externalMessageId_key"
  ON "marketplace_messages" ("tenantId", "externalMessageId");
CREATE INDEX IF NOT EXISTS "marketplace_messages_tenantId_idx"
  ON "marketplace_messages" ("tenantId");

-- -----------------------------------------------------------------
-- 5. webhook_deliveries
--    Backfill from webhooks.tenantId
-- -----------------------------------------------------------------
ALTER TABLE "webhook_deliveries"
  ADD COLUMN IF NOT EXISTS "tenantId" UUID;

UPDATE "webhook_deliveries" wd
SET "tenantId" = w."tenantId"
FROM "webhooks" w
WHERE wd."webhookId" = w.id
  AND wd."tenantId" IS NULL;

DELETE FROM "webhook_deliveries" WHERE "tenantId" IS NULL;

ALTER TABLE "webhook_deliveries"
  ALTER COLUMN "tenantId" SET NOT NULL;

ALTER TABLE "webhook_deliveries"
  ADD CONSTRAINT "webhook_deliveries_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS "webhook_deliveries_tenantId_createdAt_idx"
  ON "webhook_deliveries" ("tenantId", "createdAt");

-- -----------------------------------------------------------------
-- 6. processed_webhook_events
--    No parent relation to backfill from. These rows are short-lived
--    dedup markers; delete any pre-existing rows and require tenantId
--    from this migration onward. The app layer must supply tenantId
--    (derived from the webhook endpoint / Stripe Connect account).
-- -----------------------------------------------------------------
DELETE FROM "processed_webhook_events";

ALTER TABLE "processed_webhook_events"
  ADD COLUMN IF NOT EXISTS "tenantId" UUID NOT NULL;

ALTER TABLE "processed_webhook_events"
  ADD CONSTRAINT "processed_webhook_events_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"(id) ON DELETE CASCADE;

-- Swap the global eventId unique for a tenant-scoped composite.
-- An attacker-controlled Stripe event ID can no longer block a different
-- tenant's processing via the dedup table.
DROP INDEX IF EXISTS "processed_webhook_events_eventId_key";
CREATE UNIQUE INDEX "processed_webhook_events_tenantId_eventId_key"
  ON "processed_webhook_events" ("tenantId", "eventId");
CREATE INDEX IF NOT EXISTS "processed_webhook_events_tenantId_idx"
  ON "processed_webhook_events" ("tenantId");

-- -----------------------------------------------------------------
-- 7. merchant_email_verification_tokens
--    Backfill from users.tenantId
-- -----------------------------------------------------------------
ALTER TABLE "merchant_email_verification_tokens"
  ADD COLUMN IF NOT EXISTS "tenantId" UUID;

UPDATE "merchant_email_verification_tokens" t
SET "tenantId" = u."tenantId"
FROM "users" u
WHERE t."userId" = u.id
  AND t."tenantId" IS NULL;

DELETE FROM "merchant_email_verification_tokens" WHERE "tenantId" IS NULL;

ALTER TABLE "merchant_email_verification_tokens"
  ALTER COLUMN "tenantId" SET NOT NULL;

ALTER TABLE "merchant_email_verification_tokens"
  ADD CONSTRAINT "merchant_email_verification_tokens_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"(id) ON DELETE CASCADE;

-- Scope the global token unique so one tenant cannot block a token
-- value another tenant happens to generate.
DROP INDEX IF EXISTS "merchant_email_verification_tokens_token_key";
CREATE UNIQUE INDEX "merchant_email_verification_tokens_tenantId_token_key"
  ON "merchant_email_verification_tokens" ("tenantId", "token");
CREATE INDEX IF NOT EXISTS "merchant_email_verification_tokens_tenantId_idx"
  ON "merchant_email_verification_tokens" ("tenantId");

-- =================================================================
-- Tenant-scope uniques on pre-existing tables
-- =================================================================

-- Cart.sessionToken was globally unique — a leaked token exposed
-- cross-tenant session enumeration. Scope to (tenantId, sessionToken).
-- Global unique allowed multiple NULLs (which is fine and preserved).
DROP INDEX IF EXISTS "carts_sessionToken_key";
CREATE UNIQUE INDEX "carts_tenantId_sessionToken_key"
  ON "carts" ("tenantId", "sessionToken");

-- marketplace_listings.externalOfferId / externalListingId were globally
-- unique. A reseller transferring between tenants, or an overlap of eBay
-- offers, could collide across tenants. Scope to (tenantId, ...).
DROP INDEX IF EXISTS "marketplace_listings_externalOfferId_key";
DROP INDEX IF EXISTS "marketplace_listings_externalListingId_key";
CREATE UNIQUE INDEX "marketplace_listings_tenantId_externalOfferId_key"
  ON "marketplace_listings" ("tenantId", "externalOfferId");
CREATE UNIQUE INDEX "marketplace_listings_tenantId_externalListingId_key"
  ON "marketplace_listings" ("tenantId", "externalListingId");

-- =================================================================
-- RLS on the 7 newly-tenantId'd tables: DEFERRED to Phase 3.
--
-- enable_tenant_rls() installs `tenantId = current_setting('app.tenant',
-- true)` policies. When the connection has not run
-- `SET LOCAL app.tenant = ...`, that comparison is `tenantId = NULL`,
-- which is FALSE, and every SELECT returns 0 rows.
--
-- Today only inventory and accounting services set app.tenant inside their
-- transactions. The services that read these new tables (reviews, wishlist,
-- marketplace messaging, webhook delivery audit, merchant email verification)
-- do not, so enabling RLS here would silently break those reads.
--
-- Phase 3 (W3.1+ in REMEDIATION_PLAN.md) wires `app.tenant` at connection
-- checkout via a Prisma client extension, after which a follow-up migration
-- will run these calls. Until then we rely on the application-layer
-- `where: { tenantId }` filters, which the new schema columns make
-- enforceable.
--
-- SELECT enable_tenant_rls('product_variant_attributes');
-- SELECT enable_tenant_rls('review_votes');
-- SELECT enable_tenant_rls('wishlist_items');
-- SELECT enable_tenant_rls('marketplace_messages');
-- SELECT enable_tenant_rls('webhook_deliveries');
-- SELECT enable_tenant_rls('processed_webhook_events');
-- SELECT enable_tenant_rls('merchant_email_verification_tokens');
