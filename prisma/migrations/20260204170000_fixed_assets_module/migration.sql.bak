-- Fixed Assets Module: Asset Category, Asset, Asset Movement, Depreciation

-- Asset Category (Depreciation rules)
CREATE TABLE asset_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL,
    asset_category_name VARCHAR(500),
    
    -- Depreciation settings
    depreciation_method VARCHAR(50) DEFAULT 'Straight Line', -- Straight Line, Declining Balance, Double Declining Balance
    total_number_of_depreciations INT DEFAULT 60, -- e.g., 60 months = 5 years
    frequency_of_depreciation INT DEFAULT 12, -- months between depreciations (12 = annual, 1 = monthly)
    
    -- Accounts
    fixed_asset_account VARCHAR(255),
    accumulated_depreciation_account VARCHAR(255),
    depreciation_expense_account VARCHAR(255),
    
    -- Capital Work In Progress
    cwip_account VARCHAR(255),
    
    is_active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    UNIQUE(tenant_id, name)
);

CREATE INDEX idx_asset_categories_tenant ON asset_categories(tenant_id);

-- Asset (Individual fixed assets)
CREATE TABLE assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL,
    asset_name VARCHAR(500),
    
    -- Category
    asset_category VARCHAR(255),
    
    -- Item link (if purchased via Purchase Receipt)
    item_code VARCHAR(255),
    
    -- Status
    status VARCHAR(50) DEFAULT 'Draft', -- Draft, Submitted, Partially Depreciated, Fully Depreciated, Scrapped, Sold
    docstatus INT DEFAULT 0,
    
    -- Purchase info
    purchase_date DATE,
    purchase_receipt VARCHAR(255),
    purchase_invoice VARCHAR(255),
    supplier VARCHAR(255),
    
    -- Value
    gross_purchase_amount DECIMAL(18,6) DEFAULT 0,
    opening_accumulated_depreciation DECIMAL(18,6) DEFAULT 0,
    
    -- Depreciation
    depreciation_method VARCHAR(50),
    total_number_of_depreciations INT,
    frequency_of_depreciation INT,
    expected_value_after_useful_life DECIMAL(18,6) DEFAULT 0, -- Salvage value
    
    -- Calculated values
    value_after_depreciation DECIMAL(18,6) DEFAULT 0,
    
    -- Available for use
    available_for_use_date DATE,
    
    -- Location
    location VARCHAR(255),
    custodian VARCHAR(255), -- Employee
    department VARCHAR(255),
    
    -- Disposal
    disposal_date DATE,
    journal_entry_for_scrap VARCHAR(255),
    
    -- Warranty
    warranty_expiry_date DATE,
    
    -- Serial/Asset Tag
    asset_tag VARCHAR(255),
    serial_number VARCHAR(255),
    
    -- Notes
    notes TEXT,
    
    -- Metadata
    owner VARCHAR(255),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    UNIQUE(tenant_id, name)
);

CREATE INDEX idx_assets_tenant ON assets(tenant_id);
CREATE INDEX idx_assets_category ON assets(tenant_id, asset_category);
CREATE INDEX idx_assets_status ON assets(tenant_id, status);
CREATE INDEX idx_assets_location ON assets(tenant_id, location);

-- Asset Movement (Location/Custodian changes)
CREATE TABLE asset_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL,
    
    -- Movement details
    purpose VARCHAR(50) DEFAULT 'Transfer', -- Transfer, Receipt, Issue
    transaction_date DATE DEFAULT CURRENT_DATE,
    
    -- Status
    docstatus INT DEFAULT 0,
    
    -- Notes
    notes TEXT,
    
    owner VARCHAR(255),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    UNIQUE(tenant_id, name)
);

CREATE INDEX idx_asset_movements_tenant ON asset_movements(tenant_id);

-- Asset Movement Item (Individual asset movements)
CREATE TABLE asset_movement_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    parent_id UUID NOT NULL REFERENCES asset_movements(id) ON DELETE CASCADE,
    idx INT DEFAULT 0,
    
    asset VARCHAR(255) NOT NULL,
    
    -- From
    source_location VARCHAR(255),
    from_employee VARCHAR(255),
    
    -- To
    target_location VARCHAR(255),
    to_employee VARCHAR(255),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_asset_movement_items_parent ON asset_movement_items(parent_id);
CREATE INDEX idx_asset_movement_items_tenant ON asset_movement_items(tenant_id);

-- Depreciation Schedule (Auto-generated depreciation entries)
CREATE TABLE asset_depreciation_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    idx INT DEFAULT 0,
    
    -- Schedule details
    schedule_date DATE NOT NULL,
    depreciation_amount DECIMAL(18,6) DEFAULT 0,
    accumulated_depreciation_amount DECIMAL(18,6) DEFAULT 0,
    
    -- Status
    journal_entry VARCHAR(255), -- Link to posted JE
    is_booked BOOLEAN DEFAULT false,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_depreciation_schedule_asset ON asset_depreciation_schedules(asset_id);
CREATE INDEX idx_depreciation_schedule_tenant ON asset_depreciation_schedules(tenant_id);
CREATE INDEX idx_depreciation_schedule_date ON asset_depreciation_schedules(tenant_id, schedule_date, is_booked);

-- Enable Row Level Security
ALTER TABLE asset_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_movement_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_depreciation_schedules ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY asset_categories_tenant_isolation ON asset_categories
    USING (tenant_id::text = current_setting('app.tenant', true));
CREATE POLICY assets_tenant_isolation ON assets
    USING (tenant_id::text = current_setting('app.tenant', true));
CREATE POLICY asset_movements_tenant_isolation ON asset_movements
    USING (tenant_id::text = current_setting('app.tenant', true));
CREATE POLICY asset_movement_items_tenant_isolation ON asset_movement_items
    USING (tenant_id::text = current_setting('app.tenant', true));
CREATE POLICY asset_depreciation_tenant_isolation ON asset_depreciation_schedules
    USING (tenant_id::text = current_setting('app.tenant', true));
