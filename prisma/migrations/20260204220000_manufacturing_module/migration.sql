-- Manufacturing Module: BOM, Work Order, Job Card, Production Plan

-- BOM (Bill of Materials)
CREATE TABLE boms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL,
    
    -- Product
    item VARCHAR(255) NOT NULL,
    item_name VARCHAR(500),
    
    -- Quantity
    quantity DECIMAL(18,6) DEFAULT 1,
    uom VARCHAR(50),
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    is_default BOOLEAN DEFAULT false,
    docstatus INT DEFAULT 0,
    
    -- Type
    bom_type VARCHAR(50) DEFAULT 'Assembly', -- Assembly, Component, Sub-Assembly
    
    -- Costs
    raw_material_cost DECIMAL(18,6) DEFAULT 0,
    operating_cost DECIMAL(18,6) DEFAULT 0,
    total_cost DECIMAL(18,6) DEFAULT 0,
    
    -- Routing
    routing VARCHAR(255),
    
    -- Settings
    with_operations BOOLEAN DEFAULT false,
    transfer_material_against VARCHAR(50) DEFAULT 'Work Order', -- Work Order, Job Card
    
    -- Description
    description TEXT,
    
    -- Metadata
    owner VARCHAR(255),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    UNIQUE(tenant_id, name)
);

CREATE INDEX idx_boms_tenant ON boms(tenant_id);
CREATE INDEX idx_boms_item ON boms(tenant_id, item);
CREATE INDEX idx_boms_active ON boms(tenant_id, is_active, is_default);

-- BOM Item (Raw materials)
CREATE TABLE bom_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    parent_id UUID NOT NULL REFERENCES boms(id) ON DELETE CASCADE,
    idx INT DEFAULT 0,
    
    item_code VARCHAR(255) NOT NULL,
    item_name VARCHAR(500),
    
    -- Quantity
    qty DECIMAL(18,6) DEFAULT 1,
    uom VARCHAR(50),
    
    -- Rate
    rate DECIMAL(18,6) DEFAULT 0,
    amount DECIMAL(18,6) DEFAULT 0,
    
    -- Source
    source_warehouse VARCHAR(255),
    
    -- Sub-BOM
    bom_no VARCHAR(255),
    
    -- Scrap
    include_in_scrap BOOLEAN DEFAULT false,
    
    description TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bom_items_parent ON bom_items(parent_id);
CREATE INDEX idx_bom_items_tenant ON bom_items(tenant_id);
CREATE INDEX idx_bom_items_item ON bom_items(tenant_id, item_code);

-- BOM Operation (Manufacturing operations)
CREATE TABLE bom_operations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    parent_id UUID NOT NULL REFERENCES boms(id) ON DELETE CASCADE,
    idx INT DEFAULT 0,
    
    -- Operation
    operation VARCHAR(255) NOT NULL,
    
    -- Workstation
    workstation VARCHAR(255),
    workstation_type VARCHAR(255),
    
    -- Time
    time_in_mins DECIMAL(10,2) DEFAULT 0,
    
    -- Costs
    hour_rate DECIMAL(18,6) DEFAULT 0,
    operating_cost DECIMAL(18,6) DEFAULT 0,
    
    -- Batch size
    batch_size INT DEFAULT 1,
    
    description TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bom_operations_parent ON bom_operations(parent_id);
CREATE INDEX idx_bom_operations_tenant ON bom_operations(tenant_id);

-- Workstation
CREATE TABLE workstations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL,
    workstation_name VARCHAR(500),
    
    -- Type
    workstation_type VARCHAR(255),
    
    -- Costs
    hour_rate DECIMAL(18,6) DEFAULT 0,
    hour_rate_electricity DECIMAL(18,6) DEFAULT 0,
    hour_rate_consumable DECIMAL(18,6) DEFAULT 0,
    hour_rate_rent DECIMAL(18,6) DEFAULT 0,
    hour_rate_labour DECIMAL(18,6) DEFAULT 0,
    
    -- Capacity
    production_capacity DECIMAL(10,2) DEFAULT 0,
    
    -- Location
    warehouse VARCHAR(255),
    
    -- Working hours
    working_hours TEXT, -- JSON array of working hours
    
    is_active BOOLEAN DEFAULT true,
    
    description TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    UNIQUE(tenant_id, name)
);

CREATE INDEX idx_workstations_tenant ON workstations(tenant_id);
CREATE INDEX idx_workstations_type ON workstations(tenant_id, workstation_type);

-- Routing (Operation sequences)
CREATE TABLE routings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL,
    routing_name VARCHAR(500),
    
    is_active BOOLEAN DEFAULT true,
    docstatus INT DEFAULT 0,
    
    description TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    UNIQUE(tenant_id, name)
);

