-- ============================================================================
-- COVE — Canonical Progress-to-Cash Ledger Persistence (Gate P0-B.2)
-- Acuan: COVE_PRD_v2.0_Product_End_State.md §7, COVE_ERD_v2.0_Logical_Data_Model.md §3, §5, §7
-- Upgrades Work Progress, Measurements, Claims, Certificates & Allocations
-- to canonical PostgreSQL persistence with RLS, triggers & foreign keys.
-- ============================================================================

-- 1. Progress Periods enhancement
ALTER TABLE progress_periods ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
UPDATE progress_periods pp
SET org_id = p.org_id
FROM projects p
WHERE pp.project_id = p.id AND pp.org_id IS NULL;

-- 2. Work Progress Lines enhancement
ALTER TABLE work_progress_lines ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE CASCADE;
ALTER TABLE work_progress_lines ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE work_progress_lines ADD COLUMN IF NOT EXISTS unit TEXT NOT NULL DEFAULT 'LS';
ALTER TABLE work_progress_lines ADD COLUMN IF NOT EXISTS progress_date DATE NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE work_progress_lines ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'CANCELLED', 'ARCHIVED'));
ALTER TABLE work_progress_lines ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE work_progress_lines wpl
SET project_id = pp.project_id,
    org_id = pp.org_id
FROM progress_periods pp
WHERE wpl.period_id = pp.id AND (wpl.project_id IS NULL OR wpl.org_id IS NULL);

-- 3. Measurements enhancement
ALTER TABLE measurements ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE measurements ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE measurements ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE measurements m
SET org_id = p.org_id
FROM projects p
WHERE m.project_id = p.id AND m.org_id IS NULL;

ALTER TABLE measurements DROP CONSTRAINT IF EXISTS uq_project_measurement_number;
ALTER TABLE measurements ADD CONSTRAINT uq_project_measurement_number UNIQUE (project_id, measurement_number);

-- 4. Measurement Allocations enhancement
ALTER TABLE measurement_allocations ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE measurement_allocations DROP CONSTRAINT IF EXISTS chk_meas_alloc_positive;
ALTER TABLE measurement_allocations ADD CONSTRAINT chk_meas_alloc_positive CHECK (allocated_amount > 0);

-- 5. Claims enhancement
ALTER TABLE claims ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE claims c
SET org_id = p.org_id
FROM projects p
WHERE c.project_id = p.id AND c.org_id IS NULL;

ALTER TABLE claims DROP CONSTRAINT IF EXISTS uq_project_claim_number;
ALTER TABLE claims ADD CONSTRAINT uq_project_claim_number UNIQUE (project_id, claim_number);

-- 6. Claim Allocations enhancement
ALTER TABLE claim_allocations ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE claim_allocations DROP CONSTRAINT IF EXISTS chk_claim_alloc_positive;
ALTER TABLE claim_allocations ADD CONSTRAINT chk_claim_alloc_positive CHECK (allocated_amount > 0);

-- 7. Certificates enhancement
ALTER TABLE certificates ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE certificates ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE certificates ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE certificates k
SET org_id = p.org_id
FROM projects p
WHERE k.project_id = p.id AND k.org_id IS NULL;

ALTER TABLE certificates DROP CONSTRAINT IF EXISTS uq_project_certificate_number;
ALTER TABLE certificates ADD CONSTRAINT uq_project_certificate_number UNIQUE (project_id, certificate_number);

-- 8. Certification Allocations enhancement
ALTER TABLE certification_allocations ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE certification_allocations DROP CONSTRAINT IF EXISTS chk_cert_alloc_positive;
ALTER TABLE certification_allocations ADD CONSTRAINT chk_cert_alloc_positive CHECK (allocated_amount > 0);

-- 9. Allocation Invariant Conservation Triggers
CREATE OR REPLACE FUNCTION check_measurement_allocation_limit()
RETURNS TRIGGER AS $$
DECLARE
    v_principal NUMERIC(18, 2);
    v_total NUMERIC(18, 2);
BEGIN
    SELECT principal_amount INTO v_principal
    FROM work_progress_lines WHERE id = NEW.work_progress_line_id;

    SELECT COALESCE(SUM(allocated_amount), 0) INTO v_total
    FROM measurement_allocations WHERE work_progress_line_id = NEW.work_progress_line_id;

    IF v_total > v_principal THEN
        RAISE EXCEPTION 'Total alokasi pengukuran (%) melebihi nilai progres (%)', v_total, v_principal;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_measurement_allocation ON measurement_allocations;
CREATE TRIGGER trg_check_measurement_allocation
AFTER INSERT OR UPDATE ON measurement_allocations
FOR EACH ROW EXECUTE FUNCTION check_measurement_allocation_limit();

CREATE OR REPLACE FUNCTION check_claim_allocation_limit()
RETURNS TRIGGER AS $$
DECLARE
    v_measured NUMERIC(18, 2);
    v_total NUMERIC(18, 2);
