-- =============================================================================
-- COVE V1 - Construction Operations Value Engine
-- Migration 00001: Initial Database Schema
-- Multi-Tenant Modular Monolith with PostgreSQL
-- =============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. ORGANIZATIONS TABLE
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    legal_name TEXT,
    business_type TEXT DEFAULT 'General Contractor',
    email TEXT,
    phone TEXT,
    website TEXT,
    address TEXT,
    city TEXT DEFAULT 'Jakarta',
    province TEXT DEFAULT 'DKI Jakarta',
    country TEXT DEFAULT 'Indonesia',
    default_currency TEXT DEFAULT 'IDR',
    timezone TEXT DEFAULT 'Asia/Jakarta',
    logo_url TEXT,
    subscription_status TEXT DEFAULT 'active' CHECK (subscription_status IN ('trial', 'active', 'suspended', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. PROFILES TABLE (Linked with Supabase Auth)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID UNIQUE,
    full_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. ORGANIZATION_MEMBERS TABLE
CREATE TABLE IF NOT EXISTS organization_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'VIEWER' CHECK (role IN (
        'OWNER', 'ADMIN', 'COMMERCIAL_MANAGER', 'QS', 'FINANCE_MANAGER', 
        'PROJECT_MANAGER', 'PROJECT_CONTROL', 'PROCUREMENT', 'VIEWER'
    )),
    job_title TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('invited', 'active', 'disabled')),
    invited_at TIMESTAMPTZ DEFAULT NOW(),
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_org_user UNIQUE (organization_id, user_id)
);

-- 4. CLIENTS TABLE
CREATE TABLE IF NOT EXISTS clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    client_code TEXT,
    name TEXT NOT NULL,
    legal_name TEXT,
    client_type TEXT DEFAULT 'Developer / Private Owner',
    email TEXT,
    phone TEXT,
    address TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. PROJECTS TABLE
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    project_code TEXT NOT NULL,
    project_name TEXT NOT NULL,
    description TEXT,
    project_type TEXT DEFAULT 'Commercial Building',
    location TEXT,
    city TEXT DEFAULT 'Jakarta',
    province TEXT DEFAULT 'DKI Jakarta',
    contract_start_date DATE,
    contract_finish_date DATE,
    forecast_finish_date DATE,
    currency_code TEXT DEFAULT 'IDR',
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'on_hold', 'completed', 'closed', 'cancelled')),
    project_manager_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    commercial_manager_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    finance_owner_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    project_controller_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    deleted_at TIMESTAMPTZ,
    CONSTRAINT uq_org_project_code UNIQUE (organization_id, project_code)
);

-- 6. PROJECT_MEMBERS TABLE (For Project-restricted access)
CREATE TABLE IF NOT EXISTS project_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    project_role TEXT,
    access_level TEXT DEFAULT 'edit' CHECK (access_level IN ('read', 'edit', 'manage')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_project_user UNIQUE (project_id, user_id)
);

