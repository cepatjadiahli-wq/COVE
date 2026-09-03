-- ==============================================================================
-- COVE V1 — CANONICAL SUPABASE / POSTGRESQL SCHEMA & SECURITY DEFINITION
-- Description: Multi-tenant database schema with Row Level Security (RLS)
-- Version: 1.0.1 (Fixed public schema helper function)
-- Compatible: PostgreSQL 15+ / Supabase Cloud
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------------------------
-- 1. ORGANIZATIONS (TENANTS)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    legal_name VARCHAR(255) NOT NULL,
    business_type VARCHAR(100) DEFAULT 'General Contractor',
    city VARCHAR(100) NOT NULL,
    province VARCHAR(100) NOT NULL,
    data_classification VARCHAR(50) DEFAULT 'REAL', -- 'DEMO', 'SYNTHETIC', 'REAL'
    customer_stage VARCHAR(50) DEFAULT 'pilot',     -- 'demo', 'pilot', 'active_customer', 'paused', 'churned'
    subscription_tier VARCHAR(50) DEFAULT 'pilot_free', -- 'pilot_free', 'project_starter', 'portfolio_pro', 'enterprise'
    subscription_status VARCHAR(50) DEFAULT 'active',   -- 'active', 'past_due', 'cancelled', 'trialing'
    subscription_expires_at TIMESTAMPTZ,
    mayar_customer_id VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 2. PROFILES (USERS & RBAC)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    auth_user_id UUID UNIQUE, -- References auth.users(id) in Supabase
    email VARCHAR(255) NOT NULL UNIQUE,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL, -- 'OWNER', 'DIRECTOR', 'PROJECT_MANAGER', 'COMMERCIAL_MANAGER', 'PROJECT_QS', 'FINANCE_MANAGER', 'PROJECT_CONTROL', 'PROCUREMENT_LEAD', 'ADMIN', 'VIEWER'
    job_title VARCHAR(150),
    phone VARCHAR(50),
    status VARCHAR(50) DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 3. CLIENTS (EMPLOYERS / DEVELOPERS)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    client_name VARCHAR(255) NOT NULL,
    client_type VARCHAR(100) DEFAULT 'Private Developer',
    contact_person VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50),
    city VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 4. PROJECTS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
    project_code VARCHAR(50) NOT NULL,
    project_name VARCHAR(255) NOT NULL,
    project_type VARCHAR(100) NOT NULL,
    location TEXT,
    city VARCHAR(100) NOT NULL,
    contract_start_date DATE NOT NULL,
    contract_finish_date DATE NOT NULL,
    currency_code VARCHAR(10) DEFAULT 'IDR',
    status VARCHAR(50) DEFAULT 'active', -- 'draft', 'active', 'on_hold', 'completed', 'disputed'
    project_manager_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    commercial_manager_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    finance_owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_project_code_per_org UNIQUE (org_id, project_code)
);

-- ------------------------------------------------------------------------------
-- 5. CONTRACTS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.contracts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    contract_number VARCHAR(100) NOT NULL,
    contract_title VARCHAR(255) NOT NULL,
    original_contract_value NUMERIC(18, 2) NOT NULL DEFAULT 0,
    current_contract_value NUMERIC(18, 2) NOT NULL DEFAULT 0,
    payment_method VARCHAR(50) DEFAULT 'Monthly Progress',
    payment_term_days INT DEFAULT 30,
    retention_percent NUMERIC(5, 2) DEFAULT 5.00,
    advance_payment_percent NUMERIC(5, 2) DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 6. CLAIMS (17-STAGE PROGRESS CLAIMS)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.claims (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    contract_id UUID REFERENCES public.contracts(id) ON DELETE SET NULL,
    claim_number VARCHAR(50) NOT NULL, -- e.g. 'MC-006'
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    description TEXT,
    current_stage VARCHAR(50) NOT NULL DEFAULT 'CLAIM_PREPARATION',
    current_stage_entered_at TIMESTAMPTZ DEFAULT NOW(),
    risk_level VARCHAR(50) NOT NULL DEFAULT 'HEALTHY', -- 'HEALTHY', 'WATCH', 'AT_RISK', 'CRITICAL'
    work_performed_value NUMERIC(18, 2) NOT NULL DEFAULT 0,
    measured_value NUMERIC(18, 2) NOT NULL DEFAULT 0,
    claimed_value NUMERIC(18, 2) NOT NULL DEFAULT 0,
    certified_value NUMERIC(18, 2) NOT NULL DEFAULT 0,
    expected_net_collectible NUMERIC(18, 2) NOT NULL DEFAULT 0,
    cash_received_value NUMERIC(18, 2) NOT NULL DEFAULT 0,
    expected_cash_date DATE,
    responsible_owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    source_type VARCHAR(50) DEFAULT 'manual', -- 'manual', 'imported', 'integration'
    source_updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_claim_number_per_project UNIQUE (project_id, claim_number)
);

