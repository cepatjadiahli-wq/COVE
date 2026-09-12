-- ============================================================================
-- COVE — Canonical Action & Blocker Persistence (Gate P0-B.4)
-- Acuan: COVE_PRD_v2.0_Product_End_State.md §7, COVE_ERD_v2.0_Logical_Data_Model.md §8
-- Hardens action_items & action_notes schema:
-- 1. Adds completed_at timestamp for atomic status completion
-- 2. Hardens foreign keys to ON DELETE RESTRICT to protect operational history
-- 3. Adds tenant performance indexes on (org_id, project_id) and (org_id, status)
-- 4. Enables Row-Level Security on action_notes
-- ============================================================================

-- 1. Add completed_at column to action_items
ALTER TABLE action_items ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- 2. Protect action items operational history against cascade deletion
ALTER TABLE action_items DROP CONSTRAINT IF EXISTS action_items_org_id_fkey;
ALTER TABLE action_items DROP CONSTRAINT IF EXISTS fk_action_items_org;
ALTER TABLE action_items ADD CONSTRAINT fk_action_items_org
    FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE RESTRICT;

ALTER TABLE action_items DROP CONSTRAINT IF EXISTS action_items_project_id_fkey;
ALTER TABLE action_items DROP CONSTRAINT IF EXISTS fk_action_items_project;
ALTER TABLE action_items ADD CONSTRAINT fk_action_items_project
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE RESTRICT;

-- 3. Performance & isolation indexes
CREATE INDEX IF NOT EXISTS idx_action_items_org_proj ON action_items(org_id, project_id);
CREATE INDEX IF NOT EXISTS idx_action_items_org_status ON action_items(org_id, status);
CREATE INDEX IF NOT EXISTS idx_action_notes_action ON action_notes(action_item_id);

-- 4. Row-Level Security on action_notes
ALTER TABLE action_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS action_notes_tenant_isolation ON action_notes;
CREATE POLICY action_notes_tenant_isolation ON action_notes
    FOR ALL
    USING (action_item_id IN (
        SELECT id FROM action_items WHERE org_id IN (SELECT current_user_org_ids())
    ));
