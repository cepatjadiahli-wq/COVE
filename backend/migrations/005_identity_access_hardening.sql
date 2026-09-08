-- ============================================================================
-- COVE — Identity & Access Hardening v2.2 (Gate P0-A)
-- Acuan: COVE_PRD_v2.0_Product_End_State.md §7, COVE_ERD_v2.0_Logical_Data_Model.md §3, §30
-- Target Engine: PostgreSQL 15+ / Supabase
-- ============================================================================

-- ============================================================================
-- 1. Tenant Role Model Alignment (PRD v2.2 §7)
-- ============================================================================

-- Validate existing data before constraint modification (PRD v2.2 / Section Q)
DO $$
DECLARE
    invalid_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO invalid_count
    FROM public.organization_memberships
    WHERE role NOT IN (
        'OWNER',
        'ADMIN',
        'COMMERCIAL_MANAGER',
        'QS',
        'PROJECT_MANAGER',
        'FINANCE_MANAGER',
        'EXECUTIVE_VIEWER',
        'AUDITOR',
        'COVE_IMPLEMENTATION'
    );
    IF invalid_count > 0 THEN
        RAISE EXCEPTION 'MIGRATION HALTED: Found % invalid tenant roles in organization_memberships. Clean up or migrate explicitly before applying constraint.', invalid_count;
    END IF;
END $$;

-- Drop old check constraint if exists
ALTER TABLE organization_memberships 
DROP CONSTRAINT IF EXISTS organization_memberships_role_check;

-- Add updated PRD v2.2 canonical tenant roles constraint
-- (PLATFORM_ADMIN is NOT a tenant role; internal roles belong to platform grants)
ALTER TABLE organization_memberships
ADD CONSTRAINT organization_memberships_role_check
CHECK (role IN (
    'OWNER',
    'ADMIN',
    'COMMERCIAL_MANAGER',
    'QS',
    'PROJECT_MANAGER',
    'FINANCE_MANAGER',
    'EXECUTIVE_VIEWER',
    'AUDITOR',
    'COVE_IMPLEMENTATION'
));

-- ============================================================================
-- 2. Hardening Security-Definer Helper Functions (Supabase Safe Patterns)
-- ============================================================================

-- Hardened current_user_org_ids with fixed search_path and schema-qualified references
CREATE OR REPLACE FUNCTION public.current_user_org_ids()
RETURNS SETOF UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    RETURN QUERY
    SELECT om.org_id
    FROM public.organization_memberships om
    JOIN public.profiles p ON p.id = om.profile_id
    WHERE p.auth_user_id = auth.uid()
      AND om.status = 'ACTIVE';
END;
$$;

REVOKE ALL ON FUNCTION public.current_user_org_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_org_ids() TO authenticated;

-- Hardened helper: check if the authenticated user is an active platform admin
CREATE OR REPLACE FUNCTION public.current_user_is_platform_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    is_admin BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM public.platform_admins pa
        WHERE pa.auth_user_id = auth.uid()
          AND pa.status = 'ACTIVE'
    ) INTO is_admin;
    RETURN COALESCE(is_admin, FALSE);
END;
$$;

REVOKE ALL ON FUNCTION public.current_user_is_platform_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_is_platform_admin() TO authenticated;

-- ============================================================================
-- 3. Platform Admin & Audit RLS Policies (Strict Isolation from Tenant OWNER)
-- ============================================================================

-- Platform Admins table: only platform admins can view or manage platform admin identities
DROP POLICY IF EXISTS platform_admins_access ON platform_admins;
CREATE POLICY platform_admins_access ON platform_admins
    FOR ALL
    TO authenticated
    USING (public.current_user_is_platform_admin());

-- Admin Audit Logs: append-only for platform admins, viewable only by platform admins
DROP POLICY IF EXISTS admin_audit_logs_read ON admin_audit_logs;
CREATE POLICY admin_audit_logs_read ON admin_audit_logs
    FOR SELECT
    TO authenticated
    USING (public.current_user_is_platform_admin());

DROP POLICY IF EXISTS admin_audit_logs_insert ON admin_audit_logs;
CREATE POLICY admin_audit_logs_insert ON admin_audit_logs
    FOR INSERT
    TO authenticated
    WITH CHECK (public.current_user_is_platform_admin());

-- Platform Role Grants RLS
DROP POLICY IF EXISTS platform_grants_access ON platform_role_grants;
CREATE POLICY platform_grants_access ON platform_role_grants
    FOR ALL
    TO authenticated
    USING (public.current_user_is_platform_admin());

-- ============================================================================
-- 4. Reconcile profiles.auth_user_id with auth.users (Supabase Integration)
-- ============================================================================

DO $$
BEGIN
    -- Only add foreign key if auth.users exists in the PostgreSQL instance
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'auth' AND table_name = 'users'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'fk_profiles_auth_user'
        ) THEN
            ALTER TABLE public.profiles
            ADD CONSTRAINT fk_profiles_auth_user
            FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'fk_platform_admins_auth_user'
        ) THEN
            ALTER TABLE public.platform_admins
            ADD CONSTRAINT fk_platform_admins_auth_user
            FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
        END IF;
    END IF;
END $$;
