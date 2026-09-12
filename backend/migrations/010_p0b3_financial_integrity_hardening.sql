-- ============================================================================
-- COVE — Financial Integrity & Concurrency Hardening (Gate P0-B.3.1)
-- Acuan: COVE P0-B3.1 Remediation Directives (F-01, F-02, F-03, F-04)
-- Resolves:
-- 1. F-01: Remove CASCADE delete risk on commercial financial history (ON DELETE RESTRICT)
-- 2. F-03: Define allocated_amount as sole canonical monetary allocation authority
-- 3. F-04: Enforce cash receipt mutation idempotency (idempotency_key NOT NULL + UNIQUE)
-- ============================================================================

-- ============================================================================
-- 1. F-01: Harden Foreign Key Constraints (ON DELETE RESTRICT)
-- Prevents silent cascade purge of financial history upon project/org deletion
-- ============================================================================

-- project_invoices -> projects
ALTER TABLE project_invoices DROP CONSTRAINT IF EXISTS project_invoices_project_id_fkey;
ALTER TABLE project_invoices DROP CONSTRAINT IF EXISTS fk_project_invoices_project;
ALTER TABLE project_invoices ADD CONSTRAINT fk_project_invoices_project
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE RESTRICT;

-- project_invoices -> organizations
ALTER TABLE project_invoices DROP CONSTRAINT IF EXISTS project_invoices_org_id_fkey;
ALTER TABLE project_invoices DROP CONSTRAINT IF EXISTS fk_project_invoices_org;
ALTER TABLE project_invoices ADD CONSTRAINT fk_project_invoices_org
    FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE RESTRICT;

-- project_invoice_allocations -> certificates
ALTER TABLE project_invoice_allocations DROP CONSTRAINT IF EXISTS project_invoice_allocations_certificate_id_fkey;
ALTER TABLE project_invoice_allocations DROP CONSTRAINT IF EXISTS fk_project_invoice_allocations_certificate;
ALTER TABLE project_invoice_allocations ADD CONSTRAINT fk_project_invoice_allocations_certificate
    FOREIGN KEY (certificate_id) REFERENCES certificates(id) ON DELETE RESTRICT;

-- project_invoice_allocations -> project_invoices
ALTER TABLE project_invoice_allocations DROP CONSTRAINT IF EXISTS project_invoice_allocations_project_invoice_id_fkey;
ALTER TABLE project_invoice_allocations DROP CONSTRAINT IF EXISTS fk_project_invoice_allocations_invoice;
ALTER TABLE project_invoice_allocations ADD CONSTRAINT fk_project_invoice_allocations_invoice
    FOREIGN KEY (project_invoice_id) REFERENCES project_invoices(id) ON DELETE RESTRICT;

-- project_invoice_allocations -> organizations
ALTER TABLE project_invoice_allocations DROP CONSTRAINT IF EXISTS project_invoice_allocations_org_id_fkey;
ALTER TABLE project_invoice_allocations DROP CONSTRAINT IF EXISTS fk_project_invoice_allocations_org;
ALTER TABLE project_invoice_allocations ADD CONSTRAINT fk_project_invoice_allocations_org
    FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE RESTRICT;

-- project_invoice_allocations -> projects
ALTER TABLE project_invoice_allocations DROP CONSTRAINT IF EXISTS project_invoice_allocations_project_id_fkey;
ALTER TABLE project_invoice_allocations DROP CONSTRAINT IF EXISTS fk_project_invoice_allocations_project;
ALTER TABLE project_invoice_allocations ADD CONSTRAINT fk_project_invoice_allocations_project
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE RESTRICT;

-- cash_receipts -> projects
ALTER TABLE cash_receipts DROP CONSTRAINT IF EXISTS cash_receipts_project_id_fkey;
ALTER TABLE cash_receipts DROP CONSTRAINT IF EXISTS fk_cash_receipts_project;
ALTER TABLE cash_receipts ADD CONSTRAINT fk_cash_receipts_project
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE RESTRICT;

