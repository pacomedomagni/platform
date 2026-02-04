-- Payroll Module: Salary Structure, Salary Slip, Payroll Entry

-- Salary Component (Earnings/Deductions)
CREATE TABLE salary_components (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL,
    salary_component_name VARCHAR(500),
    
    -- Type
    component_type VARCHAR(50) DEFAULT 'Earning', -- Earning, Deduction
    
    -- Calculation
    type VARCHAR(50) DEFAULT 'Fixed', -- Fixed, Formula
    formula TEXT,
    formula_description TEXT,
    
    -- Defaults
    default_amount DECIMAL(18,6) DEFAULT 0,
    
    -- Settings
    is_tax_applicable BOOLEAN DEFAULT true,
    depends_on_payment_days BOOLEAN DEFAULT true,
    is_payable BOOLEAN DEFAULT true,
    
    -- Statistical component (for display only)
    statistical_component BOOLEAN DEFAULT false,
    
    -- Accounts
    expense_account VARCHAR(255),
    payable_account VARCHAR(255),
    
    description TEXT,
    
    is_active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    UNIQUE(tenant_id, name)
);

CREATE INDEX idx_salary_components_tenant ON salary_components(tenant_id);
CREATE INDEX idx_salary_components_type ON salary_components(tenant_id, component_type);

-- Salary Structure (Template for employee salaries)
CREATE TABLE salary_structures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL,
    
    -- Applicability
    is_active BOOLEAN DEFAULT true,
    is_default BOOLEAN DEFAULT false,
    
    -- Payroll
    payroll_frequency VARCHAR(50) DEFAULT 'Monthly', -- Monthly, Biweekly, Weekly
    currency VARCHAR(10) DEFAULT 'USD',
    
    -- Mode
    mode_of_payment VARCHAR(100),
    payment_account VARCHAR(255),
    
    -- Leave settings
    leave_encashment_amount_per_day DECIMAL(18,6) DEFAULT 0,
    max_benefits DECIMAL(18,6) DEFAULT 0,
    
    -- Status
    docstatus INT DEFAULT 0,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    UNIQUE(tenant_id, name)
);

CREATE INDEX idx_salary_structures_tenant ON salary_structures(tenant_id);

-- Salary Structure Detail (Components in structure)
CREATE TABLE salary_structure_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    parent_id UUID NOT NULL REFERENCES salary_structures(id) ON DELETE CASCADE,
    idx INT DEFAULT 0,
    
    salary_component VARCHAR(255) NOT NULL,
    
    -- Amounts
    amount DECIMAL(18,6) DEFAULT 0,
    formula TEXT,
    
    -- Condition
    condition TEXT,
    
    -- Settings
    depends_on_payment_days BOOLEAN DEFAULT true,
    is_tax_applicable BOOLEAN DEFAULT true,
    statistical_component BOOLEAN DEFAULT false,
    do_not_include_in_total BOOLEAN DEFAULT false,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_salary_structure_detail_parent ON salary_structure_details(parent_id);
CREATE INDEX idx_salary_structure_detail_tenant ON salary_structure_details(tenant_id);

-- Salary Slip (Employee monthly payslip)
CREATE TABLE salary_slips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL,
    
    -- Employee
    employee VARCHAR(255) NOT NULL,
    employee_name VARCHAR(500),
    department VARCHAR(255),
    designation VARCHAR(255),
    
    -- Structure
    salary_structure VARCHAR(255),
    
    -- Period
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    posting_date DATE DEFAULT CURRENT_DATE,
    
    -- Payment days
    total_working_days DECIMAL(10,2) DEFAULT 0,
    payment_days DECIMAL(10,2) DEFAULT 0,
    leave_without_pay DECIMAL(10,2) DEFAULT 0,
    absent_days DECIMAL(10,2) DEFAULT 0,
    
    -- Amounts
    gross_pay DECIMAL(18,6) DEFAULT 0,
    total_deduction DECIMAL(18,6) DEFAULT 0,
    net_pay DECIMAL(18,6) DEFAULT 0,
    rounded_total DECIMAL(18,6) DEFAULT 0,
    
    -- Currency
    currency VARCHAR(10) DEFAULT 'USD',
    
    -- Status
    status VARCHAR(50) DEFAULT 'Draft', -- Draft, Submitted, Cancelled
    docstatus INT DEFAULT 0,
    
    -- Payment
    mode_of_payment VARCHAR(100),
    bank_name VARCHAR(255),
    bank_account_no VARCHAR(100),
    
    -- Journal entry
    journal_entry VARCHAR(255),
    
    -- Payroll entry link
    payroll_entry VARCHAR(255),
    
    -- Metadata
    owner VARCHAR(255),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    UNIQUE(tenant_id, name)
);

