-- HR Module: Employee, Department, Leave, Attendance

-- Department
CREATE TABLE departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL,
    department_name VARCHAR(500),
    
    -- Hierarchy
    parent_department VARCHAR(255),
    
    -- Company (for multi-company)
    company VARCHAR(255),
    
    is_active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    UNIQUE(tenant_id, name)
);

CREATE INDEX idx_departments_tenant ON departments(tenant_id);

-- Designation (Job titles)
CREATE TABLE designations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL,
    designation_name VARCHAR(500),
    
    description TEXT,
    
    is_active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    UNIQUE(tenant_id, name)
);

CREATE INDEX idx_designations_tenant ON designations(tenant_id);

-- Employment Type
CREATE TABLE employment_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL,
    employment_type_name VARCHAR(500),
    
    description TEXT,
    
    is_active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    UNIQUE(tenant_id, name)
);

CREATE INDEX idx_employment_types_tenant ON employment_types(tenant_id);

-- Employee
CREATE TABLE employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL, -- Employee ID
    
    -- Personal info
    first_name VARCHAR(255) NOT NULL,
    middle_name VARCHAR(255),
    last_name VARCHAR(255),
    full_name VARCHAR(500),
    
    gender VARCHAR(20),
    date_of_birth DATE,
    
    -- Contact
    personal_email VARCHAR(255),
    company_email VARCHAR(255),
    cell_number VARCHAR(50),
    
    -- Employment
    status VARCHAR(50) DEFAULT 'Active', -- Active, Left, Inactive
    employment_type VARCHAR(255),
    department VARCHAR(255),
    designation VARCHAR(255),
    reports_to VARCHAR(255), -- Employee ID of manager
    
    -- Dates
    date_of_joining DATE,
    date_of_confirmation DATE,
    date_of_retirement DATE,
    relieving_date DATE,
    
    -- Leave policy
    leave_policy VARCHAR(255),
    
    -- Salary
    salary_currency VARCHAR(10) DEFAULT 'USD',
    salary_mode VARCHAR(50), -- Bank, Cash, Cheque
    
    -- Bank details
    bank_name VARCHAR(255),
    bank_account_number VARCHAR(100),
    
    -- Government IDs
    tax_id VARCHAR(100),
    social_security_number VARCHAR(100),
    
    -- Address
    current_address TEXT,
    permanent_address TEXT,
    
    -- Emergency contact
    emergency_contact_name VARCHAR(255),
    emergency_contact_phone VARCHAR(50),
    emergency_contact_relation VARCHAR(100),
    
    -- User link
    user_id VARCHAR(255),
    
    -- Metadata
    owner VARCHAR(255),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    UNIQUE(tenant_id, name)
);

CREATE INDEX idx_employees_tenant ON employees(tenant_id);
CREATE INDEX idx_employees_status ON employees(tenant_id, status);
CREATE INDEX idx_employees_department ON employees(tenant_id, department);
CREATE INDEX idx_employees_reports_to ON employees(tenant_id, reports_to);
CREATE INDEX idx_employees_user ON employees(tenant_id, user_id);

-- Leave Type
CREATE TABLE leave_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL,
    leave_type_name VARCHAR(500),
    
    -- Allocation
    max_leaves_allowed INT DEFAULT 0,
    applicable_after INT DEFAULT 0, -- Days after joining
    max_continuous_days_allowed INT,
    
    -- Encashment
    is_encashable BOOLEAN DEFAULT false,
    encashment_threshold_days INT DEFAULT 0,
    
    -- Carry forward
    is_carry_forward BOOLEAN DEFAULT false,
    max_carry_forward_days INT DEFAULT 0,
    
    -- Settings
    is_lwp BOOLEAN DEFAULT false, -- Leave without pay
    include_holiday BOOLEAN DEFAULT false,
    is_compensatory BOOLEAN DEFAULT false,
    is_earned_leave BOOLEAN DEFAULT false,
    
    is_active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    UNIQUE(tenant_id, name)
);

CREATE INDEX idx_leave_types_tenant ON leave_types(tenant_id);