CREATE INDEX idx_routings_tenant ON routings(tenant_id);

-- Routing Operation
CREATE TABLE routing_operations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    parent_id UUID NOT NULL REFERENCES routings(id) ON DELETE CASCADE,
    idx INT DEFAULT 0,
    
    operation VARCHAR(255) NOT NULL,
    workstation VARCHAR(255),
    
    time_in_mins DECIMAL(10,2) DEFAULT 0,
    
    description TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_routing_operations_parent ON routing_operations(parent_id);
CREATE INDEX idx_routing_operations_tenant ON routing_operations(tenant_id);

-- Work Order (Production order)
CREATE TABLE work_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL,
    
    -- Product
    production_item VARCHAR(255) NOT NULL,
    item_name VARCHAR(500),
    bom_no VARCHAR(255),
    
    -- Quantity
    qty DECIMAL(18,6) DEFAULT 1,
    produced_qty DECIMAL(18,6) DEFAULT 0,
    process_loss_qty DECIMAL(18,6) DEFAULT 0,
    
    -- Status
    status VARCHAR(50) DEFAULT 'Draft', -- Draft, Not Started, In Progress, Stopped, Completed, Cancelled
    docstatus INT DEFAULT 0,
    
    -- Dates
    planned_start_date DATE,
    planned_end_date DATE,
    actual_start_date DATE,
    actual_end_date DATE,
    
    -- Warehouse
    source_warehouse VARCHAR(255),
    wip_warehouse VARCHAR(255), -- Work in progress
    fg_warehouse VARCHAR(255),  -- Finished goods
    
    -- Sales Order link
    sales_order VARCHAR(255),
    
    -- Material tracking
    material_transferred_for_manufacturing DECIMAL(18,6) DEFAULT 0,
    
    -- Operations
    has_operations BOOLEAN DEFAULT false,
    
    -- Skip transfer
    skip_transfer BOOLEAN DEFAULT false,
    
    -- Metadata
    owner VARCHAR(255),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    UNIQUE(tenant_id, name)
);

CREATE INDEX idx_work_orders_tenant ON work_orders(tenant_id);
CREATE INDEX idx_work_orders_item ON work_orders(tenant_id, production_item);
CREATE INDEX idx_work_orders_status ON work_orders(tenant_id, status);
CREATE INDEX idx_work_orders_dates ON work_orders(tenant_id, planned_start_date, planned_end_date);

-- Work Order Item (Required materials)
CREATE TABLE work_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    parent_id UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
    idx INT DEFAULT 0,
    
    item_code VARCHAR(255) NOT NULL,
    item_name VARCHAR(500),
    
    -- Quantity
    required_qty DECIMAL(18,6) DEFAULT 0,
    transferred_qty DECIMAL(18,6) DEFAULT 0,
    consumed_qty DECIMAL(18,6) DEFAULT 0,
    
    -- Source
    source_warehouse VARCHAR(255),
    
    -- UOM
    uom VARCHAR(50),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_work_order_items_parent ON work_order_items(parent_id);
CREATE INDEX idx_work_order_items_tenant ON work_order_items(tenant_id);

-- Job Card (Operation tracking)
CREATE TABLE job_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL,
    
    -- Work Order link
    work_order VARCHAR(255) NOT NULL,
    
    -- Operation
    operation VARCHAR(255) NOT NULL,
    workstation VARCHAR(255),
    
    -- Item
    production_item VARCHAR(255),
    bom_no VARCHAR(255),
    
    -- Quantity
    for_quantity DECIMAL(18,6) DEFAULT 1,
    completed_qty DECIMAL(18,6) DEFAULT 0,
    process_loss_qty DECIMAL(18,6) DEFAULT 0,
    
    -- Status
    status VARCHAR(50) DEFAULT 'Open', -- Open, Work In Progress, Completed, Cancelled
    docstatus INT DEFAULT 0,
    
    -- Time
    total_time_in_mins DECIMAL(10,2) DEFAULT 0,
    
    -- Dates
    started_time TIMESTAMPTZ,
    completed_time TIMESTAMPTZ,
    
    -- Quality
    quality_inspection VARCHAR(255),
    
    -- Employee
    employee VARCHAR(255),
    
    -- Remarks
    remarks TEXT,
    
    -- Metadata
    owner VARCHAR(255),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    UNIQUE(tenant_id, name)
);

CREATE INDEX idx_job_cards_tenant ON job_cards(tenant_id);
CREATE INDEX idx_job_cards_work_order ON job_cards(tenant_id, work_order);
CREATE INDEX idx_job_cards_status ON job_cards(tenant_id, status);
CREATE INDEX idx_job_cards_workstation ON job_cards(tenant_id, workstation);

