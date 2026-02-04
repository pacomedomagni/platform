-- Projects Module: Project, Task, Timesheet

-- Project
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL,
    project_name VARCHAR(500),
    
    -- Status
    status VARCHAR(50) DEFAULT 'Open', -- Open, Completed, Cancelled, On Hold
    priority VARCHAR(20) DEFAULT 'Medium', -- Low, Medium, High
    is_active BOOLEAN DEFAULT true,
    
    -- Type
    project_type VARCHAR(100),
    
    -- Customer
    customer VARCHAR(255),
    
    -- Dates
    expected_start_date DATE,
    expected_end_date DATE,
    actual_start_date DATE,
    actual_end_date DATE,
    
    -- Progress
    percent_complete DECIMAL(5,2) DEFAULT 0,
    
    -- Budget
    estimated_cost DECIMAL(18,6) DEFAULT 0,
    total_cost DECIMAL(18,6) DEFAULT 0,
    total_billing_amount DECIMAL(18,6) DEFAULT 0,
    
    -- Time
    total_billable_hours DECIMAL(10,2) DEFAULT 0,
    total_billed_hours DECIMAL(10,2) DEFAULT 0,
    
    -- Settings
    is_template BOOLEAN DEFAULT false,
    
    -- Sales Order link
    sales_order VARCHAR(255),
    
    -- Department
    department VARCHAR(255),
    
    -- Notes
    notes TEXT,
    
    -- Metadata
    owner VARCHAR(255),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    UNIQUE(tenant_id, name)
);

CREATE INDEX idx_projects_tenant ON projects(tenant_id);
CREATE INDEX idx_projects_status ON projects(tenant_id, status);
CREATE INDEX idx_projects_customer ON projects(tenant_id, customer);
CREATE INDEX idx_projects_dates ON projects(tenant_id, expected_start_date, expected_end_date);

-- Task
CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL,
    subject VARCHAR(500) NOT NULL,
    
    -- Project
    project VARCHAR(255),
    
    -- Parent task (for subtasks)
    parent_task VARCHAR(255),
    
    -- Status
    status VARCHAR(50) DEFAULT 'Open', -- Open, Working, Pending Review, Overdue, Completed, Cancelled
    priority VARCHAR(20) DEFAULT 'Medium',
    
    -- Type
    task_type VARCHAR(100),
    
    -- Assignment
    assigned_to VARCHAR(255),
    
    -- Dates
    expected_start_date DATE,
    expected_end_date DATE,
    actual_start_date DATE,
    actual_end_date DATE,
    
    -- Time
    expected_hours DECIMAL(10,2) DEFAULT 0,
    actual_hours DECIMAL(10,2) DEFAULT 0,
    
    -- Progress
    percent_complete DECIMAL(5,2) DEFAULT 0,
    
    -- Billing
    is_billable BOOLEAN DEFAULT false,
    
    -- Dependencies
    depends_on TEXT, -- Comma-separated task names
    
    -- Description
    description TEXT,
    
    -- Review
    review_date DATE,
    closing_date DATE,
    
    -- Metadata
    owner VARCHAR(255),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    UNIQUE(tenant_id, name)
);

CREATE INDEX idx_tasks_tenant ON tasks(tenant_id);
CREATE INDEX idx_tasks_project ON tasks(tenant_id, project);
CREATE INDEX idx_tasks_status ON tasks(tenant_id, status);
CREATE INDEX idx_tasks_assigned ON tasks(tenant_id, assigned_to);
CREATE INDEX idx_tasks_parent ON tasks(tenant_id, parent_task);

-- Milestone
CREATE TABLE milestones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL,
    milestone_title VARCHAR(500),
    
    -- Project
    project VARCHAR(255) NOT NULL,
    
    -- Date
    milestone_date DATE,
    
    -- Status
    status VARCHAR(50) DEFAULT 'Pending', -- Pending, Completed
    
    -- Description
    description TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    UNIQUE(tenant_id, name)
);

CREATE INDEX idx_milestones_tenant ON milestones(tenant_id);
CREATE INDEX idx_milestones_project ON milestones(tenant_id, project);