CREATE INDEX idx_salary_slips_tenant ON salary_slips(tenant_id);
CREATE INDEX idx_salary_slips_employee ON salary_slips(tenant_id, employee);
CREATE INDEX idx_salary_slips_period ON salary_slips(tenant_id, start_date, end_date);
CREATE INDEX idx_salary_slips_status ON salary_slips(tenant_id, status);

-- Salary Slip Detail (Earnings/Deductions on slip)
CREATE TABLE salary_slip_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    parent_id UUID NOT NULL REFERENCES salary_slips(id) ON DELETE CASCADE,
    parentfield VARCHAR(50) DEFAULT 'earnings', -- earnings or deductions
    idx INT DEFAULT 0,
    
    salary_component VARCHAR(255) NOT NULL,
    
    amount DECIMAL(18,6) DEFAULT 0,
    default_amount DECIMAL(18,6) DEFAULT 0,
    
    is_tax_applicable BOOLEAN DEFAULT true,
    statistical_component BOOLEAN DEFAULT false,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_salary_slip_detail_parent ON salary_slip_details(parent_id);
CREATE INDEX idx_salary_slip_detail_tenant ON salary_slip_details(tenant_id);

-- Payroll Entry (Bulk salary slip creation)
CREATE TABLE payroll_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL,
    
    -- Period
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    posting_date DATE DEFAULT CURRENT_DATE,
    
    -- Filters
    department VARCHAR(255),
    designation VARCHAR(255),
    
    -- Currency
    currency VARCHAR(10) DEFAULT 'USD',
    exchange_rate DECIMAL(18,9) DEFAULT 1,
    
    -- Payment
    mode_of_payment VARCHAR(100),
    payment_account VARCHAR(255),
    
    -- Totals
    number_of_employees INT DEFAULT 0,
    total_amount DECIMAL(18,6) DEFAULT 0,
    
    -- Status
    status VARCHAR(50) DEFAULT 'Draft', -- Draft, Submitted
    docstatus INT DEFAULT 0,
    salary_slips_created BOOLEAN DEFAULT false,
    salary_slips_submitted BOOLEAN DEFAULT false,
    
    -- Metadata
    owner VARCHAR(255),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    UNIQUE(tenant_id, name)
);

CREATE INDEX idx_payroll_entries_tenant ON payroll_entries(tenant_id);
CREATE INDEX idx_payroll_entries_period ON payroll_entries(tenant_id, start_date, end_date);
CREATE INDEX idx_payroll_entries_status ON payroll_entries(tenant_id, status);

-- Enable Row Level Security
ALTER TABLE salary_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE salary_structures ENABLE ROW LEVEL SECURITY;
ALTER TABLE salary_structure_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE salary_slips ENABLE ROW LEVEL SECURITY;
ALTER TABLE salary_slip_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_entries ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY salary_components_tenant_isolation ON salary_components
    USING (tenant_id::text = current_setting('app.tenant', true));
CREATE POLICY salary_structures_tenant_isolation ON salary_structures
    USING (tenant_id::text = current_setting('app.tenant', true));
CREATE POLICY salary_structure_details_tenant_isolation ON salary_structure_details
    USING (tenant_id::text = current_setting('app.tenant', true));
CREATE POLICY salary_slips_tenant_isolation ON salary_slips
    USING (tenant_id::text = current_setting('app.tenant', true));
CREATE POLICY salary_slip_details_tenant_isolation ON salary_slip_details
    USING (tenant_id::text = current_setting('app.tenant', true));
CREATE POLICY payroll_entries_tenant_isolation ON payroll_entries
    USING (tenant_id::text = current_setting('app.tenant', true));