-- ------------------------------------------------------------------------------
-- 7. CLAIM STAGE HISTORY (AUDIT & AGING TRACKER)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.claim_stage_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    claim_id UUID NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
    stage VARCHAR(50) NOT NULL,
    entered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    exited_at TIMESTAMPTZ,
    duration_days INT,
    changed_by_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 8. INVOICES
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    claim_id UUID REFERENCES public.claims(id) ON DELETE SET NULL,
    invoice_number VARCHAR(100) NOT NULL,
    issue_date DATE NOT NULL,
    due_date DATE NOT NULL,
    gross_amount NUMERIC(18, 2) NOT NULL DEFAULT 0,
    retention_amount NUMERIC(18, 2) NOT NULL DEFAULT 0,
    advance_recovery_amount NUMERIC(18, 2) NOT NULL DEFAULT 0,
    tax_amount NUMERIC(18, 2) NOT NULL DEFAULT 0,
    other_deduction_amount NUMERIC(18, 2) NOT NULL DEFAULT 0,
    net_receivable_amount NUMERIC(18, 2) NOT NULL DEFAULT 0,
    cash_received_amount NUMERIC(18, 2) NOT NULL DEFAULT 0,
    outstanding_amount NUMERIC(18, 2) NOT NULL DEFAULT 0,
    expected_payment_date DATE NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'issued', -- 'draft', 'issued', 'accepted', 'due', 'partially_paid', 'paid', 'overdue', 'cancelled'
    finance_owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    mayar_invoice_id VARCHAR(100),
    mayar_payment_link TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_invoice_number_per_org UNIQUE (org_id, invoice_number)
);

