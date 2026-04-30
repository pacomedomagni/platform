-- C1/C2: A multi-variation eBay listing is one listing serving N variants.
-- Every variant row legitimately carries the same group listingId, so the
-- unique constraint on (tenantId, externalListingId) is wrong by design —
-- it would reject any insert past the first variant. Per-variant uniqueness
-- already lives on externalOfferId.

DROP INDEX IF EXISTS "marketplace_listings_tenantId_externalListingId_key";

CREATE INDEX IF NOT EXISTS "marketplace_listings_tenantId_externalListingId_idx"
  ON "marketplace_listings" ("tenantId", "externalListingId");
