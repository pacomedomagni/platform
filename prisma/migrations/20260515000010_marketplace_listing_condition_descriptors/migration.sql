-- H3: eBay's January 2025 rollout requires structured condition
-- descriptors for many used-item categories — free-text
-- `conditionDescription` alone no longer satisfies the validation.
--
-- The structured form is an array shaped like:
--   [{ "name": "Working condition", "values": [{ "name": "Tested" }],
--      "additionalInfo": "..." }, ...]
--
-- We store the raw payload as JSON so the listings service can pass it
-- straight through to product.conditionDescriptors on createOrReplaceInventoryItem.
-- Categories that don't yet require structured descriptors continue to
-- work with the legacy `conditionDescription` text column.

ALTER TABLE "marketplace_listings"
  ADD COLUMN "conditionDescriptors" JSONB;