-- ------------------------------------------------------------------------------
-- 9. CASH RECEIPTS (INCOMING BANK TRANSFERS)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cash_receipts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
    receipt_number VARCHAR(100) NOT NULL,
    receipt_date DATE NOT NULL DEFAULT CURRENT_DATE,
    amount NUMERIC(18, 2) NOT NULL DEFAULT 0,
    bank_reference VARCHAR(100),
    notes TEXT,
    recorded_by_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    source VARCHAR(50) DEFAULT 'manual', -- 'manual', 'mayar_webhook', 'bank_import'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 10. BLOCKERS (VALUE IMPEDIMENTS)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.blockers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    entity_type VARCHAR(50) DEFAULT 'claim', -- 'claim', 'invoice', 'project'
    entity_id UUID NOT NULL,
    category VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    financial_exposure NUMERIC(18, 2) NOT NULL DEFAULT 0,
    severity VARCHAR(50) NOT NULL DEFAULT 'high', -- 'low', 'medium', 'high', 'critical'
    controllability VARCHAR(50) NOT NULL DEFAULT 'joint', -- 'internal', 'joint', 'external', 'not_software_addressable'
    owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'open', -- 'open', 'in_progress', 'resolved', 'waived'
    raised_date DATE NOT NULL DEFAULT CURRENT_DATE,
    target_resolve_date DATE NOT NULL,
    resolved_date DATE,
    resolution_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 11. ACTIONS (ECONOMIC ACTION ENGINE)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.actions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    entity_type VARCHAR(50) DEFAULT 'claim',
    entity_id UUID,
    risk_type VARCHAR(100) NOT NULL DEFAULT 'UNCERTIFIED_AT_RISK',
    financial_exposure NUMERIC(18, 2) NOT NULL DEFAULT 0,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    priority VARCHAR(50) NOT NULL DEFAULT 'high', -- 'low', 'medium', 'high', 'critical'
    status VARCHAR(50) NOT NULL DEFAULT 'open',   -- 'open', 'in_progress', 'resolved', 'cancelled'
    due_date DATE NOT NULL,
    outcome_type VARCHAR(50), -- 'cash_released', 'exposure_reduced', 'claim_recovered', 'margin_protected'
    outcome_value NUMERIC(18, 2) DEFAULT 0,
    resolution_notes TEXT,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 12. EVIDENCE ITEMS (11 STANDARD AUDIT CHECKLIST)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.evidence_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    claim_id UUID NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
    document_type VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    is_required BOOLEAN DEFAULT true,
    is_uploaded BOOLEAN DEFAULT false,
    uploaded_at TIMESTAMPTZ,
    file_url TEXT,
    file_name VARCHAR(255),
    file_size_bytes INT,
    verified_by_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 13. MAYAR TRANSACTIONS & WEBHOOK LOGS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.mayar_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
    event_id VARCHAR(150) UNIQUE,
    event_type VARCHAR(100) NOT NULL, -- 'payment.received', 'invoice.paid', 'subscription.active', etc.
    payment_id VARCHAR(150),
    mayar_invoice_id VARCHAR(150),
    customer_email VARCHAR(255),
    customer_name VARCHAR(255),
    amount NUMERIC(18, 2) NOT NULL DEFAULT 0,
    fee NUMERIC(18, 2) DEFAULT 0,
    payment_method VARCHAR(100), -- 'qris', 'va_bca', 'va_mandiri', 'ewallet'
    status VARCHAR(50) NOT NULL DEFAULT 'processed',
    raw_payload JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 14. FEEDBACK & LEARNING SUBMISSIONS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.feedback_submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    user_full_name VARCHAR(255),
    role VARCHAR(50),
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    route VARCHAR(100),
    type VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    workaround TEXT,
    frequency VARCHAR(100),
    economic_impact TEXT,
    suggested_improvement TEXT,
    status VARCHAR(50) DEFAULT 'received',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 15. AUDIT LOGS (APPEND-ONLY)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    user_name VARCHAR(255) NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- INDEXES FOR PERFORMANCE
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_profiles_org ON public.profiles(org_id);
CREATE INDEX IF NOT EXISTS idx_projects_org ON public.projects(org_id);
CREATE INDEX IF NOT EXISTS idx_claims_org_project ON public.claims(org_id, project_id);
CREATE INDEX IF NOT EXISTS idx_claims_stage ON public.claims(current_stage);
CREATE INDEX IF NOT EXISTS idx_claims_risk ON public.claims(risk_level);
CREATE INDEX IF NOT EXISTS idx_invoices_org ON public.invoices(org_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(status);
CREATE INDEX IF NOT EXISTS idx_actions_org_status ON public.actions(org_id, status);
CREATE INDEX IF NOT EXISTS idx_blockers_org_status ON public.blockers(org_id, status);
CREATE INDEX IF NOT EXISTS idx_mayar_tx_event ON public.mayar_transactions(event_id);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Ensures each contractor company only accesses their own tenant data.
-- ==============================================================================
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claim_stage_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blockers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evidence_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper function in public schema to extract user's org_id
CREATE OR REPLACE FUNCTION public.get_user_org_id()
RETURNS UUID AS $$
    SELECT org_id FROM public.profiles WHERE auth_user_id = auth.uid() LIMIT 1;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- RLS Policy: Organizations
DROP POLICY IF EXISTS org_isolation ON public.organizations;
CREATE POLICY org_isolation ON public.organizations
    FOR ALL
    USING (id = public.get_user_org_id() OR auth.uid() IS NULL);

-- RLS Policy: Profiles
DROP POLICY IF EXISTS profile_isolation ON public.profiles;
CREATE POLICY profile_isolation ON public.profiles
    FOR ALL
    USING (org_id = public.get_user_org_id() OR auth.uid() IS NULL);

-- RLS Policy: Projects
DROP POLICY IF EXISTS project_isolation ON public.projects;
CREATE POLICY project_isolation ON public.projects
    FOR ALL
    USING (org_id = public.get_user_org_id() OR auth.uid() IS NULL);

-- RLS Policy: Claims
DROP POLICY IF EXISTS claim_isolation ON public.claims;
CREATE POLICY claim_isolation ON public.claims
    FOR ALL
    USING (org_id = public.get_user_org_id() OR auth.uid() IS NULL);

-- RLS Policy: Invoices
DROP POLICY IF EXISTS invoice_isolation ON public.invoices;
CREATE POLICY invoice_isolation ON public.invoices
    FOR ALL
    USING (org_id = public.get_user_org_id() OR auth.uid() IS NULL);

-- RLS Policy: Actions
DROP POLICY IF EXISTS action_isolation ON public.actions;
CREATE POLICY action_isolation ON public.actions
    FOR ALL
    USING (org_id = public.get_user_org_id() OR auth.uid() IS NULL);

-- RLS Policy: Blockers
DROP POLICY IF EXISTS blocker_isolation ON public.blockers;
CREATE POLICY blocker_isolation ON public.blockers
    FOR ALL
    USING (org_id = public.get_user_org_id() OR auth.uid() IS NULL);

-- ------------------------------------------------------------------------------
-- 16. PROJECT MEMBERS (PROJECT-LEVEL ACCESS CONTROL - PLT-003, UAT-13)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.project_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role_in_project VARCHAR(50) DEFAULT 'MEMBER',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_project_member UNIQUE (project_id, user_id)
);
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS project_members_isolation ON public.project_members;
CREATE POLICY project_members_isolation ON public.project_members
    FOR ALL
    USING (org_id = public.get_user_org_id() OR auth.uid() IS NULL);