-- Job Card Time Log
CREATE TABLE job_card_time_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    parent_id UUID NOT NULL REFERENCES job_cards(id) ON DELETE CASCADE,
    idx INT DEFAULT 0,
    
    from_time TIMESTAMPTZ,
    to_time TIMESTAMPTZ,
    time_in_mins DECIMAL(10,2) DEFAULT 0,
    
    completed_qty DECIMAL(18,6) DEFAULT 0,
    
    employee VARCHAR(255),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_job_card_time_logs_parent ON job_card_time_logs(parent_id);
CREATE INDEX idx_job_card_time_logs_tenant ON job_card_time_logs(tenant_id);

-- Production Plan (MRP)
CREATE TABLE production_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL,
    
    -- Period
    from_date DATE,
    to_date DATE,
    posting_date DATE DEFAULT CURRENT_DATE,
    
    -- Status
    status VARCHAR(50) DEFAULT 'Draft', -- Draft, Submitted, Closed
    docstatus INT DEFAULT 0,
    
    -- Totals
    total_planned_qty DECIMAL(18,6) DEFAULT 0,
    total_produced_qty DECIMAL(18,6) DEFAULT 0,
    
    -- Filters
    item_code VARCHAR(255),
    customer VARCHAR(255),
    warehouse VARCHAR(255),
    
    -- Options
    get_items_from VARCHAR(50) DEFAULT 'Sales Order', -- Sales Order, Material Request
    include_non_stock_items BOOLEAN DEFAULT false,
    include_subcontracted_items BOOLEAN DEFAULT false,
    
    -- Metadata
    owner VARCHAR(255),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    UNIQUE(tenant_id, name)
);

CREATE INDEX idx_production_plans_tenant ON production_plans(tenant_id);
CREATE INDEX idx_production_plans_status ON production_plans(tenant_id, status);
CREATE INDEX idx_production_plans_dates ON production_plans(tenant_id, from_date, to_date);

-- Production Plan Item
CREATE TABLE production_plan_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    parent_id UUID NOT NULL REFERENCES production_plans(id) ON DELETE CASCADE,
    idx INT DEFAULT 0,
    
    item_code VARCHAR(255) NOT NULL,
    item_name VARCHAR(500),
    bom_no VARCHAR(255),
    
    -- Quantity
    planned_qty DECIMAL(18,6) DEFAULT 0,
    pending_qty DECIMAL(18,6) DEFAULT 0,
    produced_qty DECIMAL(18,6) DEFAULT 0,
    
    -- Warehouse
    warehouse VARCHAR(255),
    
    -- Sales Order link
    sales_order VARCHAR(255),
    
    -- Dates
    planned_start_date DATE,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_production_plan_items_parent ON production_plan_items(parent_id);
CREATE INDEX idx_production_plan_items_tenant ON production_plan_items(tenant_id);

-- Enable Row Level Security
ALTER TABLE boms ENABLE ROW LEVEL SECURITY;
ALTER TABLE bom_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE bom_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE workstations ENABLE ROW LEVEL SECURITY;
ALTER TABLE routings ENABLE ROW LEVEL SECURITY;
ALTER TABLE routing_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_card_time_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_plan_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY boms_tenant_isolation ON boms
    USING (tenant_id::text = current_setting('app.tenant', true));
CREATE POLICY bom_items_tenant_isolation ON bom_items
    USING (tenant_id::text = current_setting('app.tenant', true));
CREATE POLICY bom_operations_tenant_isolation ON bom_operations
    USING (tenant_id::text = current_setting('app.tenant', true));
CREATE POLICY workstations_tenant_isolation ON workstations
    USING (tenant_id::text = current_setting('app.tenant', true));
CREATE POLICY routings_tenant_isolation ON routings
    USING (tenant_id::text = current_setting('app.tenant', true));
CREATE POLICY routing_operations_tenant_isolation ON routing_operations
    USING (tenant_id::text = current_setting('app.tenant', true));
CREATE POLICY work_orders_tenant_isolation ON work_orders
    USING (tenant_id::text = current_setting('app.tenant', true));
CREATE POLICY work_order_items_tenant_isolation ON work_order_items
    USING (tenant_id::text = current_setting('app.tenant', true));
CREATE POLICY job_cards_tenant_isolation ON job_cards
    USING (tenant_id::text = current_setting('app.tenant', true));
CREATE POLICY job_card_time_logs_tenant_isolation ON job_card_time_logs
    USING (tenant_id::text = current_setting('app.tenant', true));
CREATE POLICY production_plans_tenant_isolation ON production_plans
    USING (tenant_id::text = current_setting('app.tenant', true));
CREATE POLICY production_plan_items_tenant_isolation ON production_plan_items
    USING (tenant_id::text = current_setting('app.tenant', true));
