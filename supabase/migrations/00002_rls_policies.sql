-- =============================================================================
-- COVE V1 - Construction Operations Value Engine
-- Migration 00002: Row Level Security (RLS) & Tenant Isolation Policies
-- =============================================================================

-- Helper functions for RLS checks
CREATE OR REPLACE FUNCTION auth_user_org_ids()
RETURNS SETOF UUID AS $$
BEGIN
    RETURN QUERY
    SELECT om.organization_id
    FROM organization_members om
    JOIN profiles p ON p.id = om.user_id
    WHERE p.auth_user_id = auth.uid()
      AND om.status = 'active';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION auth_user_profile_id()
RETURNS UUID AS $$
DECLARE
    v_profile_id UUID;
BEGIN
    SELECT id INTO v_profile_id
    FROM profiles
    WHERE auth_user_id = auth.uid();
    RETURN v_profile_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable RLS on all tenant business tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE claim_stage_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE claim_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE blockers ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE retentions ENABLE ROW LEVEL SECURITY;
ALTER TABLE stage_sla_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_events ENABLE ROW LEVEL SECURITY;

-- 1. ORGANIZATIONS POLICIES
CREATE POLICY "Users can view organizations they belong to"
ON organizations FOR SELECT
USING (id IN (SELECT auth_user_org_ids()));

CREATE POLICY "Authenticated users can create an organization"
ON organizations FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Admins and Owners can update their organization"
ON organizations FOR UPDATE
USING (
    id IN (
        SELECT om.organization_id 
        FROM organization_members om 
        JOIN profiles p ON p.id = om.user_id
        WHERE p.auth_user_id = auth.uid() 
          AND om.role IN ('OWNER', 'ADMIN') 
          AND om.status = 'active'
    )
);

-- 2. PROFILES POLICIES
CREATE POLICY "Users can view profiles in their organizations"
ON profiles FOR SELECT
USING (
    auth_user_id = auth.uid() OR
    id IN (
        SELECT om.user_id
        FROM organization_members om
        WHERE om.organization_id IN (SELECT auth_user_org_ids())
    )
);

CREATE POLICY "Users can update their own profile"
ON profiles FOR UPDATE
USING (auth_user_id = auth.uid());

CREATE POLICY "Profiles insertable on signup"
ON profiles FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

-- 3. ORGANIZATION MEMBERS POLICIES
CREATE POLICY "Members viewable within organization"
ON organization_members FOR SELECT
USING (organization_id IN (SELECT auth_user_org_ids()));

CREATE POLICY "Admins can manage organization members"
ON organization_members FOR ALL
USING (
    organization_id IN (
        SELECT om.organization_id 
        FROM organization_members om 
        JOIN profiles p ON p.id = om.user_id
        WHERE p.auth_user_id = auth.uid() 
          AND om.role IN ('OWNER', 'ADMIN') 
          AND om.status = 'active'
    )
);

-- 4. PROJECTS POLICIES
CREATE POLICY "Tenant members can view projects"
ON projects FOR SELECT
USING (organization_id IN (SELECT auth_user_org_ids()));

CREATE POLICY "Authorized members can create/edit projects"
ON projects FOR ALL
USING (
    organization_id IN (
        SELECT om.organization_id 
        FROM organization_members om 
        JOIN profiles p ON p.id = om.user_id
        WHERE p.auth_user_id = auth.uid() 
          AND om.role NOT IN ('VIEWER') 
          AND om.status = 'active'
    )
);

-- 5. CLAIMS POLICIES
CREATE POLICY "Tenant members can view claims"
ON claims FOR SELECT
USING (organization_id IN (SELECT auth_user_org_ids()));

CREATE POLICY "Commercial/QS/Admin can modify claims"
ON claims FOR ALL
USING (
    organization_id IN (
        SELECT om.organization_id 
        FROM organization_members om 
        JOIN profiles p ON p.id = om.user_id
        WHERE p.auth_user_id = auth.uid() 
          AND om.role IN ('OWNER', 'ADMIN', 'COMMERCIAL_MANAGER', 'QS', 'PROJECT_MANAGER') 
          AND om.status = 'active'
    )
);

-- 6. INVOICES & CASH RECEIPTS POLICIES
CREATE POLICY "Tenant members can view invoices"
ON invoices FOR SELECT
USING (organization_id IN (SELECT auth_user_org_ids()));

CREATE POLICY "Finance and Admins can modify invoices"
ON invoices FOR ALL
USING (
    organization_id IN (
        SELECT om.organization_id 
        FROM organization_members om 
        JOIN profiles p ON p.id = om.user_id
        WHERE p.auth_user_id = auth.uid() 
          AND om.role IN ('OWNER', 'ADMIN', 'FINANCE_MANAGER', 'COMMERCIAL_MANAGER') 
          AND om.status = 'active'
    )
);

CREATE POLICY "Tenant members can view cash receipts"
ON cash_receipts FOR SELECT
USING (organization_id IN (SELECT auth_user_org_ids()));

CREATE POLICY "Finance and Admins can record cash receipts"
ON cash_receipts FOR ALL
USING (
    organization_id IN (
        SELECT om.organization_id 
        FROM organization_members om 
        JOIN profiles p ON p.id = om.user_id
        WHERE p.auth_user_id = auth.uid() 
          AND om.role IN ('OWNER', 'ADMIN', 'FINANCE_MANAGER') 
          AND om.status = 'active'
    )
);

-- 7. ACTIONS & BLOCKERS POLICIES
CREATE POLICY "Tenant members can view actions"
ON actions FOR SELECT
USING (organization_id IN (SELECT auth_user_org_ids()));

CREATE POLICY "Authorized members can manage actions"
ON actions FOR ALL
USING (
    organization_id IN (
        SELECT om.organization_id 
        FROM organization_members om 
        JOIN profiles p ON p.id = om.user_id
        WHERE p.auth_user_id = auth.uid() 
          AND om.role NOT IN ('VIEWER') 
          AND om.status = 'active'
    )
);

CREATE POLICY "Tenant members can view blockers"
ON blockers FOR SELECT
USING (organization_id IN (SELECT auth_user_org_ids()));

CREATE POLICY "Authorized members can manage blockers"
ON blockers FOR ALL
USING (
    organization_id IN (
        SELECT om.organization_id 
        FROM organization_members om 
        JOIN profiles p ON p.id = om.user_id
        WHERE p.auth_user_id = auth.uid() 
          AND om.role NOT IN ('VIEWER') 
          AND om.status = 'active'
    )
);

-- 8. NOTIFICATIONS POLICIES
CREATE POLICY "Users can only view their own notifications"
ON notifications FOR SELECT
USING (user_id = auth_user_profile_id());

CREATE POLICY "Users can update their own notification read status"
ON notifications FOR UPDATE
USING (user_id = auth_user_profile_id());

-- 9. AUDIT LOGS POLICIES
CREATE POLICY "Tenant members can view audit logs"
ON audit_logs FOR SELECT
USING (organization_id IN (SELECT auth_user_org_ids()));