-- ------------------------------------------------------------------------------
-- 17. ASSISTED ACCESS GRANTS (TIME-BOUND SUPPORT ACCESS - PRD Section 18.3)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.assisted_access_grants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    granted_by_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    support_engineer_email VARCHAR(255) NOT NULL,
    reason TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'REVOKED', 'EXPIRED'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    revoked_at TIMESTAMPTZ
);
ALTER TABLE public.assisted_access_grants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS assisted_access_isolation ON public.assisted_access_grants;
CREATE POLICY assisted_access_isolation ON public.assisted_access_grants
    FOR ALL
    USING (org_id = public.get_user_org_id() OR auth.uid() IS NULL);

-- ------------------------------------------------------------------------------
-- 18. AUDIT LOGS APPEND-ONLY SECURITY POLICIES (PLT-006, NFR-SEC-07)
-- Strictly prevents UPDATE or DELETE on audit logs (tamper-proof)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS audit_logs_read ON public.audit_logs;
CREATE POLICY audit_logs_read ON public.audit_logs
    FOR SELECT
    USING (org_id = public.get_user_org_id() OR auth.uid() IS NULL);

DROP POLICY IF EXISTS audit_logs_insert ON public.audit_logs;
CREATE POLICY audit_logs_insert ON public.audit_logs
    FOR INSERT
    WITH CHECK (org_id = public.get_user_org_id() OR auth.uid() IS NULL);
-- Note: NO UPDATE or DELETE policy is defined on public.audit_logs to enforce append-only immutability.

-- ------------------------------------------------------------------------------
-- 19. SOFT DELETE COLUMNS (PLT-007)
-- ------------------------------------------------------------------------------
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.claims ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.actions ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.blockers ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- ------------------------------------------------------------------------------
-- 20. CONTRACT RULE VERSIONS (PHASE 3: CONTRACT RULES & VERSIONING)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.contract_rule_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    contract_id UUID REFERENCES public.contracts(id) ON DELETE CASCADE,
    version_number VARCHAR(50) NOT NULL DEFAULT 'v1.0',
    status VARCHAR(50) NOT NULL DEFAULT 'APPROVED', -- 'DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SUPERSEDED'
    cut_off_day INT NOT NULL DEFAULT 25,
    internal_lead_time_days INT NOT NULL DEFAULT 5,
    review_sla_days INT NOT NULL DEFAULT 14,
    payment_term_days INT NOT NULL DEFAULT 30,
    calendar_basis VARCHAR(50) NOT NULL DEFAULT 'CALENDAR_DAYS', -- 'CALENDAR_DAYS', 'WORKING_DAYS'
    retention_percent NUMERIC(5, 2) NOT NULL DEFAULT 5.00,
    advance_recovery_rule VARCHAR(50) NOT NULL DEFAULT 'PROPORTIONAL', -- 'PROPORTIONAL', 'FIXED_PERCENT', 'NONE'
    advance_recovery_percent NUMERIC(5, 2) NOT NULL DEFAULT 10.00,
    tax_treatment TEXT NOT NULL DEFAULT 'PPN 11% & PPh 4(2) Final 1.75% sesuai SPK',
    source_clause_ref VARCHAR(255) NOT NULL DEFAULT 'Pasal 8 SPK',
    effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
    notes TEXT,
    created_by_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    approved_by_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);
ALTER TABLE public.contract_rule_versions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS contract_rule_versions_isolation ON public.contract_rule_versions;
CREATE POLICY contract_rule_versions_isolation ON public.contract_rule_versions
    FOR ALL
    USING (org_id = public.get_user_org_id() OR auth.uid() IS NULL);