-- 7. CONTRACTS TABLE
CREATE TABLE IF NOT EXISTS contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    contract_number TEXT NOT NULL,
    contract_title TEXT NOT NULL,
    original_contract_value NUMERIC(20,2) NOT NULL DEFAULT 0,
    current_contract_value NUMERIC(20,2) NOT NULL DEFAULT 0,
    payment_method TEXT DEFAULT 'Monthly Progress',
    payment_term_days INTEGER DEFAULT 30,
    retention_percent NUMERIC(8,4) DEFAULT 5.0,
    advance_payment_amount NUMERIC(20,2) DEFAULT 0,
    advance_recovery_amount NUMERIC(20,2) DEFAULT 0,
    currency_code TEXT DEFAULT 'IDR',
    effective_date DATE,
    start_date DATE,
    completion_date DATE,
    status TEXT DEFAULT 'active' CHECK (status IN ('draft', 'active', 'completed', 'terminated', 'cancelled')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. CLAIMS TABLE (Core Economic Unit)
CREATE TABLE IF NOT EXISTS claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    contract_id UUID REFERENCES contracts(id) ON DELETE SET NULL,
    claim_number TEXT NOT NULL,
    period_start DATE,
    period_end DATE,
    description TEXT,
    current_stage TEXT NOT NULL DEFAULT 'WORK_RECORDED' CHECK (current_stage IN (
        'WORK_RECORDED', 'MEASUREMENT', 'CLAIM_PREPARATION', 'CLAIM_READY',
        'SUBMITTED', 'UNDER_REVIEW', 'CERTIFIED', 'INVOICE_READY',
        'INVOICE_ISSUED', 'INVOICE_ACCEPTED', 'DUE', 'PARTIALLY_PAID', 'PAID',
        'ON_HOLD', 'DISPUTED', 'REJECTED', 'CANCELLED'
    )),
    risk_level TEXT DEFAULT 'HEALTHY' CHECK (risk_level IN ('HEALTHY', 'WATCH', 'AT_RISK', 'CRITICAL')),
    
    -- Economic Progression Values (Monetary)
    work_performed_value NUMERIC(20,2) NOT NULL DEFAULT 0,
    measured_value NUMERIC(20,2) NOT NULL DEFAULT 0,
    claimed_value NUMERIC(20,2) NOT NULL DEFAULT 0,
    certified_value NUMERIC(20,2) NOT NULL DEFAULT 0,
    expected_net_collectible NUMERIC(20,2) NOT NULL DEFAULT 0,
    cash_received_value NUMERIC(20,2) NOT NULL DEFAULT 0,
    
    expected_cash_date DATE,
    current_stage_entered_at TIMESTAMPTZ DEFAULT NOW(),
    responsible_owner_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    
    source_type TEXT DEFAULT 'manual' CHECK (source_type IN ('manual', 'csv_import', 'xlsx_import', 'api', 'integration', 'system')),
    source_reference TEXT,
    source_updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    deleted_at TIMESTAMPTZ,
    CONSTRAINT uq_org_project_claim UNIQUE (organization_id, project_id, claim_number)
);

-- 9. CLAIM_STAGE_HISTORY TABLE
CREATE TABLE IF NOT EXISTS claim_stage_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    claim_id UUID NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
    from_stage TEXT,
    to_stage TEXT NOT NULL,
    entered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    exited_at TIMESTAMPTZ,
    duration_hours NUMERIC(12,2),
    changed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    change_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. EVIDENCE_REQUIREMENTS TABLE (Master Template)
CREATE TABLE IF NOT EXISTS evidence_requirements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    required_by_default BOOLEAN DEFAULT TRUE,
    stage_requirement TEXT DEFAULT 'CLAIM_PREPARATION',
    active BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. CLAIM_EVIDENCE TABLE
CREATE TABLE IF NOT EXISTS claim_evidence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    claim_id UUID NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
    requirement_id UUID REFERENCES evidence_requirements(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    required BOOLEAN DEFAULT TRUE,
    status TEXT NOT NULL DEFAULT 'missing' CHECK (status IN ('missing', 'in_progress', 'uploaded', 'verified', 'not_applicable')),
    owner_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    due_date DATE,
    verified_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    verified_at TIMESTAMPTZ,
    document_id UUID,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. DOCUMENTS TABLE
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    document_type TEXT DEFAULT 'evidence',
    name TEXT NOT NULL,
    storage_path TEXT,
    external_url TEXT,
    mime_type TEXT,
    file_size BIGINT,
    version TEXT DEFAULT 'v1.0',
    uploaded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    uploaded_at TIMESTAMPTZ DEFAULT NOW(),
    notes TEXT
);

