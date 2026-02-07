-- CRM Module: Lead, Opportunity, Activity, Campaign

-- Lead (Prospective customers)
CREATE TABLE leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL,
    
    -- Lead info
    lead_name VARCHAR(500),
    company_name VARCHAR(500),
    
    -- Contact details
    email VARCHAR(255),
    phone VARCHAR(50),
    mobile VARCHAR(50),
    website VARCHAR(500),
    
    -- Source
    source VARCHAR(255), -- Website, Referral, Cold Call, etc.
    campaign VARCHAR(255),
    
    -- Classification
    status VARCHAR(50) DEFAULT 'Open', -- Open, Contacted, Qualified, Converted, Lost
    lead_type VARCHAR(50) DEFAULT 'Client', -- Client, Channel Partner, Consultant
    industry VARCHAR(255),
    
    -- Assignment
    lead_owner VARCHAR(255),
    territory VARCHAR(255),
    
    -- Address
    address_line1 VARCHAR(500),
    address_line2 VARCHAR(500),
    city VARCHAR(255),
    state VARCHAR(255),
    country VARCHAR(100),
    postal_code VARCHAR(50),
    
    -- Qualification
    qualification_status VARCHAR(50), -- Unqualified, Warm, Hot
    annual_revenue DECIMAL(18,6),
    
    -- Conversion
    converted_to_customer VARCHAR(255),
    conversion_date DATE,
    
    -- Notes
    notes TEXT,
    
    -- Next action
    next_contact_date DATE,
    next_contact_by VARCHAR(255),
    
    -- Metadata
    owner VARCHAR(255),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    UNIQUE(tenant_id, name)
);

CREATE INDEX idx_leads_tenant ON leads(tenant_id);
CREATE INDEX idx_leads_status ON leads(tenant_id, status);
CREATE INDEX idx_leads_owner ON leads(tenant_id, lead_owner);
CREATE INDEX idx_leads_email ON leads(tenant_id, email);

-- Opportunity (Sales deals in pipeline)
CREATE TABLE opportunities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL,
    
    -- Opportunity info
    opportunity_from VARCHAR(50) DEFAULT 'Lead', -- Lead, Customer
    party_name VARCHAR(255), -- Lead or Customer name
    
    -- Contact
    contact_person VARCHAR(255),
    customer_name VARCHAR(500),
    
    -- Sales info
    opportunity_type VARCHAR(50), -- Sales, Maintenance, etc.
    sales_stage VARCHAR(50) DEFAULT 'Prospecting', -- Prospecting, Qualification, Needs Analysis, Proposal, Negotiation, Closed Won, Closed Lost
    probability DECIMAL(5,2) DEFAULT 0, -- 0-100%
    
    -- Value
    currency VARCHAR(10) DEFAULT 'USD',
    opportunity_amount DECIMAL(18,6) DEFAULT 0,
    
    -- Dates
    expected_closing DATE,
    transaction_date DATE DEFAULT CURRENT_DATE,
    
    -- Status
    status VARCHAR(50) DEFAULT 'Open', -- Open, Quotation, Converted, Lost, Replied
    
    -- Source
    source VARCHAR(255),
    campaign VARCHAR(255),
    
    -- Assignment
    opportunity_owner VARCHAR(255),
    territory VARCHAR(255),
    
    -- Conversion
    converted_by VARCHAR(255),
    order_lost_reason VARCHAR(500),
    quotation VARCHAR(255),
    
    -- Notes
    notes TEXT,
    
    -- Next action
    next_contact_date DATE,
    next_contact_by VARCHAR(255),
    
    -- Metadata
    owner VARCHAR(255),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    UNIQUE(tenant_id, name)
);

CREATE INDEX idx_opportunities_tenant ON opportunities(tenant_id);
CREATE INDEX idx_opportunities_status ON opportunities(tenant_id, status);
CREATE INDEX idx_opportunities_stage ON opportunities(tenant_id, sales_stage);
CREATE INDEX idx_opportunities_owner ON opportunities(tenant_id, opportunity_owner);
CREATE INDEX idx_opportunities_closing ON opportunities(tenant_id, expected_closing);

