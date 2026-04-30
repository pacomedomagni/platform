-- M8: digital-goods eBay orders ship no physical address. Storing empty
-- strings as a workaround propagated blank addresses into the unified
-- Order pipeline and downstream shipping integrations. Make every
-- shipping-address column nullable so the absence of an address is
-- represented as NULL rather than ''.

ALTER TABLE "marketplace_orders"
  ALTER COLUMN "shippingName" DROP NOT NULL,
  ALTER COLUMN "shippingStreet1" DROP NOT NULL,
  ALTER COLUMN "shippingCity" DROP NOT NULL,
  ALTER COLUMN "shippingPostalCode" DROP NOT NULL,
  ALTER COLUMN "shippingCountry" DROP NOT NULL;
