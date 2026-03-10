-- ============================================================
-- Marketplace Full Integration Migration
-- Creates all marketplace tables and adds new columns to
-- existing marketplace_listings for auction, best offer,
-- multi-variation, and extended listing fields.
-- ============================================================

-- ============================================
-- 1. Create marketplace_connections table
-- ============================================
CREATE TABLE "marketplace_connections" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "access_token_expiry" TIMESTAMP(3),
    "platform_config" JSONB NOT NULL DEFAULT '{}',
    "marketplace_id" TEXT,
    "site_id" INTEGER,
    "fulfillment_policy_id" TEXT,
    "payment_policy_id" TEXT,
    "return_policy_id" TEXT,
    "location_key" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_connected" BOOLEAN NOT NULL DEFAULT false,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "auto_sync_inventory" BOOLEAN NOT NULL DEFAULT true,
    "auto_sync_orders" BOOLEAN NOT NULL DEFAULT true,
    "last_sync_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketplace_connections_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "marketplace_connections_tenant_id_platform_name_key" ON "marketplace_connections"("tenant_id", "platform", "name");
CREATE INDEX "marketplace_connections_tenant_id_platform_idx" ON "marketplace_connections"("tenant_id", "platform");
CREATE INDEX "marketplace_connections_tenant_id_is_active_idx" ON "marketplace_connections"("tenant_id", "is_active");

ALTER TABLE "marketplace_connections" ADD CONSTRAINT "marketplace_connections_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================
-- 2. Create marketplace_listings table
-- ============================================
CREATE TABLE "marketplace_listings" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "connection_id" TEXT NOT NULL,
    "product_listing_id" TEXT NOT NULL,
    "warehouse_id" TEXT,
    "external_offer_id" TEXT,
    "external_listing_id" TEXT,
    "external_item_id" TEXT,
    "sku" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "description" TEXT NOT NULL,
    "price" DECIMAL(18,2) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "condition" TEXT NOT NULL,
    "condition_description" TEXT,
    "category_id" TEXT NOT NULL,
    "secondary_category_id" TEXT,
    "private_listing" BOOLEAN NOT NULL DEFAULT false,
    "lot_size" INTEGER,
    "epid" TEXT,
    "item_location_city" TEXT,
    "item_location_state" TEXT,
    "item_location_postal_code" TEXT,
    "item_location_country" TEXT,
    "format" TEXT NOT NULL DEFAULT 'FIXED_PRICE',
    "start_price" DECIMAL(18,2),
    "reserve_price" DECIMAL(18,2),
    "buy_it_now_price" DECIMAL(18,2),
    "listing_duration" TEXT,
    "best_offer_enabled" BOOLEAN NOT NULL DEFAULT false,
    "auto_accept_price" DECIMAL(18,2),
    "auto_decline_price" DECIMAL(18,2),
    "is_variation" BOOLEAN NOT NULL DEFAULT false,
    "parent_listing_id" TEXT,
    "inventory_group_key" TEXT,
    "variant_aspects" JSONB,
    "platform_data" JSONB NOT NULL DEFAULT '{}',
    "photos" JSONB NOT NULL DEFAULT '[]',
    "item_specifics" JSONB,
    "package_type" TEXT,
    "weight_value" DECIMAL(18,4),
    "weight_unit" TEXT,
    "dimension_length" DECIMAL(18,4),
    "dimension_width" DECIMAL(18,4),
    "dimension_height" DECIMAL(18,4),
    "dimension_unit" TEXT,
    "fulfillment_policy_id" TEXT,
    "payment_policy_id" TEXT,
    "return_policy_id" TEXT,
    "status" TEXT NOT NULL,
    "sync_status" TEXT NOT NULL DEFAULT 'pending',
    "error_message" TEXT,
    "approved_by_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "rejected_by_id" TEXT,
    "rejected_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "inventory_item_payload" JSONB,
    "offer_payload" JSONB,
    "publish_result" JSONB,
    "published_at" TIMESTAMP(3),
    "ended_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketplace_listings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "marketplace_listings_external_offer_id_key" ON "marketplace_listings"("external_offer_id");
CREATE UNIQUE INDEX "marketplace_listings_external_listing_id_key" ON "marketplace_listings"("external_listing_id");
CREATE UNIQUE INDEX "marketplace_listings_connection_id_sku_key" ON "marketplace_listings"("connection_id", "sku");
CREATE INDEX "marketplace_listings_tenant_id_status_idx" ON "marketplace_listings"("tenant_id", "status");
CREATE INDEX "marketplace_listings_connection_id_idx" ON "marketplace_listings"("connection_id");
CREATE INDEX "marketplace_listings_product_listing_id_idx" ON "marketplace_listings"("product_listing_id");
CREATE INDEX "marketplace_listings_external_listing_id_idx" ON "marketplace_listings"("external_listing_id");

