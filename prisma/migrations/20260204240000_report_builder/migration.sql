-- Report Builder: Custom Reports, Dashboards, Number Cards

-- Report (Custom saved reports)
CREATE TABLE reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL,
    report_name VARCHAR(500),
    
    -- Type
    report_type VARCHAR(50) DEFAULT 'Query Report', -- Query Report, Script Report
    
    -- Based on
    ref_doctype VARCHAR(255),
    
    -- Query
    query TEXT,
    script TEXT,
    
    -- Columns (JSON array)
    columns TEXT,
    
    -- Filters (JSON array)
    filters TEXT,
    
    -- Settings
    is_standard BOOLEAN DEFAULT false,
    add_total_row BOOLEAN DEFAULT false,
    
    -- Access
    roles TEXT, -- Comma-separated roles
    
    -- Display
    letter_head VARCHAR(255),
    
    -- Status
    disabled BOOLEAN DEFAULT false,
    
    -- Description
    description TEXT,
    
    -- Metadata
    owner VARCHAR(255),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    UNIQUE(tenant_id, name)
);

CREATE INDEX idx_reports_tenant ON reports(tenant_id);
CREATE INDEX idx_reports_doctype ON reports(tenant_id, ref_doctype);

-- Saved Report (User's saved filter configurations)
CREATE TABLE saved_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL,
    
    -- Report reference
    report VARCHAR(255) NOT NULL,
    
    -- User
    user_id VARCHAR(255),
    
    -- Filters (JSON)
    filters TEXT,
    
    -- Sort (JSON)
    sort_by VARCHAR(255),
    sort_order VARCHAR(10) DEFAULT 'desc',
    
    -- Columns (JSON - user's column selection)
    columns TEXT,
    
    -- Chart configuration (JSON)
    chart_config TEXT,
    
    -- Default
    is_default BOOLEAN DEFAULT false,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    UNIQUE(tenant_id, name)
);

CREATE INDEX idx_saved_reports_tenant ON saved_reports(tenant_id);
CREATE INDEX idx_saved_reports_user ON saved_reports(tenant_id, user_id);

-- Dashboard (Custom dashboards)
CREATE TABLE dashboards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL,
    dashboard_name VARCHAR(500),
    
    -- Module
    module VARCHAR(255),
    
    -- Access
    roles TEXT, -- Comma-separated roles
    
    -- Default for these roles
    is_default BOOLEAN DEFAULT false,
    
    -- Settings
    is_standard BOOLEAN DEFAULT false,
    
    -- Metadata
    owner VARCHAR(255),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    UNIQUE(tenant_id, name)
);

CREATE INDEX idx_dashboards_tenant ON dashboards(tenant_id);
CREATE INDEX idx_dashboards_module ON dashboards(tenant_id, module);

-- Dashboard Chart (Charts on dashboard)
CREATE TABLE dashboard_charts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL,
    chart_name VARCHAR(500),
    
    -- Dashboard
    dashboard VARCHAR(255),
    
    -- Type
    chart_type VARCHAR(50) DEFAULT 'Bar', -- Bar, Line, Pie, Donut, Percentage, Count, Group Count
    
    -- Source
    source VARCHAR(50) DEFAULT 'Report', -- Report, Query, DocType
    report VARCHAR(255),
    document_type VARCHAR(255),
    
    -- For report-based charts
    based_on VARCHAR(255), -- Field to group by
    value_based_on VARCHAR(255), -- Field to aggregate
    
    -- Query (if source is Query)
    query TEXT,
    
    -- Filters (JSON)
    filters TEXT,
    
    -- Time settings
    timeseries BOOLEAN DEFAULT false,
    timespan VARCHAR(50) DEFAULT 'Last Year', -- Last Week, Last Month, Last Quarter, Last Year, All Time
    time_interval VARCHAR(50) DEFAULT 'Monthly', -- Daily, Weekly, Monthly, Quarterly, Yearly
    
    -- Display
    color VARCHAR(50),
    width VARCHAR(20) DEFAULT 'Half', -- Half, Full
    
    -- Aggregation
    group_by_type VARCHAR(50) DEFAULT 'Count', -- Count, Sum, Average
    
    -- Position
    idx INT DEFAULT 0,
    
    -- Standard
    is_standard BOOLEAN DEFAULT false,
    
    -- Metadata
    owner VARCHAR(255),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    UNIQUE(tenant_id, name)
);

