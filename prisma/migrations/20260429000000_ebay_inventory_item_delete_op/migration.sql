-- H4: eBay's offer purge is asynchronous. After publishListing rolls back a
-- partially-created listing (withdraw offer + delete inventory item), the
-- inventory-item delete frequently fails with "inventory item is referenced
-- by an offer" because eBay hasn't finished tearing the offer down yet.
-- Routing those failures to the failed-operations queue lets the retry
-- cron eventually clean them up instead of leaving orphans in the seller's
-- eBay inventory.

ALTER TYPE "OperationType" ADD VALUE 'EBAY_INVENTORY_ITEM_DELETE';