ALTER TABLE "marketplace_listings" ADD CONSTRAINT "marketplace_listings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "marketplace_listings" ADD CONSTRAINT "marketplace_listings_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "marketplace_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "marketplace_listings" ADD CONSTRAINT "marketplace_listings_product_listing_id_fkey" FOREIGN KEY ("product_listing_id") REFERENCES "product_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "marketplace_listings" ADD CONSTRAINT "marketplace_listings_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "marketplace_listings" ADD CONSTRAINT "marketplace_listings_parent_listing_id_fkey" FOREIGN KEY ("parent_listing_id") REFERENCES "marketplace_listings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "marketplace_listings" ADD CONSTRAINT "marketplace_listings_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "marketplace_listings" ADD CONSTRAINT "marketplace_listings_rejected_by_id_fkey" FOREIGN KEY ("rejected_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================
-- 3. Create marketplace_orders table
-- ============================================
CREATE TABLE "marketplace_orders" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "connection_id" TEXT NOT NULL,
    "order_id" TEXT,
    "external_order_id" TEXT NOT NULL,
    "buyer_username" TEXT NOT NULL,
    "buyer_email" TEXT,
    "shipping_name" TEXT NOT NULL,
    "shipping_street1" TEXT NOT NULL,
    "shipping_street2" TEXT,
    "shipping_city" TEXT NOT NULL,
    "shipping_state" TEXT,
    "shipping_postal_code" TEXT NOT NULL,
    "shipping_country" TEXT NOT NULL,
    "subtotal" DECIMAL(18,2) NOT NULL,
    "shipping_cost" DECIMAL(18,2) NOT NULL,
    "tax_amount" DECIMAL(18,2) NOT NULL,
    "total" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "external_status" TEXT NOT NULL,
    "payment_status" TEXT NOT NULL,
    "fulfillment_status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "order_date" TIMESTAMP(3) NOT NULL,
    "payment_date" TIMESTAMP(3),
    "sync_status" TEXT NOT NULL DEFAULT 'pending',
    "synced_to_order_at" TIMESTAMP(3),
    "error_message" TEXT,
    "items_data" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketplace_orders_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "marketplace_orders_order_id_key" ON "marketplace_orders"("order_id");
CREATE UNIQUE INDEX "marketplace_orders_tenant_id_external_order_id_key" ON "marketplace_orders"("tenant_id", "external_order_id");
CREATE INDEX "marketplace_orders_tenant_id_connection_id_idx" ON "marketplace_orders"("tenant_id", "connection_id");
CREATE INDEX "marketplace_orders_connection_id_sync_status_idx" ON "marketplace_orders"("connection_id", "sync_status");
CREATE INDEX "marketplace_orders_external_order_id_idx" ON "marketplace_orders"("external_order_id");

ALTER TABLE "marketplace_orders" ADD CONSTRAINT "marketplace_orders_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "marketplace_orders" ADD CONSTRAINT "marketplace_orders_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "marketplace_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "marketplace_orders" ADD CONSTRAINT "marketplace_orders_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================
-- 4. Create marketplace_sync_logs table
-- ============================================
CREATE TABLE "marketplace_sync_logs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "connection_id" TEXT NOT NULL,
    "sync_type" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "items_total" INTEGER NOT NULL DEFAULT 0,
    "items_success" INTEGER NOT NULL DEFAULT 0,
    "items_failed" INTEGER NOT NULL DEFAULT 0,
    "details" TEXT,
    "error_message" TEXT,
    "metadata" JSONB,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "marketplace_sync_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "marketplace_sync_logs_tenant_id_connection_id_idx" ON "marketplace_sync_logs"("tenant_id", "connection_id");
CREATE INDEX "marketplace_sync_logs_sync_type_status_idx" ON "marketplace_sync_logs"("sync_type", "status");

ALTER TABLE "marketplace_sync_logs" ADD CONSTRAINT "marketplace_sync_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "marketplace_sync_logs" ADD CONSTRAINT "marketplace_sync_logs_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "marketplace_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================
-- 5. Create marketplace_returns table
-- ============================================
CREATE TABLE "marketplace_returns" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "connection_id" TEXT NOT NULL,
    "marketplace_order_id" TEXT,
    "external_return_id" TEXT NOT NULL,
    "external_order_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "buyer_comments" TEXT,
    "seller_comments" TEXT,
    "status" TEXT NOT NULL,
    "buyer_username" TEXT NOT NULL,
    "items_data" JSONB NOT NULL,
    "refund_amount" DECIMAL(18,2),
    "refund_currency" TEXT NOT NULL DEFAULT 'USD',
    "refund_status" TEXT,
    "request_date" TIMESTAMP(3) NOT NULL,
    "response_date" TIMESTAMP(3),
    "received_date" TIMESTAMP(3),
    "refund_date" TIMESTAMP(3),
    "sync_status" TEXT NOT NULL DEFAULT 'pending',
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketplace_returns_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "marketplace_returns_external_return_id_key" ON "marketplace_returns"("external_return_id");
CREATE INDEX "marketplace_returns_tenant_id_connection_id_idx" ON "marketplace_returns"("tenant_id", "connection_id");
CREATE INDEX "marketplace_returns_external_return_id_idx" ON "marketplace_returns"("external_return_id");
CREATE INDEX "marketplace_returns_external_order_id_idx" ON "marketplace_returns"("external_order_id");
CREATE INDEX "marketplace_returns_tenant_id_status_idx" ON "marketplace_returns"("tenant_id", "status");

