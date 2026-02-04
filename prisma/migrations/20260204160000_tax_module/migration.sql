-- Tax Module: Tax Category, Tax Template, Tax Withholding

-- Tax Category (Classification for tax applicability)
CREATE TABLE tax_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL,
    title VARCHAR(500),
    
    -- Tax settings
    is_default BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    UNIQUE(tenant_id, name)
);

CREATE INDEX idx_tax_categories_tenant ON tax_categories(tenant_id);

-- Sales Tax Template (Reusable tax rules for sales)
CREATE TABLE sales_tax_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL,
    title VARCHAR(500),
    
    -- Applicability
    is_default BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    
    -- Region/Country
    country VARCHAR(100),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    UNIQUE(tenant_id, name)
);

CREATE INDEX idx_sales_tax_templates_tenant ON sales_tax_templates(tenant_id);

-- Sales Tax Template Detail (Individual tax rates in a template)
CREATE TABLE sales_tax_template_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    parent_id UUID NOT NULL REFERENCES sales_tax_templates(id) ON DELETE CASCADE,
    idx INT DEFAULT 0,
    
    -- Tax details
    charge_type VARCHAR(50) DEFAULT 'On Net Total', -- On Net Total, On Previous Row Total, Actual
    account_head VARCHAR(255) NOT NULL, -- GL Account for this tax
    description VARCHAR(500),
    
    rate DECIMAL(18,6) DEFAULT 0,
    
    -- Tax included in item rate?
    included_in_print_rate BOOLEAN DEFAULT false,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sales_tax_detail_parent ON sales_tax_template_details(parent_id);
CREATE INDEX idx_sales_tax_detail_tenant ON sales_tax_template_details(tenant_id);

-- Purchase Tax Template (Reusable tax rules for purchases)
CREATE TABLE purchase_tax_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL,
    title VARCHAR(500),
    
    is_default BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    
    country VARCHAR(100),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    UNIQUE(tenant_id, name)
);

CREATE INDEX idx_purchase_tax_templates_tenant ON purchase_tax_templates(tenant_id);

-- Purchase Tax Template Detail
CREATE TABLE purchase_tax_template_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    parent_id UUID NOT NULL REFERENCES purchase_tax_templates(id) ON DELETE CASCADE,
    idx INT DEFAULT 0,
    
    charge_type VARCHAR(50) DEFAULT 'On Net Total',
    account_head VARCHAR(255) NOT NULL,
    description VARCHAR(500),
    
    rate DECIMAL(18,6) DEFAULT 0,
    
    -- Is this a recoverable input tax?
    add_deduct_tax VARCHAR(20) DEFAULT 'Add', -- Add or Deduct
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_purchase_tax_detail_parent ON purchase_tax_template_details(parent_id);
CREATE INDEX idx_purchase_tax_detail_tenant ON purchase_tax_template_details(tenant_id);

-- Tax Withholding Category (TDS/Withholding Tax)
CREATE TABLE tax_withholding_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL,
    category_name VARCHAR(500),
    
    -- Withholding settings
    withholding_type VARCHAR(50) DEFAULT 'Percentage', -- Percentage or Amount
    rate DECIMAL(18,6) DEFAULT 0,
    
    -- Threshold
    threshold_amount DECIMAL(18,6) DEFAULT 0,
    cumulative_threshold DECIMAL(18,6) DEFAULT 0,
    
    -- Account
    account VARCHAR(255),
    
    -- Dates
    valid_from DATE,
    valid_to DATE,
    
    is_active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    UNIQUE(tenant_id, name)
);

CREATE INDEX idx_tax_withholding_tenant ON tax_withholding_categories(tenant_id);

-- Item Tax Template (Item-specific tax rates)
CREATE TABLE item_tax_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL,
    title VARCHAR(500),
    
    is_active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    UNIQUE(tenant_id, name)
);

CREATE INDEX idx_item_tax_templates_tenant ON item_tax_templates(tenant_id);

-- Item Tax Template Detail
CREATE TABLE item_tax_template_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    parent_id UUID NOT NULL REFERENCES item_tax_templates(id) ON DELETE CASCADE,
    idx INT DEFAULT 0,
    
    tax_type VARCHAR(255) NOT NULL, -- Tax account
    tax_rate DECIMAL(18,6) DEFAULT 0,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_item_tax_detail_parent ON item_tax_template_details(parent_id);
CREATE INDEX idx_item_tax_detail_tenant ON item_tax_template_details(tenant_id);

-- Enable Row Level Security
ALTER TABLE tax_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_tax_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_tax_template_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_tax_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_tax_template_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_withholding_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_tax_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_tax_template_details ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY tax_categories_tenant_isolation ON tax_categories
    USING (tenant_id::text = current_setting('app.tenant', true));
CREATE POLICY sales_tax_templates_tenant_isolation ON sales_tax_templates
    USING (tenant_id::text = current_setting('app.tenant', true));
CREATE POLICY sales_tax_details_tenant_isolation ON sales_tax_template_details
    USING (tenant_id::text = current_setting('app.tenant', true));
CREATE POLICY purchase_tax_templates_tenant_isolation ON purchase_tax_templates
    USING (tenant_id::text = current_setting('app.tenant', true));
CREATE POLICY purchase_tax_details_tenant_isolation ON purchase_tax_template_details
    USING (tenant_id::text = current_setting('app.tenant', true));
CREATE POLICY tax_withholding_tenant_isolation ON tax_withholding_categories
    USING (tenant_id::text = current_setting('app.tenant', true));
CREATE POLICY item_tax_templates_tenant_isolation ON item_tax_templates
    USING (tenant_id::text = current_setting('app.tenant', true));
CREATE POLICY item_tax_details_tenant_isolation ON item_tax_template_details
    USING (tenant_id::text = current_setting('app.tenant', true));