-- cash_receipts -> organizations
ALTER TABLE cash_receipts DROP CONSTRAINT IF EXISTS cash_receipts_org_id_fkey;
ALTER TABLE cash_receipts DROP CONSTRAINT IF EXISTS fk_cash_receipts_org;
ALTER TABLE cash_receipts ADD CONSTRAINT fk_cash_receipts_org
    FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE RESTRICT;

-- receipt_allocations -> cash_receipts
ALTER TABLE receipt_allocations DROP CONSTRAINT IF EXISTS receipt_allocations_cash_receipt_id_fkey;
ALTER TABLE receipt_allocations DROP CONSTRAINT IF EXISTS fk_receipt_allocations_receipt;
ALTER TABLE receipt_allocations ADD CONSTRAINT fk_receipt_allocations_receipt
    FOREIGN KEY (cash_receipt_id) REFERENCES cash_receipts(id) ON DELETE RESTRICT;

-- receipt_allocations -> project_invoices
ALTER TABLE receipt_allocations DROP CONSTRAINT IF EXISTS receipt_allocations_project_invoice_id_fkey;
ALTER TABLE receipt_allocations DROP CONSTRAINT IF EXISTS fk_receipt_allocations_invoice;
ALTER TABLE receipt_allocations ADD CONSTRAINT fk_receipt_allocations_invoice
    FOREIGN KEY (project_invoice_id) REFERENCES project_invoices(id) ON DELETE RESTRICT;

-- receipt_allocations -> organizations
ALTER TABLE receipt_allocations DROP CONSTRAINT IF EXISTS receipt_allocations_org_id_fkey;
ALTER TABLE receipt_allocations DROP CONSTRAINT IF EXISTS fk_receipt_allocations_org;
ALTER TABLE receipt_allocations ADD CONSTRAINT fk_receipt_allocations_org
    FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE RESTRICT;

-- receipt_allocations -> projects
ALTER TABLE receipt_allocations DROP CONSTRAINT IF EXISTS receipt_allocations_project_id_fkey;
ALTER TABLE receipt_allocations DROP CONSTRAINT IF EXISTS fk_receipt_allocations_project;
ALTER TABLE receipt_allocations ADD CONSTRAINT fk_receipt_allocations_project
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE RESTRICT;

-- ============================================================================
-- 2. F-03: Sole Canonical Allocation Authority (allocated_amount)
-- ============================================================================

-- Detect and halt migration if divergent records exist
DO $$
DECLARE
    div_pia INTEGER;
    div_ra INTEGER;
BEGIN
    SELECT COUNT(*) INTO div_pia
    FROM project_invoice_allocations
    WHERE allocated_amount IS NOT NULL 
      AND allocated_principal IS NOT NULL 
      AND allocated_amount != allocated_principal;

    IF div_pia > 0 THEN
        RAISE EXCEPTION 'MIGRATION HALTED: Found % divergent rows in project_invoice_allocations between allocated_amount and allocated_principal.', div_pia;
    END IF;

    SELECT COUNT(*) INTO div_ra
    FROM receipt_allocations
    WHERE allocated_amount IS NOT NULL 
      AND principal_allocated IS NOT NULL 
      AND allocated_amount != principal_allocated;

    IF div_ra > 0 THEN
        RAISE EXCEPTION 'MIGRATION HALTED: Found % divergent rows in receipt_allocations between allocated_amount and principal_allocated.', div_ra;
    END IF;
END $$;

-- Backfill missing allocated_amount or legacy columns
UPDATE project_invoice_allocations
SET allocated_amount = allocated_principal
WHERE allocated_amount IS NULL AND allocated_principal IS NOT NULL;

UPDATE project_invoice_allocations
SET allocated_principal = allocated_amount
WHERE allocated_principal IS NULL AND allocated_amount IS NOT NULL;

UPDATE receipt_allocations
SET allocated_amount = principal_allocated
WHERE allocated_amount IS NULL AND principal_allocated IS NOT NULL;