-- ------------------------------------------------------------------------------
-- 21. SOURCE IMPORTS (MODULE 1 / PHASE 4: IMPORT BATCHES & LINEAGE)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.source_imports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    file_name VARCHAR(255) NOT NULL,
    file_size_bytes BIGINT NOT NULL DEFAULT 0,
    file_checksum VARCHAR(64) NOT NULL, -- SHA-256 for duplicate prevention (IMP-009, UAT-03)
    sheet_name VARCHAR(100),
    total_rows INT NOT NULL DEFAULT 0,
    accepted_rows INT NOT NULL DEFAULT 0,
    rejected_rows INT NOT NULL DEFAULT 0,
    total_source_value NUMERIC(18, 2) NOT NULL DEFAULT 0,
    accepted_value NUMERIC(18, 2) NOT NULL DEFAULT 0,
    rejected_value NUMERIC(18, 2) NOT NULL DEFAULT 0,
    reconciliation_variance NUMERIC(18, 2) NOT NULL DEFAULT 0,
    status VARCHAR(50) NOT NULL DEFAULT 'COMPLETED', -- 'VALIDATING', 'COMPLETED', 'ROLLED_BACK'
    mapping_template_id UUID,
    uploaded_by_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    uploaded_by_name VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);
ALTER TABLE public.source_imports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS source_imports_isolation ON public.source_imports;
CREATE POLICY source_imports_isolation ON public.source_imports
    FOR ALL
    USING (org_id = public.get_user_org_id() OR auth.uid() IS NULL);

-- ------------------------------------------------------------------------------
-- 22. IMPORT MAPPING TEMPLATES (IMP-004)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.import_mapping_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    template_name VARCHAR(255) NOT NULL,
    entity_type VARCHAR(50) NOT NULL DEFAULT 'claims', -- 'claims', 'projects', 'invoices'
    column_mapping JSONB NOT NULL,
    created_by_name VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.import_mapping_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS import_mapping_templates_isolation ON public.import_mapping_templates;
CREATE POLICY import_mapping_templates_isolation ON public.import_mapping_templates
    FOR ALL
    USING (org_id = public.get_user_org_id() OR auth.uid() IS NULL);

-- ------------------------------------------------------------------------------
-- 23. CONTRACT EVIDENCE CHECKLIST TEMPLATES (RDY-001, RDY-003)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.contract_evidence_checklists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    contract_id UUID REFERENCES public.contracts(id) ON DELETE SET NULL,
    version VARCHAR(20) NOT NULL DEFAULT '1.0',
    effective_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'SUPERSEDED', 'DRAFT'
    internal_lead_time_days INT NOT NULL DEFAULT 5, -- H-5 before cut-off (RDY-008)
    created_by_name VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.contract_evidence_checklists ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS contract_evidence_checklists_isolation ON public.contract_evidence_checklists;
CREATE POLICY contract_evidence_checklists_isolation ON public.contract_evidence_checklists
    FOR ALL
    USING (org_id = public.get_user_org_id() OR auth.uid() IS NULL);

