-- Party Masters: Customer, Supplier, Address, Contact

-- Address table (shared by Customers and Suppliers)
CREATE TABLE addresses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Linked entity
    link_doctype VARCHAR(100) NOT NULL, -- 'Customer' or 'Supplier'
    link_name VARCHAR(255) NOT NULL,    -- The customer/supplier name/code
    
    -- Address details
    address_type VARCHAR(50) NOT NULL DEFAULT 'Billing', -- Billing, Shipping, Office, etc.
    address_title VARCHAR(255),
    address_line1 VARCHAR(500),
    address_line2 VARCHAR(500),
    city VARCHAR(255),
    state VARCHAR(255),
    country VARCHAR(100) DEFAULT 'United States',
    postal_code VARCHAR(50),
    
    -- Contact at this address
    phone VARCHAR(50),
    fax VARCHAR(50),
    email VARCHAR(255),
    
    -- Flags
    is_primary_address BOOLEAN DEFAULT false,
    is_shipping_address BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_addresses_tenant ON addresses(tenant_id);
CREATE INDEX idx_addresses_link ON addresses(tenant_id, link_doctype, link_name);

-- Contact table (individuals associated with Customers/Suppliers)
CREATE TABLE contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Basic info
    name VARCHAR(255) NOT NULL, -- The contact ID/code
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    full_name VARCHAR(500),
    salutation VARCHAR(50),
    designation VARCHAR(255),
    
    -- Contact details
    email VARCHAR(255),
    phone VARCHAR(50),
    mobile VARCHAR(50),
    
    -- Flags
    is_primary_contact BOOLEAN DEFAULT false,
    is_billing_contact BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    UNIQUE(tenant_id, name)
);

CREATE INDEX idx_contacts_tenant ON contacts(tenant_id);

-- Contact Links (many-to-many between Contacts and Customers/Suppliers)
CREATE TABLE contact_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    link_doctype VARCHAR(100) NOT NULL, -- 'Customer' or 'Supplier'
    link_name VARCHAR(255) NOT NULL,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    UNIQUE(tenant_id, contact_id, link_doctype, link_name)
);

CREATE INDEX idx_contact_links_contact ON contact_links(contact_id);
CREATE INDEX idx_contact_links_link ON contact_links(tenant_id, link_doctype, link_name);

-- Customer table
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Identification
    code VARCHAR(255) NOT NULL,
    customer_name VARCHAR(500) NOT NULL,
    customer_type VARCHAR(50) DEFAULT 'Company', -- Company, Individual
    customer_group VARCHAR(255),
    territory VARCHAR(255),
    
    -- Tax info
    tax_id VARCHAR(100),
    tax_category VARCHAR(255),
    
    -- Defaults
    default_currency VARCHAR(10),
    default_price_list VARCHAR(255),
    default_payment_terms VARCHAR(255),
    
    -- Credit management
    credit_limit DECIMAL(18,6) DEFAULT 0,
    credit_days INT DEFAULT 0,
    
    -- Accounts
    receivable_account VARCHAR(255),
    
    -- Contact info (denormalized for convenience)
    primary_address TEXT,
    primary_contact VARCHAR(255),
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    is_frozen BOOLEAN DEFAULT false,
    
    -- Metadata
    website VARCHAR(500),
    notes TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    UNIQUE(tenant_id, code)
);

CREATE INDEX idx_customers_tenant ON customers(tenant_id);
CREATE INDEX idx_customers_name ON customers(tenant_id, customer_name);
CREATE INDEX idx_customers_group ON customers(tenant_id, customer_group);

-- Supplier table
CREATE TABLE suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Identification
    code VARCHAR(255) NOT NULL,
    supplier_name VARCHAR(500) NOT NULL,
    supplier_type VARCHAR(50) DEFAULT 'Company', -- Company, Individual
    supplier_group VARCHAR(255),
    country VARCHAR(100),
    
    -- Tax info
    tax_id VARCHAR(100),
    tax_category VARCHAR(255),
    tax_withholding_category VARCHAR(255),
    
    -- Defaults
    default_currency VARCHAR(10),
    default_price_list VARCHAR(255),
    default_payment_terms VARCHAR(255),
    
    -- Payment info
    payment_days INT DEFAULT 0,
    
    -- Accounts
    payable_account VARCHAR(255),
    expense_account VARCHAR(255),
    
    -- Contact info (denormalized for convenience)
    primary_address TEXT,
    primary_contact VARCHAR(255),
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    is_frozen BOOLEAN DEFAULT false,
    
    -- Metadata
    website VARCHAR(500),
    notes TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    UNIQUE(tenant_id, code)
);

CREATE INDEX idx_suppliers_tenant ON suppliers(tenant_id);
CREATE INDEX idx_suppliers_name ON suppliers(tenant_id, supplier_name);
CREATE INDEX idx_suppliers_group ON suppliers(tenant_id, supplier_group);

-- Enable Row Level Security
ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY addresses_tenant_isolation ON addresses
    USING (tenant_id::text = current_setting('app.tenant', true));

CREATE POLICY contacts_tenant_isolation ON contacts
    USING (tenant_id::text = current_setting('app.tenant', true));

CREATE POLICY contact_links_tenant_isolation ON contact_links
    USING (tenant_id::text = current_setting('app.tenant', true));

CREATE POLICY customers_tenant_isolation ON customers
    USING (tenant_id::text = current_setting('app.tenant', true));

CREATE POLICY suppliers_tenant_isolation ON suppliers
    USING (tenant_id::text = current_setting('app.tenant', true));