UPDATE receipt_allocations
SET principal_allocated = allocated_amount
WHERE principal_allocated IS NULL AND allocated_amount IS NOT NULL;

-- Enforce NOT NULL on canonical allocated_amount
ALTER TABLE project_invoice_allocations ALTER COLUMN allocated_amount SET NOT NULL;
ALTER TABLE receipt_allocations ALTER COLUMN allocated_amount SET NOT NULL;

-- Add consistency check constraints to prevent future divergence
ALTER TABLE project_invoice_allocations DROP CONSTRAINT IF EXISTS chk_pia_allocation_equality;
ALTER TABLE project_invoice_allocations ADD CONSTRAINT chk_pia_allocation_equality
    CHECK (allocated_principal IS NULL OR allocated_principal = allocated_amount);

ALTER TABLE receipt_allocations DROP CONSTRAINT IF EXISTS chk_ra_allocation_equality;
ALTER TABLE receipt_allocations ADD CONSTRAINT chk_ra_allocation_equality
    CHECK (principal_allocated IS NULL OR principal_allocated = allocated_amount);

-- Update Triggers to strictly use allocated_amount without COALESCE fallback
CREATE OR REPLACE FUNCTION check_certificate_invoice_allocation_limit()
RETURNS TRIGGER AS $$
DECLARE
    v_certified NUMERIC(18, 2);
    v_total NUMERIC(18, 2);
BEGIN
    SELECT COALESCE(SUM(allocated_amount), 0) INTO v_certified
    FROM certification_allocations WHERE certificate_id = NEW.certificate_id;

    SELECT COALESCE(SUM(allocated_amount), 0) INTO v_total
    FROM project_invoice_allocations WHERE certificate_id = NEW.certificate_id;

    IF v_total > v_certified THEN
        RAISE EXCEPTION 'Total alokasi invoice (%) melebihi nilai sertifikat teralokasi (%)', v_total, v_certified;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION check_invoice_receipt_allocation_limit()
RETURNS TRIGGER AS $$
DECLARE
    v_principal NUMERIC(18, 2);
    v_total NUMERIC(18, 2);
BEGIN
    SELECT principal_amount INTO v_principal
    FROM project_invoices WHERE id = NEW.project_invoice_id;

    SELECT COALESCE(SUM(allocated_amount), 0) INTO v_total
    FROM receipt_allocations WHERE project_invoice_id = NEW.project_invoice_id;

    IF v_total > v_principal THEN
        RAISE EXCEPTION 'Total alokasi penerimaan kas (%) melebihi nilai pokok invoice (%)', v_total, v_principal;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION check_receipt_amount_allocation_limit()
RETURNS TRIGGER AS $$
DECLARE
    v_received NUMERIC(18, 2);
    v_total NUMERIC(18, 2);
BEGIN
    SELECT received_amount INTO v_received
    FROM cash_receipts WHERE id = NEW.cash_receipt_id;

    SELECT COALESCE(SUM(allocated_amount), 0) INTO v_total
    FROM receipt_allocations WHERE cash_receipt_id = NEW.cash_receipt_id;

    IF v_total > v_received THEN
        RAISE EXCEPTION 'Total alokasi (%) melebihi total kas yang diterima (%)', v_total, v_received;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 3. F-04: Cash Receipt Idempotency (idempotency_key NOT NULL + UNIQUE)
-- ============================================================================

ALTER TABLE cash_receipts ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

UPDATE cash_receipts
SET idempotency_key = id::text
WHERE idempotency_key IS NULL;

ALTER TABLE cash_receipts ALTER COLUMN idempotency_key SET NOT NULL;

ALTER TABLE cash_receipts DROP CONSTRAINT IF EXISTS uq_cash_receipts_idempotency;
ALTER TABLE cash_receipts ADD CONSTRAINT uq_cash_receipts_idempotency
    UNIQUE (org_id, project_id, idempotency_key);
