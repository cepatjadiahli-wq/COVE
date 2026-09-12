-- ============================================================================
-- COVE Database Migration: 011_p0b3_full_financial_history_and_idempotency_closure.sql
-- Gate P0-B3.2: Full W->P Financial History Protection & Mandatory Idempotency Closure
-- Closes: F-01.1 (Upstream Cascade Destruction) and F-04.1 (Mandatory Idempotency Key)
-- ============================================================================

-- ============================================================================
-- 1. F-01.1: Upstream Financial History Protection (W, M, C, S) -> RESTRICT
-- ============================================================================

-- A. Progress Periods
ALTER TABLE progress_periods DROP CONSTRAINT IF EXISTS progress_periods_org_id_fkey;
ALTER TABLE progress_periods DROP CONSTRAINT IF EXISTS fk_progress_periods_org;
ALTER TABLE progress_periods ADD CONSTRAINT fk_progress_periods_org
    FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE RESTRICT;

ALTER TABLE progress_periods DROP CONSTRAINT IF EXISTS progress_periods_project_id_fkey;
ALTER TABLE progress_periods DROP CONSTRAINT IF EXISTS fk_progress_periods_project;
ALTER TABLE progress_periods ADD CONSTRAINT fk_progress_periods_project
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE RESTRICT;

-- B. Work Progress Lines (W)
ALTER TABLE work_progress_lines DROP CONSTRAINT IF EXISTS work_progress_lines_org_id_fkey;
ALTER TABLE work_progress_lines DROP CONSTRAINT IF EXISTS fk_work_progress_lines_org;
ALTER TABLE work_progress_lines ADD CONSTRAINT fk_work_progress_lines_org
    FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE RESTRICT;

ALTER TABLE work_progress_lines DROP CONSTRAINT IF EXISTS work_progress_lines_project_id_fkey;
ALTER TABLE work_progress_lines DROP CONSTRAINT IF EXISTS fk_work_progress_lines_project;
ALTER TABLE work_progress_lines ADD CONSTRAINT fk_work_progress_lines_project
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE RESTRICT;

ALTER TABLE work_progress_lines DROP CONSTRAINT IF EXISTS work_progress_lines_period_id_fkey;
ALTER TABLE work_progress_lines DROP CONSTRAINT IF EXISTS fk_work_progress_lines_period;
ALTER TABLE work_progress_lines ADD CONSTRAINT fk_work_progress_lines_period
    FOREIGN KEY (period_id) REFERENCES progress_periods(id) ON DELETE RESTRICT;

-- C. Measurements (M)
ALTER TABLE measurements DROP CONSTRAINT IF EXISTS measurements_org_id_fkey;
ALTER TABLE measurements DROP CONSTRAINT IF EXISTS fk_measurements_org;
ALTER TABLE measurements ADD CONSTRAINT fk_measurements_org
    FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE RESTRICT;

ALTER TABLE measurements DROP CONSTRAINT IF EXISTS measurements_project_id_fkey;
ALTER TABLE measurements DROP CONSTRAINT IF EXISTS fk_measurements_project;
ALTER TABLE measurements ADD CONSTRAINT fk_measurements_project
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE RESTRICT;

-- D. Measurement Allocations
ALTER TABLE measurement_allocations DROP CONSTRAINT IF EXISTS measurement_allocations_work_progress_line_id_fkey;
ALTER TABLE measurement_allocations DROP CONSTRAINT IF EXISTS fk_measurement_allocations_wpl;
ALTER TABLE measurement_allocations ADD CONSTRAINT fk_measurement_allocations_wpl
    FOREIGN KEY (work_progress_line_id) REFERENCES work_progress_lines(id) ON DELETE RESTRICT;

ALTER TABLE measurement_allocations DROP CONSTRAINT IF EXISTS measurement_allocations_measurement_id_fkey;
ALTER TABLE measurement_allocations DROP CONSTRAINT IF EXISTS fk_measurement_allocations_measurement;
ALTER TABLE measurement_allocations ADD CONSTRAINT fk_measurement_allocations_measurement
    FOREIGN KEY (measurement_id) REFERENCES measurements(id) ON DELETE RESTRICT;

-- E. Claims (C)
ALTER TABLE claims DROP CONSTRAINT IF EXISTS claims_org_id_fkey;
ALTER TABLE claims DROP CONSTRAINT IF EXISTS fk_claims_org;
ALTER TABLE claims ADD CONSTRAINT fk_claims_org
    FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE RESTRICT;

ALTER TABLE claims DROP CONSTRAINT IF EXISTS claims_project_id_fkey;
ALTER TABLE claims DROP CONSTRAINT IF EXISTS fk_claims_project;
ALTER TABLE claims ADD CONSTRAINT fk_claims_project
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE RESTRICT;

-- F. Claim Allocations
ALTER TABLE claim_allocations DROP CONSTRAINT IF EXISTS claim_allocations_measurement_id_fkey;
ALTER TABLE claim_allocations DROP CONSTRAINT IF EXISTS fk_claim_allocations_measurement;
ALTER TABLE claim_allocations ADD CONSTRAINT fk_claim_allocations_measurement
    FOREIGN KEY (measurement_id) REFERENCES measurements(id) ON DELETE RESTRICT;

ALTER TABLE claim_allocations DROP CONSTRAINT IF EXISTS claim_allocations_claim_id_fkey;
ALTER TABLE claim_allocations DROP CONSTRAINT IF EXISTS fk_claim_allocations_claim;
ALTER TABLE claim_allocations ADD CONSTRAINT fk_claim_allocations_claim
    FOREIGN KEY (claim_id) REFERENCES claims(id) ON DELETE RESTRICT;

-- G. Certificates (S)
ALTER TABLE certificates DROP CONSTRAINT IF EXISTS certificates_org_id_fkey;
ALTER TABLE certificates DROP CONSTRAINT IF EXISTS fk_certificates_org;
ALTER TABLE certificates ADD CONSTRAINT fk_certificates_org
    FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE RESTRICT;

ALTER TABLE certificates DROP CONSTRAINT IF EXISTS certificates_project_id_fkey;
ALTER TABLE certificates DROP CONSTRAINT IF EXISTS fk_certificates_project;
ALTER TABLE certificates ADD CONSTRAINT fk_certificates_project
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE RESTRICT;

-- H. Certification Allocations
ALTER TABLE certification_allocations DROP CONSTRAINT IF EXISTS certification_allocations_claim_id_fkey;
ALTER TABLE certification_allocations DROP CONSTRAINT IF EXISTS fk_certification_allocations_claim;
ALTER TABLE certification_allocations ADD CONSTRAINT fk_certification_allocations_claim
    FOREIGN KEY (claim_id) REFERENCES claims(id) ON DELETE RESTRICT;

ALTER TABLE certification_allocations DROP CONSTRAINT IF EXISTS certification_allocations_certificate_id_fkey;
ALTER TABLE certification_allocations DROP CONSTRAINT IF EXISTS fk_certification_allocations_certificate;
ALTER TABLE certification_allocations ADD CONSTRAINT fk_certification_allocations_certificate
    FOREIGN KEY (certificate_id) REFERENCES certificates(id) ON DELETE RESTRICT;

-- ============================================================================
-- 2. F-04.1: Cash Receipt Idempotency Column Typing
-- ============================================================================

ALTER TABLE cash_receipts ALTER COLUMN idempotency_key TYPE VARCHAR(120);