-- Timesheet
CREATE TABLE timesheets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL,
    
    -- Employee
    employee VARCHAR(255) NOT NULL,
    employee_name VARCHAR(500),
    
    -- Period
    start_date DATE,
    end_date DATE,
    
    -- Totals
    total_hours DECIMAL(10,2) DEFAULT 0,
    total_billable_hours DECIMAL(10,2) DEFAULT 0,
    total_billed_hours DECIMAL(10,2) DEFAULT 0,
    total_billable_amount DECIMAL(18,6) DEFAULT 0,
    total_billed_amount DECIMAL(18,6) DEFAULT 0,
    
    -- Status
    status VARCHAR(50) DEFAULT 'Draft', -- Draft, Submitted, Billed, Cancelled
    docstatus INT DEFAULT 0,
    
    -- Invoice link
    sales_invoice VARCHAR(255),
    
    -- Notes
    notes TEXT,
    
    -- Metadata
    owner VARCHAR(255),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    UNIQUE(tenant_id, name)
);

CREATE INDEX idx_timesheets_tenant ON timesheets(tenant_id);
CREATE INDEX idx_timesheets_employee ON timesheets(tenant_id, employee);
CREATE INDEX idx_timesheets_status ON timesheets(tenant_id, status);
CREATE INDEX idx_timesheets_dates ON timesheets(tenant_id, start_date, end_date);

-- Timesheet Detail (Time logs)
CREATE TABLE timesheet_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    parent_id UUID NOT NULL REFERENCES timesheets(id) ON DELETE CASCADE,
    idx INT DEFAULT 0,
    
    -- Activity type
    activity_type VARCHAR(100),
    
    -- Project/Task
    project VARCHAR(255),
    task VARCHAR(255),
    
    -- Time
    from_time TIMESTAMPTZ,
    to_time TIMESTAMPTZ,
    hours DECIMAL(10,2) DEFAULT 0,
    
    -- Billing
    is_billable BOOLEAN DEFAULT false,
    billing_hours DECIMAL(10,2) DEFAULT 0,
    billing_rate DECIMAL(18,6) DEFAULT 0,
    billing_amount DECIMAL(18,6) DEFAULT 0,
    
    -- Costing
    costing_rate DECIMAL(18,6) DEFAULT 0,
    costing_amount DECIMAL(18,6) DEFAULT 0,
    
    -- Description
    description TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_timesheet_details_parent ON timesheet_details(parent_id);
CREATE INDEX idx_timesheet_details_tenant ON timesheet_details(tenant_id);
CREATE INDEX idx_timesheet_details_project ON timesheet_details(tenant_id, project);

-- Project Update (Status reports)
CREATE TABLE project_updates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL,
    
    -- Project
    project VARCHAR(255) NOT NULL,
    
    -- Date
    date DATE DEFAULT CURRENT_DATE,
    
    -- Status
    status VARCHAR(50), -- On Track, Behind, At Risk
    
    -- Progress
    percent_complete DECIMAL(5,2) DEFAULT 0,
    
    -- Content
    update_content TEXT,
    
    -- Metadata
    owner VARCHAR(255),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    UNIQUE(tenant_id, name)
);

CREATE INDEX idx_project_updates_tenant ON project_updates(tenant_id);
CREATE INDEX idx_project_updates_project ON project_updates(tenant_id, project);

-- Enable Row Level Security
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE timesheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE timesheet_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_updates ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY projects_tenant_isolation ON projects
    USING (tenant_id::text = current_setting('app.tenant', true));
CREATE POLICY tasks_tenant_isolation ON tasks
    USING (tenant_id::text = current_setting('app.tenant', true));
CREATE POLICY milestones_tenant_isolation ON milestones
    USING (tenant_id::text = current_setting('app.tenant', true));
CREATE POLICY timesheets_tenant_isolation ON timesheets
    USING (tenant_id::text = current_setting('app.tenant', true));
CREATE POLICY timesheet_details_tenant_isolation ON timesheet_details
    USING (tenant_id::text = current_setting('app.tenant', true));
CREATE POLICY project_updates_tenant_isolation ON project_updates
    USING (tenant_id::text = current_setting('app.tenant', true));
