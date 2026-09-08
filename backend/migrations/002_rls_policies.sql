-- ============================================================================
-- COVE — Row-Level Security (RLS) Policies v2.1
-- Acuan: COVE_ERD_v2.0_Logical_Data_Model.md §19–§22
-- ============================================================================

-- Enable RLS on all tenant-scoped tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE progress_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_progress_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

-- Helper function: Get Current User's Organization IDs
CREATE OR REPLACE FUNCTION current_user_org_ids()
RETURNS SETOF UUID AS $$
BEGIN
    RETURN QUERY
    SELECT om.org_id
    FROM organization_memberships om
    JOIN profiles p ON p.id = om.profile_id
    WHERE p.auth_user_id = auth.uid()
      AND om.status = 'ACTIVE';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Organization Access Policy
CREATE POLICY org_tenant_isolation ON organizations
    FOR ALL
    USING (id IN (SELECT current_user_org_ids()));

-- Projects Access Policy
CREATE POLICY project_tenant_isolation ON projects
    FOR ALL
    USING (org_id IN (SELECT current_user_org_ids()));

-- Action Items Access Policy
CREATE POLICY action_tenant_isolation ON action_items
    FOR ALL
    USING (org_id IN (SELECT current_user_org_ids()));

-- Support Tickets Access Policy
CREATE POLICY support_tenant_isolation ON support_tickets
    FOR ALL
    USING (org_id IN (SELECT current_user_org_ids()));

-- Subscriptions Access Policy (Read-Only for Members, Admin-Managed)
CREATE POLICY subscription_tenant_isolation ON subscriptions
    FOR SELECT
    USING (org_id IN (SELECT current_user_org_ids()));
