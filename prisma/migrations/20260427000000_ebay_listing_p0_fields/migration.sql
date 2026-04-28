-- P0 eBay listing form fields:
--   handlingTimeDays  — overrides the linked fulfillment policy's handling time
--   shippingCostType  — FLAT_RATE | CALCULATED | NOT_SPECIFIED | FREIGHT
--   shippingServices  — repeater of per-listing shipping service overrides
-- All three are wired through a lazy-clone of the base fulfillment policy
-- at publish time, so the eBay account's saved policies stay untouched.

ALTER TABLE "marketplace_listings" ADD COLUMN "handlingTimeDays" INTEGER;
ALTER TABLE "marketplace_listings" ADD COLUMN "shippingCostType" TEXT;
ALTER TABLE "marketplace_listings" ADD COLUMN "shippingServices" JSONB;
