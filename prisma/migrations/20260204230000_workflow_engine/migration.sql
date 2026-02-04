-- Workflow Engine: Workflow, Workflow State, Workflow Action, Workflow Transition

-- Workflow (State machine definition)
CREATE TABLE workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL,
    workflow_name VARCHAR(500),
    
    -- Document type this workflow applies to
    document_type VARCHAR(255) NOT NULL,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    
    -- Initial state
    initial_state VARCHAR(255),
    
    -- Settings
    send_email_alert BOOLEAN DEFAULT true,
    override_status BOOLEAN DEFAULT false, -- Override docstatus changes
    
    -- Description
    description TEXT,
    
    -- Metadata
    owner VARCHAR(255),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    UNIQUE(tenant_id, name)
);

CREATE INDEX idx_workflows_tenant ON workflows(tenant_id);
CREATE INDEX idx_workflows_doctype ON workflows(tenant_id, document_type);

-- Workflow State (States in the workflow)
CREATE TABLE workflow_states (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL,
    workflow_state_name VARCHAR(500),
    
    -- Style
    style VARCHAR(50) DEFAULT 'Primary', -- Primary, Success, Danger, Warning, Info
    
    -- Docstatus mapping
    doc_status VARCHAR(20) DEFAULT '0', -- 0, 1, 2 (Draft, Submitted, Cancelled)
    
    -- Permissions
    allow_edit VARCHAR(500), -- Comma-separated roles that can edit in this state
    
    is_active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    UNIQUE(tenant_id, name)
);

CREATE INDEX idx_workflow_states_tenant ON workflow_states(tenant_id);

-- Workflow Action (Actions that trigger transitions)
CREATE TABLE workflow_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL,
    workflow_action_name VARCHAR(500),
    
    is_active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    UNIQUE(tenant_id, name)
);

CREATE INDEX idx_workflow_actions_tenant ON workflow_actions(tenant_id);

-- Workflow Transition (Allowed state transitions)
CREATE TABLE workflow_transitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    idx INT DEFAULT 0,
    
    -- States
    from_state VARCHAR(255) NOT NULL,
    to_state VARCHAR(255) NOT NULL,
    
    -- Action that triggers this transition
    action VARCHAR(255) NOT NULL,
    
    -- Who can perform this action
    allowed_roles VARCHAR(500), -- Comma-separated roles
    
    -- Condition (formula that must be true)
    condition TEXT,
    
    -- Email settings
    send_email BOOLEAN DEFAULT false,
    email_subject TEXT,
    email_template VARCHAR(255),
    email_recipients TEXT, -- Field name or comma-separated emails
    
    -- Metadata
    notes TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_workflow_transitions_workflow ON workflow_transitions(workflow_id);
CREATE INDEX idx_workflow_transitions_tenant ON workflow_transitions(tenant_id);
CREATE INDEX idx_workflow_transitions_states ON workflow_transitions(tenant_id, from_state, to_state);

-- Workflow Action Log (Audit trail)
CREATE TABLE workflow_action_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Document reference
    doctype VARCHAR(255) NOT NULL,
    docname VARCHAR(255) NOT NULL,
    
    -- Workflow
    workflow VARCHAR(255),
    
    -- Transition
    action VARCHAR(255) NOT NULL,
    from_state VARCHAR(255),
    to_state VARCHAR(255),
    
    -- User
    user_id VARCHAR(255),
    user_name VARCHAR(500),
    
    -- Comment
    comment TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_workflow_action_logs_tenant ON workflow_action_logs(tenant_id);
CREATE INDEX idx_workflow_action_logs_doc ON workflow_action_logs(tenant_id, doctype, docname);
CREATE INDEX idx_workflow_action_logs_date ON workflow_action_logs(tenant_id, created_at);

-- Document Workflow State (Current state of a document)
CREATE TABLE document_workflow_states (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Document reference
    doctype VARCHAR(255) NOT NULL,
    docname VARCHAR(255) NOT NULL,
    
    -- Current state
    workflow_state VARCHAR(255) NOT NULL,
    workflow VARCHAR(255),
    
    -- Last action
    last_action VARCHAR(255),
    last_action_by VARCHAR(255),
    last_action_date TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    UNIQUE(tenant_id, doctype, docname)
);

CREATE INDEX idx_doc_workflow_states_tenant ON document_workflow_states(tenant_id);
CREATE INDEX idx_doc_workflow_states_state ON document_workflow_states(tenant_id, workflow_state);

-- Enable Row Level Security
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_transitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_action_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_workflow_states ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY workflows_tenant_isolation ON workflows
    USING (tenant_id::text = current_setting('app.tenant', true));
CREATE POLICY workflow_states_tenant_isolation ON workflow_states
    USING (tenant_id::text = current_setting('app.tenant', true));
CREATE POLICY workflow_actions_tenant_isolation ON workflow_actions
    USING (tenant_id::text = current_setting('app.tenant', true));
CREATE POLICY workflow_transitions_tenant_isolation ON workflow_transitions
    USING (tenant_id::text = current_setting('app.tenant', true));
CREATE POLICY workflow_action_logs_tenant_isolation ON workflow_action_logs
    USING (tenant_id::text = current_setting('app.tenant', true));
CREATE POLICY doc_workflow_states_tenant_isolation ON document_workflow_states
    USING (tenant_id::text = current_setting('app.tenant', true));