-- 13. BLOCKERS TABLE
CREATE TABLE IF NOT EXISTS blockers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL DEFAULT 'claim',
    entity_id UUID NOT NULL,
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    financial_exposure NUMERIC(20,2) NOT NULL DEFAULT 0,
    severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    controllability TEXT NOT NULL DEFAULT 'internal' CHECK (controllability IN ('internal', 'joint', 'external', 'not_software_addressable')),
    owner_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    raised_date DATE DEFAULT CURRENT_DATE,
    target_resolve_date DATE,
    resolved_date DATE,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'waiting_external', 'resolved', 'cancelled')),
    resolution TEXT,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 14. INVOICES TABLE
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    claim_id UUID REFERENCES claims(id) ON DELETE SET NULL,
    invoice_number TEXT NOT NULL,
    issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
    accepted_date DATE,
    due_date DATE NOT NULL,
    
    gross_amount NUMERIC(20,2) NOT NULL DEFAULT 0,
    retention_amount NUMERIC(20,2) DEFAULT 0,
    advance_recovery_amount NUMERIC(20,2) DEFAULT 0,
    tax_amount NUMERIC(20,2) DEFAULT 0,
    other_deduction_amount NUMERIC(20,2) DEFAULT 0,
    net_receivable_amount NUMERIC(20,2) NOT NULL DEFAULT 0,
    
    cash_received_amount NUMERIC(20,2) NOT NULL DEFAULT 0,
    outstanding_amount NUMERIC(20,2) NOT NULL DEFAULT 0,
    
    expected_payment_date DATE,
    status TEXT NOT NULL DEFAULT 'issued' CHECK (status IN (
        'draft', 'issued', 'accepted', 'due', 'overdue', 'partially_paid', 'paid', 'disputed', 'cancelled'
    )),
    finance_owner_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    deleted_at TIMESTAMPTZ,
    CONSTRAINT uq_org_invoice_number UNIQUE (organization_id, invoice_number)
);

-- 15. CASH_RECEIPTS TABLE
CREATE TABLE IF NOT EXISTS cash_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    receipt_number TEXT NOT NULL,
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    amount NUMERIC(20,2) NOT NULL CHECK (amount > 0),
    bank_reference TEXT,
    notes TEXT,
    recorded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 16. RETENTIONS TABLE
CREATE TABLE IF NOT EXISTS retentions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    claim_id UUID REFERENCES claims(id) ON DELETE SET NULL,
    invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
    amount NUMERIC(20,2) NOT NULL DEFAULT 0,
    release_condition TEXT DEFAULT 'FHO / Final Handover',
    expected_release_date DATE,
    actual_release_date DATE,
    status TEXT NOT NULL DEFAULT 'held' CHECK (status IN ('held', 'due_soon', 'due', 'released', 'disputed')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 17. STAGE_SLA_RULES TABLE
CREATE TABLE IF NOT EXISTS stage_sla_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    stage TEXT NOT NULL,
    warning_after_days INTEGER NOT NULL DEFAULT 7,
    risk_after_days INTEGER NOT NULL DEFAULT 14,
    critical_after_days INTEGER NOT NULL DEFAULT 21,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_org_stage_sla UNIQUE (organization_id, stage)
);

-- 18. ACTIONS TABLE (Core Action Engine)
CREATE TABLE IF NOT EXISTS actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    entity_type TEXT DEFAULT 'claim',
    entity_id UUID,
    risk_type TEXT,
    financial_exposure NUMERIC(20,2) NOT NULL DEFAULT 0,
    title TEXT NOT NULL,
    description TEXT,
    owner_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'waiting_external', 'blocked', 'resolved', 'cancelled')),
    due_date DATE,
    resolved_at TIMESTAMPTZ,
    resolution TEXT,
    outcome_type TEXT CHECK (outcome_type IN (
        'cash_released', 'exposure_reduced', 'claim_recovered', 'margin_protected',
        'cost_avoided', 'risk_accepted', 'no_financial_outcome', 'unknown'
    )),
    outcome_value NUMERIC(20,2) DEFAULT 0,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 19. NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    entity_type TEXT,
    entity_id UUID,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 20. IMPORTS & IMPORT_ROWS TABLES