-- ------------------------------------------------------------------------------
-- 24. CONTRACT EVIDENCE CHECKLIST ITEMS (RDY-002, RDY-010)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.contract_evidence_checklist_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    checklist_id UUID NOT NULL REFERENCES public.contract_evidence_checklists(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    requirement_level VARCHAR(20) NOT NULL DEFAULT 'REQUIRED', -- 'REQUIRED', 'CONDITIONAL', 'OPTIONAL'
    condition_rule TEXT, -- e.g. 'has_variation_order', 'claim_above_1b'
    source_clause_reference TEXT, -- e.g. 'Pasal 14 Ayat 3 Syarat Pembayaran BAP' (RDY-010)
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 25. CLAIM READINESS INSTANCES & ITEMS (RDY-004, RDY-005, RDY-007, RDY-012)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.claim_readiness_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    claim_id UUID NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
    template_item_id UUID,
    name VARCHAR(255) NOT NULL,
    requirement_level VARCHAR(20) NOT NULL DEFAULT 'REQUIRED',
    source_clause_reference TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'MISSING', -- 'MISSING', 'PRESENT', 'VERIFIED', 'REJECTED', 'NOT_APPLICABLE'
    document_url TEXT, -- Link without mandatory binary (RDY-004)
    document_title VARCHAR(255),
    notes TEXT,
    action_owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    action_owner_name VARCHAR(255), -- Mandatory for missing items (RDY-007)
    due_date DATE,
    verified_by_name VARCHAR(255), -- Actor (RDY-005)
    verified_at TIMESTAMPTZ,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.claim_readiness_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS claim_readiness_items_isolation ON public.claim_readiness_items;
CREATE POLICY claim_readiness_items_isolation ON public.claim_readiness_items
    FOR ALL
-- ------------------------------------------------------------------------------
-- 26. WEEKLY REVIEW SNAPSHOTS (ACT-015, PRT-009)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.weekly_review_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    snapshot_date DATE NOT NULL,
    total_exposure NUMERIC(18, 2) NOT NULL DEFAULT 0,
    controllable_exposure NUMERIC(18, 2) NOT NULL DEFAULT 0,
    open_actions_count INT NOT NULL DEFAULT 0,
    overdue_actions_count INT NOT NULL DEFAULT 0,
    overdue_exposure NUMERIC(18, 2) NOT NULL DEFAULT 0,
    freshness_status VARCHAR(50) NOT NULL DEFAULT 'CURRENT',
    locked_by_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    locked_by_name VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.weekly_review_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS weekly_review_snapshots_isolation ON public.weekly_review_snapshots;
CREATE POLICY weekly_review_snapshots_isolation ON public.weekly_review_snapshots
-- ------------------------------------------------------------------------------
-- 27. PROJECT BASELINES (PRT-009, PRT-013, UAT-15)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.project_baselines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    baseline_date DATE NOT NULL,
    baseline_exposure NUMERIC(18, 2) NOT NULL DEFAULT 0,
    baseline_cycle_days INT NOT NULL DEFAULT 45,
    locked_by_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    locked_by_name VARCHAR(255) NOT NULL,
    lock_reason TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.project_baselines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS project_baselines_isolation ON public.project_baselines;
CREATE POLICY project_baselines_isolation ON public.project_baselines
-- ------------------------------------------------------------------------------
-- 28. SAVED FILTER VIEWS (PLT-014)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.saved_filter_views (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    view_name VARCHAR(100) NOT NULL,
    page_context VARCHAR(50) NOT NULL, -- e.g. 'progress-to-cash', 'actions', 'reports'
    filter_criteria JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_default BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.saved_filter_views ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS saved_filter_views_isolation ON public.saved_filter_views;
CREATE POLICY saved_filter_views_isolation ON public.saved_filter_views
    FOR ALL
    USING (org_id = public.get_user_org_id() OR auth.uid() IS NULL);

-- ------------------------------------------------------------------------------
-- 29. PILOT ONBOARDING & DATA ACCEPTANCE CHECKLIST (PRD 23.2, 23.3)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pilot_onboarding_checklists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    stage VARCHAR(50) NOT NULL, -- discovery, data_intake, contract_setup, mapping, baseline, activation, weekly_review, closing
    item_key VARCHAR(50) NOT NULL,
    item_label TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- PENDING, VERIFIED, WAIVED
    verified_by_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    verified_by_name VARCHAR(255),
    verified_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.pilot_onboarding_checklists ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pilot_onboarding_checklists_isolation ON public.pilot_onboarding_checklists;
CREATE POLICY pilot_onboarding_checklists_isolation ON public.pilot_onboarding_checklists
    FOR ALL
    USING (org_id = public.get_user_org_id() OR auth.uid() IS NULL);

-- ------------------------------------------------------------------------------
-- 30. PILOT SCORECARDS & B2B SUBSCRIPTIONS (PRD 23.2, 28)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pilot_scorecards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    pilot_tier VARCHAR(50) NOT NULL DEFAULT 'b2b_pilot', -- b2b_pilot, b2b_core, b2b_scale, b2b_enterprise
    pilot_day INT NOT NULL DEFAULT 45,
    baseline_exposure NUMERIC(18, 2) NOT NULL DEFAULT 0,
    closing_exposure NUMERIC(18, 2) NOT NULL DEFAULT 0,
    resolved_exposure_level_a NUMERIC(18, 2) NOT NULL DEFAULT 0,
    baseline_cycle_days INT NOT NULL DEFAULT 45,
    closing_cycle_days INT NOT NULL DEFAULT 30,
    roi_multiplier NUMERIC(8, 2) NOT NULL DEFAULT 0,
    renewal_recommendation VARCHAR(50) NOT NULL,
    time_budget_compliance BOOLEAN NOT NULL DEFAULT true,
    scorecard_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.pilot_scorecards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pilot_scorecards_isolation ON public.pilot_scorecards;
CREATE POLICY pilot_scorecards_isolation ON public.pilot_scorecards
    FOR ALL
    USING (org_id = public.get_user_org_id() OR auth.uid() IS NULL);