-- Activity (Calls, Meetings, Tasks)
CREATE TABLE activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL,
    
    -- Activity type
    activity_type VARCHAR(50) NOT NULL, -- Call, Meeting, Task, Email, Other
    
    -- Subject
    subject VARCHAR(500),
    
    -- Status
    status VARCHAR(50) DEFAULT 'Open', -- Open, Completed, Cancelled
    priority VARCHAR(20) DEFAULT 'Medium', -- Low, Medium, High
    
    -- Timing
    starts_on TIMESTAMPTZ,
    ends_on TIMESTAMPTZ,
    all_day BOOLEAN DEFAULT false,
    
    -- Due (for tasks)
    due_date DATE,
    
    -- Assignment
    assigned_to VARCHAR(255),
    
    -- Links
    reference_doctype VARCHAR(100), -- Lead, Opportunity, Customer, etc.
    reference_name VARCHAR(255),
    
    -- Contact
    contact VARCHAR(255),
    
    -- Details
    description TEXT,
    outcome TEXT,
    
    -- Reminder
    send_reminder BOOLEAN DEFAULT false,
    remind_before INT DEFAULT 15, -- minutes
    
    -- Recurrence
    is_recurring BOOLEAN DEFAULT false,
    repeat_on VARCHAR(50), -- Daily, Weekly, Monthly
    repeat_till DATE,
    
    -- Metadata
    owner VARCHAR(255),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    UNIQUE(tenant_id, name)
);

CREATE INDEX idx_activities_tenant ON activities(tenant_id);
CREATE INDEX idx_activities_type ON activities(tenant_id, activity_type);
CREATE INDEX idx_activities_status ON activities(tenant_id, status);
CREATE INDEX idx_activities_assigned ON activities(tenant_id, assigned_to);
CREATE INDEX idx_activities_date ON activities(tenant_id, starts_on);
CREATE INDEX idx_activities_reference ON activities(tenant_id, reference_doctype, reference_name);

-- Campaign (Marketing campaigns)
CREATE TABLE campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL,
    campaign_name VARCHAR(500),
    
    -- Type
    campaign_type VARCHAR(100), -- Email, Social, Advertising, etc.
    
    -- Status
    status VARCHAR(50) DEFAULT 'Planned', -- Planned, In Progress, Completed, Cancelled
    
    -- Dates
    start_date DATE,
    end_date DATE,
    
    -- Budget
    expected_revenue DECIMAL(18,6) DEFAULT 0,
    actual_revenue DECIMAL(18,6) DEFAULT 0,
    budgeted_cost DECIMAL(18,6) DEFAULT 0,
    actual_cost DECIMAL(18,6) DEFAULT 0,
    
    -- Description
    description TEXT,
    
    -- Metadata
    owner VARCHAR(255),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    UNIQUE(tenant_id, name)
);

CREATE INDEX idx_campaigns_tenant ON campaigns(tenant_id);
CREATE INDEX idx_campaigns_status ON campaigns(tenant_id, status);
CREATE INDEX idx_campaigns_dates ON campaigns(tenant_id, start_date, end_date);

-- Email Campaign (Drip sequences)
CREATE TABLE email_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL,
    
    -- Campaign link
    campaign VARCHAR(255),
    
    -- Email account
    email_account VARCHAR(255),
    
    -- Target
    email_template VARCHAR(255),
    
    -- Status
    status VARCHAR(50) DEFAULT 'Draft', -- Draft, Scheduled, Sending, Completed
    
    -- Schedule
    scheduled_date DATE,
    scheduled_time TIME,
    
    -- Stats
    total_recipients INT DEFAULT 0,
    emails_sent INT DEFAULT 0,
    emails_opened INT DEFAULT 0,
    emails_clicked INT DEFAULT 0,
    unsubscribed INT DEFAULT 0,
    
    -- Metadata
    owner VARCHAR(255),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    UNIQUE(tenant_id, name)
);

CREATE INDEX idx_email_campaigns_tenant ON email_campaigns(tenant_id);
CREATE INDEX idx_email_campaigns_status ON email_campaigns(tenant_id, status);

-- Enable Row Level Security
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_campaigns ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY leads_tenant_isolation ON leads
    USING (tenant_id::text = current_setting('app.tenant', true));
CREATE POLICY opportunities_tenant_isolation ON opportunities
    USING (tenant_id::text = current_setting('app.tenant', true));
CREATE POLICY activities_tenant_isolation ON activities
    USING (tenant_id::text = current_setting('app.tenant', true));
CREATE POLICY campaigns_tenant_isolation ON campaigns
    USING (tenant_id::text = current_setting('app.tenant', true));
CREATE POLICY email_campaigns_tenant_isolation ON email_campaigns
    USING (tenant_id::text = current_setting('app.tenant', true));
