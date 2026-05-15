-- =================================================================
-- M4: normalized order line items for sales-attribution analytics.
--
-- MarketplaceOrder keeps `itemsData` (raw JSON) as the forensic source of
-- truth — eBay's exact payload. This table is the join-friendly form
-- that lets reports answer "how much GMV did listing X generate?"
-- without parsing JSON on every query.
--
-- listingId is nullable: an order can reference a SKU whose local
-- listing was deleted or was created in a sibling tenant. The line is
-- still recorded so finance totals remain reconcilable.
-- =================================================================

CREATE TABLE "marketplace_order_line_items" (
    "id"                 TEXT PRIMARY KEY,
    "tenantId"           TEXT NOT NULL,
    "orderId"            TEXT NOT NULL,
    "listingId"          TEXT,
    "externalLineItemId" TEXT NOT NULL,
    "externalItemId"     TEXT,
    "sku"                TEXT NOT NULL,
    "title"              TEXT NOT NULL,
    "quantity"           INTEGER NOT NULL,
    "unitPrice"          DECIMAL(18,2) NOT NULL,
    "lineTotal"          DECIMAL(18,2) NOT NULL,
    "currency"           TEXT NOT NULL DEFAULT 'USD',
    "soldAt"             TIMESTAMP(3) NOT NULL,
    "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marketplace_order_line_items_tenantId_fkey"
        FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "marketplace_order_line_items_orderId_fkey"
        FOREIGN KEY ("orderId") REFERENCES "marketplace_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "marketplace_order_line_items_listingId_fkey"
        FOREIGN KEY ("listingId") REFERENCES "marketplace_listings"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Idempotency: re-syncing an order must not duplicate its line rows.
CREATE UNIQUE INDEX "marketplace_order_line_items_tenant_order_extId_key"
    ON "marketplace_order_line_items"("tenantId", "orderId", "externalLineItemId");

-- Analytics hot paths
CREATE INDEX "marketplace_order_line_items_tenant_listing_soldAt_idx"
    ON "marketplace_order_line_items"("tenantId", "listingId", "soldAt");
CREATE INDEX "marketplace_order_line_items_tenant_sku_soldAt_idx"
    ON "marketplace_order_line_items"("tenantId", "sku", "soldAt");
CREATE INDEX "marketplace_order_line_items_orderId_idx"
    ON "marketplace_order_line_items"("orderId");
