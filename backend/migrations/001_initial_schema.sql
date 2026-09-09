-- ============================================================================
-- COVE — PostgreSQL Database Schema DDL v2.1
-- Acuan: COVE_ERD_v2.0_Logical_Data_Model.md
-- Target Engine: PostgreSQL 15+ / Supabase
-- ============================================================================

-- gen_random_uuid() is built-in to PostgreSQL 13+ / Supabase. No extension required.

-- ============================================================================
-- 1. Identity, Tenant & Project Access
-- ============================================================================

CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    legal_name TEXT NOT NULL,
    display_name TEXT NOT NULL,
    timezone TEXT NOT NULL DEFAULT 'Asia/Jakarta',
    default_currency TEXT NOT NULL DEFAULT 'IDR',
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED', 'CLOSED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    phone TEXT,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS organization_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('OWNER', 'QS', 'FINANCE_MANAGER', 'PROJECT_MANAGER', 'AUDITOR')),
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INVITED', 'SUSPENDED')),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_org_profile UNIQUE (org_id, profile_id)
);

CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_code TEXT NOT NULL,
    project_name TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    location TEXT,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'ARCHIVED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    archived_at TIMESTAMPTZ,
    CONSTRAINT uq_org_project_code UNIQUE (org_id, project_code)
);

CREATE TABLE IF NOT EXISTS project_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    org_membership_id UUID NOT NULL REFERENCES organization_memberships(id) ON DELETE CASCADE,
    project_role TEXT NOT NULL DEFAULT 'MEMBER',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_project_member UNIQUE (project_id, org_membership_id)
);

-- ============================================================================
-- 2. Contracts & Commercial Baselines
-- ============================================================================

CREATE TABLE IF NOT EXISTS contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    contract_number TEXT NOT NULL,
    currency TEXT NOT NULL DEFAULT 'IDR',
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('DRAFT', 'ACTIVE', 'COMPLETED', 'TERMINATED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contract_revisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
    version_number INT NOT NULL DEFAULT 1,
    contract_value NUMERIC(18, 2) NOT NULL CHECK (contract_value >= 0),
    effective_date DATE NOT NULL,
    change_reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('DRAFT', 'ACTIVE', 'SUPERSEDED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_contract_version UNIQUE (contract_id, version_number)
);

CREATE TABLE IF NOT EXISTS contract_terms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    revision_id UUID UNIQUE NOT NULL REFERENCES contract_revisions(id) ON DELETE CASCADE,
    payment_days INT NOT NULL DEFAULT 30,
    claim_cutoff_day INT NOT NULL DEFAULT 25,
    retention_rate NUMERIC(5, 4) NOT NULL DEFAULT 0.0500,
    measurement_method TEXT NOT NULL DEFAULT 'VOLUME_TERUKUR'
);

CREATE TABLE IF NOT EXISTS variation_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
    vo_number TEXT NOT NULL,
    description TEXT NOT NULL,
    proposed_value NUMERIC(18, 2) NOT NULL DEFAULT 0,
    approved_value NUMERIC(18, 2) NOT NULL DEFAULT 0,
    approval_status TEXT NOT NULL DEFAULT 'PROPOSED' CHECK (approval_status IN ('PROPOSED', 'APPROVED', 'REJECTED')),
    approval_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 3. Progress-to-Cash Ledger (6 Stages & Lineage)
-- ============================================================================

