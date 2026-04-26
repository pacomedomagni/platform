-- Persist the shopper's chosen cart-page shipping estimate so it survives
-- device-switch and feeds checkout pre-fill instead of being lost in
-- client-side store. Shape is documented in schema.prisma.

ALTER TABLE "carts" ADD COLUMN "shippingEstimate" JSONB;
