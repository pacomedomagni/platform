-- Banking Module: Bank, Bank Account, Bank Transaction, Bank Reconciliation

-- Bank Master (Financial Institution)
CREATE TABLE banks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    code VARCHAR(100) NOT NULL,
    bank_name VARCHAR(500) NOT NULL,
    
    -- Contact info
    website VARCHAR(500),
    swift_code VARCHAR(50),
    
    is_active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    UNIQUE(tenant_id, code)
);

CREATE INDEX idx_banks_tenant ON banks(tenant_id);

-- Bank Account (Company's account at a bank)
CREATE TABLE bank_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL, -- Account identifier/name
    
    -- Bank reference
    bank_code VARCHAR(100),
    
    -- Account details
    account_number VARCHAR(100),
    account_type VARCHAR(50) DEFAULT 'Current', -- Current, Savings, Credit Card, etc.
    iban VARCHAR(50),
    branch_code VARCHAR(50),
    
    -- GL Account link
    gl_account VARCHAR(255), -- Link to Account master
    
    -- Currency
    currency VARCHAR(10) DEFAULT 'USD',
    
    -- Balances (synced from bank or reconciliation)
    bank_balance DECIMAL(18,6) DEFAULT 0,
    last_sync_date DATE,
    
    -- Integration
    integration_id VARCHAR(255), -- For Plaid or other bank feed providers
    
    is_default BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    UNIQUE(tenant_id, name)
);

CREATE INDEX idx_bank_accounts_tenant ON bank_accounts(tenant_id);
CREATE INDEX idx_bank_accounts_gl ON bank_accounts(tenant_id, gl_account);

-- Bank Transaction (Imported bank feed entries)
CREATE TABLE bank_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL,
    
    -- Bank account reference
    bank_account VARCHAR(255) NOT NULL,
    
    -- Transaction details
    transaction_date DATE NOT NULL,
    amount DECIMAL(18,6) NOT NULL,
    currency VARCHAR(10) DEFAULT 'USD',
    
    -- Direction
    transaction_type VARCHAR(20) NOT NULL, -- 'Credit' or 'Debit'
    
    -- Description from bank
    description TEXT,
    reference_number VARCHAR(255),
    
    -- Categorization
    party_type VARCHAR(50), -- 'Customer', 'Supplier', 'Employee'
    party VARCHAR(255),
    
    -- Status
    status VARCHAR(50) DEFAULT 'Unreconciled', -- Unreconciled, Reconciled, Matched
    
    -- Linked documents
    payment_entry VARCHAR(255),
    invoice VARCHAR(255),
    
    -- Reconciliation reference
    reconciliation_id UUID,
    
    -- Import metadata
    import_batch VARCHAR(255),
    external_id VARCHAR(255), -- Transaction ID from bank
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    UNIQUE(tenant_id, name)
);

CREATE INDEX idx_bank_transactions_tenant ON bank_transactions(tenant_id);
CREATE INDEX idx_bank_transactions_account ON bank_transactions(tenant_id, bank_account);
CREATE INDEX idx_bank_transactions_date ON bank_transactions(tenant_id, transaction_date);
CREATE INDEX idx_bank_transactions_status ON bank_transactions(tenant_id, status);
CREATE INDEX idx_bank_transactions_external ON bank_transactions(tenant_id, external_id);

-- Bank Reconciliation (Session for reconciling)
CREATE TABLE bank_reconciliations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL,
    
    -- Bank account
    bank_account VARCHAR(255) NOT NULL,
    
    -- Period
    from_date DATE NOT NULL,
    to_date DATE NOT NULL,
    
    -- Balances
    opening_balance DECIMAL(18,6) DEFAULT 0,
    closing_balance DECIMAL(18,6) DEFAULT 0,
    bank_statement_balance DECIMAL(18,6) DEFAULT 0,
    
    -- Difference
    difference DECIMAL(18,6) DEFAULT 0,
    
    -- Status
    docstatus INT DEFAULT 0, -- 0=Draft, 1=Reconciled
    status VARCHAR(50) DEFAULT 'Draft',
    
    -- Notes
    notes TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    owner VARCHAR(255),
    
    UNIQUE(tenant_id, name)
);

CREATE INDEX idx_bank_reconciliation_tenant ON bank_reconciliations(tenant_id);
CREATE INDEX idx_bank_reconciliation_account ON bank_reconciliations(tenant_id, bank_account);

-- Bank Reconciliation Detail (Matched transactions)
CREATE TABLE bank_reconciliation_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    parent UUID NOT NULL REFERENCES bank_reconciliations(id) ON DELETE CASCADE,
    
    -- Bank transaction reference
    bank_transaction VARCHAR(255),
    
    -- Or GL entry reference (for unmatched GL entries)
    gl_entry_id UUID,
    
    -- Matched payment/journal entry
    voucher_type VARCHAR(100),
    voucher_no VARCHAR(255),
    
    -- Amount
    amount DECIMAL(18,6) NOT NULL,
    posting_date DATE,
    
    -- Match status
    is_matched BOOLEAN DEFAULT false,
    clearance_date DATE,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bank_recon_detail_parent ON bank_reconciliation_details(parent);
CREATE INDEX idx_bank_recon_detail_tenant ON bank_reconciliation_details(tenant_id);

-- Auto-Matching Rules
CREATE TABLE bank_matching_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL,
    
    -- Rule conditions
    bank_account VARCHAR(255), -- Apply to specific account or all
    description_contains VARCHAR(500),
    description_regex VARCHAR(500),
    amount_min DECIMAL(18,6),
    amount_max DECIMAL(18,6),
    transaction_type VARCHAR(20), -- 'Credit' or 'Debit'
    
    -- Actions
    action VARCHAR(50) DEFAULT 'Create Payment Entry', -- Create Payment Entry, Match Existing, Categorize
    party_type VARCHAR(50),
    party VARCHAR(255),
    account VARCHAR(255),
    
    -- Priority
    priority INT DEFAULT 0,
    
    is_active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    UNIQUE(tenant_id, name)
);

CREATE INDEX idx_bank_matching_rules_tenant ON bank_matching_rules(tenant_id);

-- Enable Row Level Security
ALTER TABLE banks ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_reconciliations ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_reconciliation_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_matching_rules ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY banks_tenant_isolation ON banks
    USING (tenant_id::text = current_setting('app.tenant', true));
CREATE POLICY bank_accounts_tenant_isolation ON bank_accounts
    USING (tenant_id::text = current_setting('app.tenant', true));
CREATE POLICY bank_transactions_tenant_isolation ON bank_transactions
    USING (tenant_id::text = current_setting('app.tenant', true));
CREATE POLICY bank_reconciliations_tenant_isolation ON bank_reconciliations
    USING (tenant_id::text = current_setting('app.tenant', true));
CREATE POLICY bank_recon_details_tenant_isolation ON bank_reconciliation_details
    USING (tenant_id::text = current_setting('app.tenant', true));
CREATE POLICY bank_matching_rules_tenant_isolation ON bank_matching_rules
    USING (tenant_id::text = current_setting('app.tenant', true));