ALTER TABLE "marketplace_returns" ADD CONSTRAINT "marketplace_returns_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "marketplace_returns" ADD CONSTRAINT "marketplace_returns_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "marketplace_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "marketplace_returns" ADD CONSTRAINT "marketplace_returns_marketplace_order_id_fkey" FOREIGN KEY ("marketplace_order_id") REFERENCES "marketplace_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================
-- 6. Create marketplace_message_threads table
-- ============================================
CREATE TABLE "marketplace_message_threads" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "connection_id" TEXT NOT NULL,
    "external_thread_id" TEXT NOT NULL,
    "external_item_id" TEXT,
    "item_title" TEXT,
    "buyer_username" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "message_count" INTEGER NOT NULL DEFAULT 0,
    "last_message_date" TIMESTAMP(3) NOT NULL,
    "sync_status" TEXT NOT NULL DEFAULT 'pending',
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketplace_message_threads_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "marketplace_message_threads_external_thread_id_key" ON "marketplace_message_threads"("external_thread_id");
CREATE INDEX "marketplace_message_threads_tenant_id_connection_id_idx" ON "marketplace_message_threads"("tenant_id", "connection_id");
CREATE INDEX "marketplace_message_threads_tenant_id_is_read_idx" ON "marketplace_message_threads"("tenant_id", "is_read");
CREATE INDEX "marketplace_message_threads_tenant_id_status_idx" ON "marketplace_message_threads"("tenant_id", "status");

ALTER TABLE "marketplace_message_threads" ADD CONSTRAINT "marketplace_message_threads_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "marketplace_message_threads" ADD CONSTRAINT "marketplace_message_threads_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "marketplace_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================
-- 7. Create marketplace_messages table
-- ============================================
CREATE TABLE "marketplace_messages" (
    "id" TEXT NOT NULL,
    "thread_id" TEXT NOT NULL,
    "external_message_id" TEXT NOT NULL,
    "sender" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "sent_date" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marketplace_messages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "marketplace_messages_external_message_id_key" ON "marketplace_messages"("external_message_id");
CREATE INDEX "marketplace_messages_thread_id_sent_date_idx" ON "marketplace_messages"("thread_id", "sent_date");

ALTER TABLE "marketplace_messages" ADD CONSTRAINT "marketplace_messages_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "marketplace_message_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================
-- 8. Create marketplace_campaigns table
-- ============================================
CREATE TABLE "marketplace_campaigns" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "connection_id" TEXT NOT NULL,
    "external_campaign_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "campaign_type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "budget_amount" DECIMAL(18,2),
    "budget_currency" TEXT NOT NULL DEFAULT 'USD',
    "bid_percentage" DECIMAL(5,2),
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "sales" INTEGER NOT NULL DEFAULT 0,
    "spend" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "sync_status" TEXT NOT NULL DEFAULT 'pending',
    "last_synced_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketplace_campaigns_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "marketplace_campaigns_external_campaign_id_key" ON "marketplace_campaigns"("external_campaign_id");
CREATE INDEX "marketplace_campaigns_tenant_id_connection_id_idx" ON "marketplace_campaigns"("tenant_id", "connection_id");
CREATE INDEX "marketplace_campaigns_status_idx" ON "marketplace_campaigns"("status");

ALTER TABLE "marketplace_campaigns" ADD CONSTRAINT "marketplace_campaigns_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "marketplace_campaigns" ADD CONSTRAINT "marketplace_campaigns_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "marketplace_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================
-- 9. Create marketplace_violations table
-- ============================================
CREATE TABLE "marketplace_violations" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "connection_id" TEXT NOT NULL,
    "external_violation_id" TEXT NOT NULL,
    "compliance_type" TEXT NOT NULL,
    "listing_id" TEXT,
    "reason_code" TEXT,
    "message" TEXT,
    "severity" TEXT,
    "violation_data" JSONB,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketplace_violations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "marketplace_violations_external_violation_id_key" ON "marketplace_violations"("external_violation_id");
CREATE INDEX "marketplace_violations_tenant_id_connection_id_idx" ON "marketplace_violations"("tenant_id", "connection_id");
CREATE INDEX "marketplace_violations_status_idx" ON "marketplace_violations"("status");
CREATE INDEX "marketplace_violations_compliance_type_idx" ON "marketplace_violations"("compliance_type");

ALTER TABLE "marketplace_violations" ADD CONSTRAINT "marketplace_violations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "marketplace_violations" ADD CONSTRAINT "marketplace_violations_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "marketplace_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================
-- 10. Enable Row-Level Security for new tables
-- ============================================
SELECT enable_tenant_rls('marketplace_returns');
SELECT enable_tenant_rls('marketplace_message_threads');
SELECT enable_tenant_rls('marketplace_messages');
SELECT enable_tenant_rls('marketplace_campaigns');
SELECT enable_tenant_rls('marketplace_violations');
