-- ============================================================================
-- COVE — Project Canonical PostgreSQL Schema & Hardening (Gate P0-B.1)
-- Acuan: COVE_ERD_v2.0_Logical_Data_Model.md §1
-- ============================================================================

-- Ensure projects table matches canonical requirements
ALTER TABLE projects ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE projects ADD COLUMN IF NOT EXISTS owner TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS contract_value NUMERIC(15,2) DEFAULT 0;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS stage_values NUMERIC(15,2)[] DEFAULT '{0,0,0,0,0,0}';

-- Ensure indexing for multi-tenant queries
CREATE INDEX IF NOT EXISTS idx_projects_org_status ON projects(org_id, status);
CREATE INDEX IF NOT EXISTS idx_projects_org_code ON projects(org_id, project_code);