CREATE TABLE IF NOT EXISTS imports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL,
    file_name TEXT NOT NULL,
    total_rows INTEGER DEFAULT 0,
    valid_rows INTEGER DEFAULT 0,
    failed_rows INTEGER DEFAULT 0,
    status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS import_rows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    import_id UUID NOT NULL REFERENCES imports(id) ON DELETE CASCADE,
    row_number INTEGER NOT NULL,
    raw_data JSONB NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('valid', 'error', 'imported')),
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 21. FEEDBACK & FEATURE_REQUESTS TABLES
CREATE TABLE IF NOT EXISTS feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    feedback_type TEXT NOT NULL CHECK (feedback_type IN (
        'Missing Feature', 'Workflow Problem', 'Bug', 'Report Request', 'Integration', 'Improvement', 'Other'
    )),
    current_page TEXT,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    description TEXT NOT NULL,
    attachment_url TEXT,
    app_version TEXT DEFAULT 'v1.0.0',
    status TEXT DEFAULT 'new' CHECK (status IN ('new', 'reviewed', 'in_backlog', 'resolved', 'closed')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS feature_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    requested_feature TEXT NOT NULL,
    underlying_problem TEXT,
    frequency TEXT DEFAULT 'occasional',
    financial_impact NUMERIC(20,2) DEFAULT 0,
    current_workaround TEXT,
    status TEXT DEFAULT 'investigate' CHECK (status IN ('investigate', 'planned', 'building', 'released', 'rejected', 'duplicate')),
    priority TEXT DEFAULT 'medium',
    decision_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 22. AUDIT_LOGS TABLE
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    event_type TEXT NOT NULL,
    old_values JSONB,
    new_values JSONB,
    source TEXT DEFAULT 'web_ui',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 23. PRODUCT_EVENTS TABLE (Internal Telemetry)
CREATE TABLE IF NOT EXISTS product_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    event_name TEXT NOT NULL,
    properties JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- INDEXES FOR HIGH-PERFORMANCE ECONOMIC QUERIES
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_org_members_org ON organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user ON organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_org ON projects(organization_id);
CREATE INDEX IF NOT EXISTS idx_projects_client ON projects(client_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_claims_org ON claims(organization_id);
CREATE INDEX IF NOT EXISTS idx_claims_project ON claims(project_id);
CREATE INDEX IF NOT EXISTS idx_claims_stage ON claims(current_stage);
CREATE INDEX IF NOT EXISTS idx_claims_risk ON claims(risk_level);
CREATE INDEX IF NOT EXISTS idx_claims_owner ON claims(responsible_owner_id);
CREATE INDEX IF NOT EXISTS idx_claim_history_claim ON claim_stage_history(claim_id);
CREATE INDEX IF NOT EXISTS idx_invoices_org ON invoices(organization_id);
CREATE INDEX IF NOT EXISTS idx_invoices_project ON invoices(project_id);
CREATE INDEX IF NOT EXISTS idx_invoices_claim ON invoices(claim_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_cash_receipts_invoice ON cash_receipts(invoice_id);
CREATE INDEX IF NOT EXISTS idx_blockers_org ON blockers(organization_id);
CREATE INDEX IF NOT EXISTS idx_blockers_project ON blockers(project_id);
CREATE INDEX IF NOT EXISTS idx_blockers_status ON blockers(status);
CREATE INDEX IF NOT EXISTS idx_actions_org ON actions(organization_id);
CREATE INDEX IF NOT EXISTS idx_actions_project ON actions(project_id);
CREATE INDEX IF NOT EXISTS idx_actions_owner ON actions(owner_id);
CREATE INDEX IF NOT EXISTS idx_actions_status ON actions(status);
CREATE INDEX IF NOT EXISTS idx_actions_priority ON actions(priority);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_org_entity ON audit_logs(organization_id, entity_type, entity_id);
