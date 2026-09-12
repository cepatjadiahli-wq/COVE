-- ============================================================================
-- COVE — Canonical Project Invoice & Cash Receipt Persistence (Gate P0-B.3)
-- Acuan: COVE_PRD_v2.0_Product_End_State.md §7, COVE_ERD_v2.0_Logical_Data_Model.md §3, §5, §6
-- Upgrades Project Invoices, Cash Receipts & Allocations to canonical
-- PostgreSQL persistence with RLS, trigger limits, foreign keys & indexes.
-- ============================================================================

-- 1. Project Invoices Table Enhancement
ALTER TABLE project_invoices ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE project_invoices ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE project_invoices ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE project_invoices ALTER COLUMN certificate_reference DROP NOT NULL;
ALTER TABLE project_invoices ALTER COLUMN certificate_reference SET DEFAULT '';
ALTER TABLE project_invoices ALTER COLUMN total_payable DROP NOT NULL;
ALTER TABLE project_invoices DROP CONSTRAINT IF EXISTS project_invoices_total_payable_check;

UPDATE project_invoices pi
SET org_id = p.org_id
FROM projects p
WHERE pi.project_id = p.id AND pi.org_id IS NULL;

ALTER TABLE project_invoices DROP CONSTRAINT IF EXISTS project_invoices_status_check;
ALTER TABLE project_invoices ADD CONSTRAINT project_invoices_status_check
    CHECK (status IN ('DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'DISPUTED', 'CANCELLED'));

-- 2. Project Invoice Allocations Table Enhancement
ALTER TABLE project_invoice_allocations ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE project_invoice_allocations ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE CASCADE;
ALTER TABLE project_invoice_allocations ADD COLUMN IF NOT EXISTS allocated_amount NUMERIC(18, 2);
ALTER TABLE project_invoice_allocations ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE project_invoice_allocations ALTER COLUMN allocated_principal DROP NOT NULL;

UPDATE project_invoice_allocations
SET allocated_amount = allocated_principal
WHERE allocated_amount IS NULL;

UPDATE project_invoice_allocations
SET allocated_principal = allocated_amount
WHERE allocated_principal IS NULL;

UPDATE project_invoice_allocations pia
SET org_id = pi.org_id,
    project_id = pi.project_id
FROM project_invoices pi
WHERE pia.project_invoice_id = pi.id AND (pia.org_id IS NULL OR pia.project_id IS NULL);

ALTER TABLE project_invoice_allocations DROP CONSTRAINT IF EXISTS chk_proj_inv_alloc_positive;
ALTER TABLE project_invoice_allocations ADD CONSTRAINT chk_proj_inv_alloc_positive
    CHECK (COALESCE(allocated_amount, allocated_principal) > 0);

-- 3. Cash Receipts Table Enhancement
ALTER TABLE cash_receipts ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE cash_receipts ADD COLUMN IF NOT EXISTS receipt_number TEXT;
ALTER TABLE cash_receipts ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE cash_receipts ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'BANK_TRANSFER';
ALTER TABLE cash_receipts ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE cash_receipts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE cash_receipts ALTER COLUMN bank_reference DROP NOT NULL;
ALTER TABLE cash_receipts ALTER COLUMN bank_reference SET DEFAULT '';

UPDATE cash_receipts cr
SET org_id = p.org_id
FROM projects p
WHERE cr.project_id = p.id AND cr.org_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_project_receipt_number ON cash_receipts(project_id, receipt_number) 
WHERE receipt_number IS NOT NULL AND receipt_number != '';

-- 4. Receipt Allocations Table Enhancement
ALTER TABLE receipt_allocations ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE receipt_allocations ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE CASCADE;
ALTER TABLE receipt_allocations ADD COLUMN IF NOT EXISTS allocated_amount NUMERIC(18, 2);
ALTER TABLE receipt_allocations ALTER COLUMN principal_allocated DROP NOT NULL;
ALTER TABLE receipt_allocations ALTER COLUMN tax_allocated DROP NOT NULL;
ALTER TABLE receipt_allocations ALTER COLUMN tax_allocated SET DEFAULT 0;

UPDATE receipt_allocations
SET allocated_amount = principal_allocated
WHERE allocated_amount IS NULL;

UPDATE receipt_allocations
SET principal_allocated = allocated_amount
WHERE principal_allocated IS NULL;

UPDATE receipt_allocations ra
SET org_id = cr.org_id,
    project_id = cr.project_id
FROM cash_receipts cr
WHERE ra.cash_receipt_id = cr.id AND (ra.org_id IS NULL OR ra.project_id IS NULL);

ALTER TABLE receipt_allocations DROP CONSTRAINT IF EXISTS chk_receipt_alloc_positive;
ALTER TABLE receipt_allocations ADD CONSTRAINT chk_receipt_alloc_positive
    CHECK (COALESCE(allocated_amount, principal_allocated) > 0);

-- 5. Allocation Invariant Conservation Triggers

-- Trigger 1: Certificate -> Project Invoice Allocation Limit
CREATE OR REPLACE FUNCTION check_certificate_invoice_allocation_limit()
RETURNS TRIGGER AS $$
DECLARE
    v_certified NUMERIC(18, 2);
    v_total NUMERIC(18, 2);
BEGIN
    SELECT COALESCE(SUM(allocated_amount), 0) INTO v_certified
    FROM certification_allocations WHERE certificate_id = NEW.certificate_id;

    SELECT COALESCE(SUM(COALESCE(allocated_amount, allocated_principal)), 0) INTO v_total
    FROM project_invoice_allocations WHERE certificate_id = NEW.certificate_id;

    IF v_total > v_certified THEN
        RAISE EXCEPTION 'Total alokasi invoice (%) melebihi nilai sertifikat teralokasi (%)', v_total, v_certified;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_certificate_invoice_allocation ON project_invoice_allocations;
CREATE TRIGGER trg_check_certificate_invoice_allocation
AFTER INSERT OR UPDATE ON project_invoice_allocations
FOR EACH ROW EXECUTE FUNCTION check_certificate_invoice_allocation_limit();

-- Trigger 2: Cash Receipt -> Project Invoice Allocation Limit (Invoice side)
CREATE OR REPLACE FUNCTION check_invoice_receipt_allocation_limit()
RETURNS TRIGGER AS $$
DECLARE
    v_principal NUMERIC(18, 2);
    v_total NUMERIC(18, 2);
BEGIN
    SELECT principal_amount INTO v_principal
    FROM project_invoices WHERE id = NEW.project_invoice_id;

    SELECT COALESCE(SUM(COALESCE(allocated_amount, principal_allocated)), 0) INTO v_total
    FROM receipt_allocations WHERE project_invoice_id = NEW.project_invoice_id;

    IF v_total > v_principal THEN
        RAISE EXCEPTION 'Total alokasi penerimaan kas (%) melebihi nilai pokok invoice (%)', v_total, v_principal;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_invoice_receipt_allocation ON receipt_allocations;
CREATE TRIGGER trg_check_invoice_receipt_allocation
AFTER INSERT OR UPDATE ON receipt_allocations
FOR EACH ROW EXECUTE FUNCTION check_invoice_receipt_allocation_limit();

-- Trigger 3: Cash Receipt -> Project Invoice Allocation Limit (Receipt side)
CREATE OR REPLACE FUNCTION check_receipt_amount_allocation_limit()
RETURNS TRIGGER AS $$
DECLARE
    v_received NUMERIC(18, 2);
    v_total NUMERIC(18, 2);
BEGIN
    SELECT received_amount INTO v_received
    FROM cash_receipts WHERE id = NEW.cash_receipt_id;

    SELECT COALESCE(SUM(COALESCE(allocated_amount, principal_allocated)), 0) INTO v_total
    FROM receipt_allocations WHERE cash_receipt_id = NEW.cash_receipt_id;

    IF v_total > v_received THEN
        RAISE EXCEPTION 'Total alokasi (%) melebihi total kas yang diterima (%)', v_total, v_received;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_receipt_amount_allocation ON receipt_allocations;
CREATE TRIGGER trg_check_receipt_amount_allocation
AFTER INSERT OR UPDATE ON receipt_allocations
FOR EACH ROW EXECUTE FUNCTION check_receipt_amount_allocation_limit();

-- 6. Enable Row Level Security (RLS)
ALTER TABLE project_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_invoice_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipt_allocations ENABLE ROW LEVEL SECURITY;

-- 7. Tenant Isolation Policies
DROP POLICY IF EXISTS project_invoices_tenant_isolation ON project_invoices;
CREATE POLICY project_invoices_tenant_isolation ON project_invoices
    FOR ALL
    USING (org_id IN (SELECT current_user_org_ids()));

DROP POLICY IF EXISTS project_invoice_allocations_tenant_isolation ON project_invoice_allocations;
CREATE POLICY project_invoice_allocations_tenant_isolation ON project_invoice_allocations
    FOR ALL
    USING (
        (org_id IS NOT NULL AND org_id IN (SELECT current_user_org_ids()))
        OR
        project_invoice_id IN (SELECT pi.id FROM project_invoices pi WHERE pi.org_id IN (SELECT current_user_org_ids()))
    );

DROP POLICY IF EXISTS cash_receipts_tenant_isolation ON cash_receipts;
CREATE POLICY cash_receipts_tenant_isolation ON cash_receipts
    FOR ALL
    USING (org_id IN (SELECT current_user_org_ids()));

DROP POLICY IF EXISTS receipt_allocations_tenant_isolation ON receipt_allocations;
CREATE POLICY receipt_allocations_tenant_isolation ON receipt_allocations
    FOR ALL
    USING (
        (org_id IS NOT NULL AND org_id IN (SELECT current_user_org_ids()))
        OR
        cash_receipt_id IN (SELECT cr.id FROM cash_receipts cr WHERE cr.org_id IN (SELECT current_user_org_ids()))
    );

-- 8. Performance and Join Indexes
CREATE INDEX IF NOT EXISTS idx_proj_inv_org_proj ON project_invoices(org_id, project_id, status);
CREATE INDEX IF NOT EXISTS idx_proj_inv_alloc_cert ON project_invoice_allocations(certificate_id);
CREATE INDEX IF NOT EXISTS idx_proj_inv_alloc_inv ON project_invoice_allocations(project_invoice_id);
CREATE INDEX IF NOT EXISTS idx_cash_rcpt_org_proj ON cash_receipts(org_id, project_id);
CREATE INDEX IF NOT EXISTS idx_rcpt_alloc_rcpt ON receipt_allocations(cash_receipt_id);
CREATE INDEX IF NOT EXISTS idx_rcpt_alloc_inv ON receipt_allocations(project_invoice_id);