-- Leave Allocation (Employee leave balance)
CREATE TABLE leave_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL,
    
    employee VARCHAR(255) NOT NULL,
    leave_type VARCHAR(255) NOT NULL,
    
    -- Period
    from_date DATE NOT NULL,
    to_date DATE NOT NULL,
    
    -- Leaves
    new_leaves_allocated DECIMAL(10,2) DEFAULT 0,
    carry_forward_leaves DECIMAL(10,2) DEFAULT 0,
    total_leaves_allocated DECIMAL(10,2) DEFAULT 0,
    
    -- Status
    docstatus INT DEFAULT 0,
    
    notes TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    UNIQUE(tenant_id, name)
);

CREATE INDEX idx_leave_allocations_tenant ON leave_allocations(tenant_id);
CREATE INDEX idx_leave_allocations_employee ON leave_allocations(tenant_id, employee);
CREATE INDEX idx_leave_allocations_type ON leave_allocations(tenant_id, leave_type);

-- Leave Application
CREATE TABLE leave_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL,
    
    employee VARCHAR(255) NOT NULL,
    employee_name VARCHAR(500),
    leave_type VARCHAR(255) NOT NULL,
    
    -- Period
    from_date DATE NOT NULL,
    to_date DATE NOT NULL,
    half_day BOOLEAN DEFAULT false,
    half_day_date DATE,
    
    -- Days
    total_leave_days DECIMAL(10,2) DEFAULT 0,
    
    -- Status
    status VARCHAR(50) DEFAULT 'Open', -- Open, Approved, Rejected, Cancelled
    docstatus INT DEFAULT 0,
    
    -- Reason
    reason TEXT,
    
    -- Approval
    leave_approver VARCHAR(255),
    
    -- Posting date
    posting_date DATE DEFAULT CURRENT_DATE,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    UNIQUE(tenant_id, name)
);

CREATE INDEX idx_leave_applications_tenant ON leave_applications(tenant_id);
CREATE INDEX idx_leave_applications_employee ON leave_applications(tenant_id, employee);
CREATE INDEX idx_leave_applications_status ON leave_applications(tenant_id, status);
CREATE INDEX idx_leave_applications_dates ON leave_applications(tenant_id, from_date, to_date);

-- Attendance
CREATE TABLE attendances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL,
    
    employee VARCHAR(255) NOT NULL,
    employee_name VARCHAR(500),
    
    -- Date
    attendance_date DATE NOT NULL,
    
    -- Status
    status VARCHAR(50) DEFAULT 'Present', -- Present, Absent, On Leave, Half Day, Work From Home
    
    -- Shift
    shift VARCHAR(255),
    
    -- Timing
    in_time TIME,
    out_time TIME,
    working_hours DECIMAL(10,2),
    
    -- Late/Early
    late_entry BOOLEAN DEFAULT false,
    early_exit BOOLEAN DEFAULT false,
    
    -- Leave link
    leave_type VARCHAR(255),
    leave_application VARCHAR(255),
    
    -- Notes
    remarks TEXT,
    
    -- Status
    docstatus INT DEFAULT 0,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    UNIQUE(tenant_id, name),
    UNIQUE(tenant_id, employee, attendance_date)
);

CREATE INDEX idx_attendance_tenant ON attendances(tenant_id);
CREATE INDEX idx_attendance_employee ON attendances(tenant_id, employee);
CREATE INDEX idx_attendance_date ON attendances(tenant_id, attendance_date);
CREATE INDEX idx_attendance_status ON attendances(tenant_id, status);

-- Enable Row Level Security
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE designations ENABLE ROW LEVEL SECURITY;
ALTER TABLE employment_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendances ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY departments_tenant_isolation ON departments
    USING (tenant_id::text = current_setting('app.tenant', true));
CREATE POLICY designations_tenant_isolation ON designations
    USING (tenant_id::text = current_setting('app.tenant', true));
CREATE POLICY employment_types_tenant_isolation ON employment_types
    USING (tenant_id::text = current_setting('app.tenant', true));
CREATE POLICY employees_tenant_isolation ON employees
    USING (tenant_id::text = current_setting('app.tenant', true));
CREATE POLICY leave_types_tenant_isolation ON leave_types
    USING (tenant_id::text = current_setting('app.tenant', true));
CREATE POLICY leave_allocations_tenant_isolation ON leave_allocations
    USING (tenant_id::text = current_setting('app.tenant', true));
CREATE POLICY leave_applications_tenant_isolation ON leave_applications
    USING (tenant_id::text = current_setting('app.tenant', true));
CREATE POLICY attendances_tenant_isolation ON attendances
    USING (tenant_id::text = current_setting('app.tenant', true));