CREATE TABLE IF NOT EXISTS progress_periods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED', 'LOCKED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Stage 1: Work Performed
CREATE TABLE IF NOT EXISTS work_progress_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    period_id UUID NOT NULL REFERENCES progress_periods(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    quantity NUMERIC(14, 4) NOT NULL DEFAULT 1,
    principal_amount NUMERIC(18, 2) NOT NULL CHECK (principal_amount >= 0),
    evidence_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (evidence_status IN ('PENDING', 'ATTACHED', 'VERIFIED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Stage 2: Measurements (Diukur / Opname)
CREATE TABLE IF NOT EXISTS measurements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    measurement_number TEXT NOT NULL,
    measurement_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'VERIFIED' CHECK (status IN ('DRAFT', 'SUBMITTED', 'VERIFIED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS measurement_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    work_progress_line_id UUID NOT NULL REFERENCES work_progress_lines(id) ON DELETE CASCADE,
    measurement_id UUID NOT NULL REFERENCES measurements(id) ON DELETE CASCADE,
    allocated_amount NUMERIC(18, 2) NOT NULL CHECK (allocated_amount >= 0)
);

-- Stage 3: Claims (Diajukan)
CREATE TABLE IF NOT EXISTS claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    claim_number TEXT NOT NULL,
    submitted_at DATE NOT NULL,
    readiness_status TEXT NOT NULL DEFAULT 'COMPLETE' CHECK (readiness_status IN ('INCOMPLETE', 'COMPLETE')),
    status TEXT NOT NULL DEFAULT 'SUBMITTED' CHECK (status IN ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS claim_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    measurement_id UUID NOT NULL REFERENCES measurements(id) ON DELETE CASCADE,
    claim_id UUID NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
    allocated_amount NUMERIC(18, 2) NOT NULL CHECK (allocated_amount >= 0)
);

-- Stage 4: Certificates (Disetujui / BAP Sertifikat Termin)
CREATE TABLE IF NOT EXISTS certificates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    certificate_number TEXT NOT NULL,
    certified_at DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'CERTIFIED' CHECK (status IN ('DRAFT', 'CERTIFIED', 'DISPUTED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS certification_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    claim_id UUID NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
    certificate_id UUID NOT NULL REFERENCES certificates(id) ON DELETE CASCADE,
    allocated_amount NUMERIC(18, 2) NOT NULL CHECK (allocated_amount >= 0)
);

-- Stage 5: Project Invoices (Ditagihkan)
CREATE TABLE IF NOT EXISTS project_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    invoice_number TEXT NOT NULL,
    certificate_reference TEXT NOT NULL,
    issued_at DATE NOT NULL,
    due_at DATE NOT NULL,
    currency TEXT NOT NULL DEFAULT 'IDR',
    principal_amount NUMERIC(18, 2) NOT NULL CHECK (principal_amount > 0),
    total_payable NUMERIC(18, 2) NOT NULL CHECK (total_payable >= principal_amount),
    status TEXT NOT NULL DEFAULT 'ISSUED' CHECK (status IN ('DRAFT', 'ISSUED', 'DISPUTED', 'CANCELLED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_project_invoice_num UNIQUE (project_id, invoice_number)
);

CREATE TABLE IF NOT EXISTS project_invoice_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    certificate_id UUID NOT NULL REFERENCES certificates(id) ON DELETE CASCADE,
    project_invoice_id UUID NOT NULL REFERENCES project_invoices(id) ON DELETE CASCADE,
    allocated_principal NUMERIC(18, 2) NOT NULL CHECK (allocated_principal > 0)
);

-- Stage 6: Cash Receipts & Allocations (Diterima / Kas Masuk Bank)
CREATE TABLE IF NOT EXISTS cash_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    received_at DATE NOT NULL,
    bank_reference TEXT NOT NULL,
    currency TEXT NOT NULL DEFAULT 'IDR',
    received_amount NUMERIC(18, 2) NOT NULL CHECK (received_amount > 0),
    settlement_status TEXT NOT NULL DEFAULT 'SETTLED' CHECK (settlement_status IN ('PENDING', 'SETTLED', 'REVERSED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS receipt_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cash_receipt_id UUID NOT NULL REFERENCES cash_receipts(id) ON DELETE CASCADE,
    project_invoice_id UUID NOT NULL REFERENCES project_invoices(id) ON DELETE CASCADE,
    principal_allocated NUMERIC(18, 2) NOT NULL CHECK (principal_allocated >= 0),
    tax_allocated NUMERIC(18, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS collection_promises (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    project_invoice_id UUID NOT NULL REFERENCES project_invoices(id) ON DELETE CASCADE,
    promised_date DATE NOT NULL,
    promised_amount NUMERIC(18, 2) NOT NULL CHECK (promised_amount > 0),
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'FULFILLED', 'BROKEN')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 4. Actions, Documents & Import Batches
-- ============================================================================

CREATE TABLE IF NOT EXISTS action_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    owner_name TEXT NOT NULL,
    title TEXT NOT NULL,
    blocker TEXT NOT NULL,
    value_at_risk NUMERIC(18, 2) NOT NULL DEFAULT 0,
    due_at DATE NOT NULL,
    severity TEXT NOT NULL DEFAULT 'Sedang' CHECK (severity IN ('Tinggi', 'Sedang', 'Rendah')),
    status TEXT NOT NULL DEFAULT 'Terbuka' CHECK (status IN ('Terbuka', 'Menunggu', 'Selesai')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS action_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action_item_id UUID NOT NULL REFERENCES action_items(id) ON DELETE CASCADE,
    author_name TEXT NOT NULL,
    note TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('Opname', 'Sertifikat', 'Kontrak', 'Klaim', 'Lampiran')),
    version INT NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'Lengkap',
    owner TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS import_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    file_hash TEXT NOT NULL,
    row_count INT NOT NULL,
    total_amount NUMERIC(18, 2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'COMMITTED', 'CANCELLED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 5. SaaS Billing & Mayar Integration
-- ============================================================================

CREATE TABLE IF NOT EXISTS plans (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    price_idr NUMERIC(18, 2) NOT NULL,
    billing_period TEXT NOT NULL,
    max_active_projects INT NOT NULL,
    max_users INT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ACTIVE'
);

CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    plan_id TEXT NOT NULL REFERENCES plans(id),
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'PAST_DUE', 'CANCELLED', 'EXPIRED')),
    current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    current_period_end TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS billing_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    invoice_number TEXT UNIQUE NOT NULL,
    amount NUMERIC(18, 2) NOT NULL,
    tax_amount NUMERIC(18, 2) NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'PAID' CHECK (status IN ('PENDING', 'PAID', 'FAILED', 'EXPIRED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id TEXT UNIQUE NOT NULL,
    provider TEXT NOT NULL DEFAULT 'MAYAR',
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 6. Support & Feedback
-- ============================================================================

CREATE TABLE IF NOT EXISTS support_tickets (
    id TEXT PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'P3' CHECK (priority IN ('P1', 'P2', 'P3')),
    status TEXT NOT NULL DEFAULT 'Menunggu Tim COVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ticket_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id TEXT NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
    author TEXT NOT NULL,
    body TEXT NOT NULL,
    is_internal BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS feature_requests (
    id TEXT PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    module TEXT NOT NULL,
    problem TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Ditinjau' CHECK (status IN ('Ditinjau', 'Direncanakan', 'Dikerjakan', 'Dirilis')),
    admin_update TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 7. Snapshot & Leakage Records
-- ============================================================================

CREATE TABLE IF NOT EXISTS stage_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    as_of_date DATE NOT NULL,
    work_value NUMERIC(18, 2) NOT NULL,
    measured_value NUMERIC(18, 2) NOT NULL,
    claimed_value NUMERIC(18, 2) NOT NULL,
    certified_value NUMERIC(18, 2) NOT NULL,
    invoiced_value NUMERIC(18, 2) NOT NULL,
    collected_value NUMERIC(18, 2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS leakage_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stage_snapshot_id UUID UNIQUE NOT NULL REFERENCES stage_snapshots(id) ON DELETE CASCADE,
    g1_unmeasured NUMERIC(18, 2) NOT NULL,
    g2_unclaimed NUMERIC(18, 2) NOT NULL,
    g3_uncertified NUMERIC(18, 2) NOT NULL,
    g4_uninvoiced NUMERIC(18, 2) NOT NULL,
    g5_uncollected NUMERIC(18, 2) NOT NULL,
    total_leakage NUMERIC(18, 2) NOT NULL
);
