-- Add deletedAt soft-delete column + tenant-scoped index to ProductReview, StoreTheme, ShippingZone.
-- This replaces the deferred-DELETE-with-undo UX trick with true server-side soft delete + restore.

ALTER TABLE "product_reviews" ADD COLUMN "deletedAt" TIMESTAMP(3);
CREATE INDEX "product_reviews_tenantId_deletedAt_idx" ON "product_reviews"("tenantId", "deletedAt");

ALTER TABLE "store_themes"    ADD COLUMN "deletedAt" TIMESTAMP(3);
CREATE INDEX "store_themes_tenantId_deletedAt_idx"   ON "store_themes"("tenantId", "deletedAt");

ALTER TABLE "shipping_zones"  ADD COLUMN "deletedAt" TIMESTAMP(3);
CREATE INDEX "shipping_zones_tenantId_deletedAt_idx" ON "shipping_zones"("tenantId", "deletedAt");