BEGIN
    SELECT COALESCE(SUM(allocated_amount), 0) INTO v_measured
    FROM measurement_allocations WHERE measurement_id = NEW.measurement_id;

    SELECT COALESCE(SUM(allocated_amount), 0) INTO v_total
    FROM claim_allocations WHERE measurement_id = NEW.measurement_id;

    IF v_total > v_measured THEN
        RAISE EXCEPTION 'Total alokasi klaim (%) melebihi nilai pengukuran teralokasi (%)', v_total, v_measured;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_claim_allocation ON claim_allocations;
CREATE TRIGGER trg_check_claim_allocation
AFTER INSERT OR UPDATE ON claim_allocations
FOR EACH ROW EXECUTE FUNCTION check_claim_allocation_limit();

CREATE OR REPLACE FUNCTION check_certification_allocation_limit()
RETURNS TRIGGER AS $$
DECLARE
    v_claimed NUMERIC(18, 2);
    v_total NUMERIC(18, 2);
BEGIN
    SELECT COALESCE(SUM(allocated_amount), 0) INTO v_claimed
    FROM claim_allocations WHERE claim_id = NEW.claim_id;

    SELECT COALESCE(SUM(allocated_amount), 0) INTO v_total
    FROM certification_allocations WHERE claim_id = NEW.claim_id;

    IF v_total > v_claimed THEN
        RAISE EXCEPTION 'Total alokasi sertifikasi (%) melebihi nilai klaim teralokasi (%)', v_total, v_claimed;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_certification_allocation ON certification_allocations;
CREATE TRIGGER trg_check_certification_allocation
AFTER INSERT OR UPDATE ON certification_allocations
FOR EACH ROW EXECUTE FUNCTION check_certification_allocation_limit();

-- 10. Enable RLS on Allocation Tables
ALTER TABLE measurement_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE claim_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE certification_allocations ENABLE ROW LEVEL SECURITY;

-- 11. Tenant Isolation Policies
DROP POLICY IF EXISTS progress_periods_tenant_isolation ON progress_periods;
CREATE POLICY progress_periods_tenant_isolation ON progress_periods
    FOR ALL
    USING (org_id IN (SELECT current_user_org_ids()));

DROP POLICY IF EXISTS work_progress_lines_tenant_isolation ON work_progress_lines;
CREATE POLICY work_progress_lines_tenant_isolation ON work_progress_lines
    FOR ALL
    USING (org_id IN (SELECT current_user_org_ids()));

DROP POLICY IF EXISTS measurements_tenant_isolation ON measurements;
CREATE POLICY measurements_tenant_isolation ON measurements
    FOR ALL
    USING (org_id IN (SELECT current_user_org_ids()));

DROP POLICY IF EXISTS claims_tenant_isolation ON claims;
CREATE POLICY claims_tenant_isolation ON claims
    FOR ALL
    USING (org_id IN (SELECT current_user_org_ids()));

DROP POLICY IF EXISTS certificates_tenant_isolation ON certificates;
CREATE POLICY certificates_tenant_isolation ON certificates
    FOR ALL
    USING (org_id IN (SELECT current_user_org_ids()));

DROP POLICY IF EXISTS measurement_allocations_tenant_isolation ON measurement_allocations;
CREATE POLICY measurement_allocations_tenant_isolation ON measurement_allocations
    FOR ALL
    USING (measurement_id IN (
        SELECT m.id FROM measurements m WHERE m.org_id IN (SELECT current_user_org_ids())
    ));

DROP POLICY IF EXISTS claim_allocations_tenant_isolation ON claim_allocations;
CREATE POLICY claim_allocations_tenant_isolation ON claim_allocations
    FOR ALL
    USING (claim_id IN (
        SELECT c.id FROM claims c WHERE c.org_id IN (SELECT current_user_org_ids())
    ));

DROP POLICY IF EXISTS certification_allocations_tenant_isolation ON certification_allocations;
CREATE POLICY certification_allocations_tenant_isolation ON certification_allocations
    FOR ALL
    USING (certificate_id IN (
        SELECT k.id FROM certificates k WHERE k.org_id IN (SELECT current_user_org_ids())
    ));

-- 12. Indexes for Query Performance and Foreign Key Joins
CREATE INDEX IF NOT EXISTS idx_wpl_org_proj ON work_progress_lines(org_id, project_id, status);
CREATE INDEX IF NOT EXISTS idx_meas_org_proj ON measurements(org_id, project_id, status);
CREATE INDEX IF NOT EXISTS idx_claims_org_proj ON claims(org_id, project_id, status);
CREATE INDEX IF NOT EXISTS idx_certs_org_proj ON certificates(org_id, project_id, status);
CREATE INDEX IF NOT EXISTS idx_meas_alloc_wpl ON measurement_allocations(work_progress_line_id);
CREATE INDEX IF NOT EXISTS idx_meas_alloc_meas ON measurement_allocations(measurement_id);
CREATE INDEX IF NOT EXISTS idx_claim_alloc_meas ON claim_allocations(measurement_id);
CREATE INDEX IF NOT EXISTS idx_claim_alloc_claim ON claim_allocations(claim_id);
CREATE INDEX IF NOT EXISTS idx_cert_alloc_claim ON certification_allocations(claim_id);
CREATE INDEX IF NOT EXISTS idx_cert_alloc_cert ON certification_allocations(certificate_id);
