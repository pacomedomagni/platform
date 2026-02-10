-- EasyPost Integration Migration
-- Run this after reviewing the implementation plan

-- Add EasyPost fields to Shipment table
ALTER TABLE shipments
ADD COLUMN IF NOT EXISTS easypost_shipment_id VARCHAR(255) UNIQUE,
ADD COLUMN IF NOT EXISTS easypost_tracker_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS easypost_rate_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS carrier_account VARCHAR(255),
ADD COLUMN IF NOT EXISTS carrier_cost DECIMAL(18,4),
ADD COLUMN IF NOT EXISTS customer_cost DECIMAL(18,4),
ADD COLUMN IF NOT EXISTS platform_profit DECIMAL(18,4),
ADD COLUMN IF NOT EXISTS address_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS verification_result JSONB,
ADD COLUMN IF NOT EXISTS insurance_amount DECIMAL(18,2),
ADD COLUMN IF NOT EXISTS insurance_cost DECIMAL(18,4);

-- Create index on EasyPost shipment ID for fast lookups
CREATE INDEX IF NOT EXISTS idx_shipments_easypost_shipment_id ON shipments(easypost_shipment_id);

-- Create shipping costs tracking table
CREATE TABLE IF NOT EXISTS shipping_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,

  carrier_cost DECIMAL(18,4) NOT NULL,
  customer_paid DECIMAL(18,4) NOT NULL,
  profit DECIMAL(18,4) NOT NULL,
  markup_percent DECIMAL(5,2) NOT NULL,

  carrier VARCHAR(255) NOT NULL,
  service VARCHAR(255) NOT NULL,

  api_cost DECIMAL(10,4) DEFAULT 0.05,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for shipping costs
CREATE INDEX IF NOT EXISTS idx_shipping_costs_tenant_id ON shipping_costs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_shipping_costs_order_id ON shipping_costs(order_id);
CREATE INDEX IF NOT EXISTS idx_shipping_costs_created_at ON shipping_costs(created_at);

-- Create platform settings table
CREATE TABLE IF NOT EXISTS platform_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(255) UNIQUE NOT NULL,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed initial platform settings
INSERT INTO platform_settings (key, value, description) VALUES
('shipping_markup_percent', '5.0', 'Default shipping markup percentage for all tenants'),
('easypost_webhook_secret', '', 'EasyPost webhook verification secret')
ON CONFLICT (key) DO NOTHING;

-- Add comment to document changes
COMMENT ON COLUMN shipments.easypost_shipment_id IS 'EasyPost shipment identifier for tracking';
COMMENT ON COLUMN shipments.carrier_cost IS 'Actual cost charged by EasyPost (carrier + API fee)';
COMMENT ON COLUMN shipments.customer_cost IS 'Amount charged to customer (includes markup)';
COMMENT ON COLUMN shipments.platform_profit IS 'Platform profit (customer_cost - carrier_cost - api_fee)';

COMMENT ON TABLE shipping_costs IS 'Tracks shipping costs and profit per shipment for analytics';