CREATE INDEX idx_dashboard_charts_tenant ON dashboard_charts(tenant_id);
CREATE INDEX idx_dashboard_charts_dashboard ON dashboard_charts(tenant_id, dashboard);

-- Number Card (KPI cards)
CREATE TABLE number_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL,
    card_name VARCHAR(500),
    
    -- Dashboard
    dashboard VARCHAR(255),
    
    -- Type
    card_type VARCHAR(50) DEFAULT 'Document Type', -- Document Type, Report, Custom
    
    -- Source
    document_type VARCHAR(255),
    report_name VARCHAR(255),
    
    -- Filters (JSON)
    filters TEXT,
    
    -- Function
    function VARCHAR(50) DEFAULT 'Count', -- Count, Sum, Average
    aggregate_function_based_on VARCHAR(255), -- Field for Sum/Average
    
    -- Display
    label VARCHAR(500),
    color VARCHAR(50),
    
    -- Goal
    show_percentage_stats BOOLEAN DEFAULT false,
    stats_time_interval VARCHAR(50), -- Daily, Weekly, Monthly, Yearly
    
    -- Position
    idx INT DEFAULT 0,
    
    -- Standard
    is_standard BOOLEAN DEFAULT false,
    
    -- Metadata
    owner VARCHAR(255),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    UNIQUE(tenant_id, name)
);

CREATE INDEX idx_number_cards_tenant ON number_cards(tenant_id);
CREATE INDEX idx_number_cards_dashboard ON number_cards(tenant_id, dashboard);

-- Scheduled Report (Auto-send reports)
CREATE TABLE scheduled_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL,
    
    -- Report
    report VARCHAR(255) NOT NULL,
    
    -- Schedule
    frequency VARCHAR(50) DEFAULT 'Weekly', -- Daily, Weekly, Monthly
    day_of_week INT, -- 0=Sunday, 6=Saturday
    day_of_month INT, -- 1-28
    time_of_day TIME DEFAULT '08:00:00',
    
    -- Recipients
    recipients TEXT, -- Comma-separated emails
    
    -- Format
    format VARCHAR(20) DEFAULT 'PDF', -- PDF, Excel, CSV
    
    -- Filters (JSON)
    filters TEXT,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    last_sent_at TIMESTAMPTZ,
    
    -- Metadata
    owner VARCHAR(255),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    UNIQUE(tenant_id, name)
);

CREATE INDEX idx_scheduled_reports_tenant ON scheduled_reports(tenant_id);
CREATE INDEX idx_scheduled_reports_active ON scheduled_reports(tenant_id, is_active);

-- Enable Row Level Security
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_charts ENABLE ROW LEVEL SECURITY;
ALTER TABLE number_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_reports ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY reports_tenant_isolation ON reports
    USING (tenant_id::text = current_setting('app.tenant', true));
CREATE POLICY saved_reports_tenant_isolation ON saved_reports
    USING (tenant_id::text = current_setting('app.tenant', true));
CREATE POLICY dashboards_tenant_isolation ON dashboards
    USING (tenant_id::text = current_setting('app.tenant', true));
CREATE POLICY dashboard_charts_tenant_isolation ON dashboard_charts
    USING (tenant_id::text = current_setting('app.tenant', true));
CREATE POLICY number_cards_tenant_isolation ON number_cards
    USING (tenant_id::text = current_setting('app.tenant', true));
CREATE POLICY scheduled_reports_tenant_isolation ON scheduled_reports
    USING (tenant_id::text = current_setting('app.tenant', true));
