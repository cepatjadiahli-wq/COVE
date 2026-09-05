-- =============================================================================
-- COVE V1 - Construction Operations Value Engine
-- Migration 00008: Phase 16R.3 Database Privilege, Billing Bypass, and RLS Hardening
-- Security Definer Audit, Schema 'private', Platform Admins, Fail-Closed Quota RPCs
-- =============================================================================

-- 1. CREATE AND SECURE PRIVATE SCHEMA FOR AUTHORIZATION HELPERS
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
REVOKE ALL ON SCHEMA private FROM anon;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT USAGE ON SCHEMA private TO service_role;

-- 2. DEDICATED PLATFORM ADMINS TABLE (ISOLATED FROM TENANT MEMBERSHIP)
CREATE TABLE IF NOT EXISTS public.platform_admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT pg_catalog.now(),
    created_by UUID,
    notes TEXT,
    CONSTRAINT uq_platform_admins_auth UNIQUE (auth_user_id)
);

ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.platform_admins FROM PUBLIC;
REVOKE ALL ON TABLE public.platform_admins FROM anon;
GRANT SELECT ON TABLE public.platform_admins TO authenticated;
GRANT ALL ON TABLE public.platform_admins TO service_role;

-- RLS: Tenant users CANNOT insert, update, or delete platform admins.
-- Authenticated users can only read their own row (to check if they are platform admin).
DROP POLICY IF EXISTS rls_platform_admins_select ON public.platform_admins;
CREATE POLICY rls_platform_admins_select ON public.platform_admins
    FOR SELECT TO authenticated
    USING (auth.uid() = auth_user_id);

DROP POLICY IF EXISTS rls_platform_admins_service_role ON public.platform_admins;
CREATE POLICY rls_platform_admins_service_role ON public.platform_admins
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- 3. AUDITED SECURITY DEFINER AUTHORIZATION HELPERS IN SCHEMA 'private'
-- Strictly enforcing search_path = '' and schema-qualification

CREATE OR REPLACE FUNCTION private.is_platform_super_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF auth.role() = 'service_role' THEN
        RETURN true;
    END IF;
    RETURN EXISTS (
        SELECT 1
        FROM public.platform_admins pa
        WHERE pa.auth_user_id = auth.uid()
    );
END;
$$;

REVOKE ALL ON FUNCTION private.is_platform_super_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.is_platform_super_admin() FROM anon;
GRANT EXECUTE ON FUNCTION private.is_platform_super_admin() TO authenticated, service_role;

-- Helper: Active tenant member check via Canonical Option B
-- auth.users.id (auth.uid()) -> profiles.auth_user_id -> profiles.id -> organization_members.user_id
CREATE OR REPLACE FUNCTION private.is_active_org_member(p_org_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM public.organization_members om
        JOIN public.profiles p ON p.id = om.user_id
        WHERE p.auth_user_id = auth.uid()
          AND om.organization_id = p_org_id
          AND om.status = 'active'
    );
END;
$$;

REVOKE ALL ON FUNCTION private.is_active_org_member(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.is_active_org_member(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION private.is_active_org_member(UUID) TO authenticated, service_role;

-- Helper: Tenant Billing Admin check (OWNER or ADMIN)
CREATE OR REPLACE FUNCTION private.is_org_billing_admin(p_org_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM public.organization_members om
        JOIN public.profiles p ON p.id = om.user_id
        WHERE p.auth_user_id = auth.uid()
          AND om.organization_id = p_org_id
          AND om.role IN ('OWNER', 'ADMIN')
          AND om.status = 'active'
    );
END;
$$;

REVOKE ALL ON FUNCTION private.is_org_billing_admin(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.is_org_billing_admin(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION private.is_org_billing_admin(UUID) TO authenticated, service_role;

-- Helper: Tenant Billing Reader check (OWNER, ADMIN, FINANCE, FINANCE_MANAGER, COMMERCIAL_MANAGER)
CREATE OR REPLACE FUNCTION private.is_org_billing_reader(p_org_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM public.organization_members om
        JOIN public.profiles p ON p.id = om.user_id
        WHERE p.auth_user_id = auth.uid()
          AND om.organization_id = p_org_id
          AND om.role IN ('OWNER', 'ADMIN', 'FINANCE', 'FINANCE_MANAGER', 'COMMERCIAL_MANAGER')
          AND om.status = 'active'
    );
END;
$$;

REVOKE ALL ON FUNCTION private.is_org_billing_reader(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.is_org_billing_reader(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION private.is_org_billing_reader(UUID) TO authenticated, service_role;

-- Helper: Tenant Project Creator check (OWNER, ADMIN, PROJECT_MANAGER, COMMERCIAL_MANAGER)
CREATE OR REPLACE FUNCTION private.can_create_project(p_org_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM public.organization_members om
        JOIN public.profiles p ON p.id = om.user_id
        WHERE p.auth_user_id = auth.uid()
          AND om.organization_id = p_org_id
          AND om.role IN ('OWNER', 'ADMIN', 'PROJECT_MANAGER', 'COMMERCIAL_MANAGER')
          AND om.status = 'active'
    );
END;
$$;

REVOKE ALL ON FUNCTION private.can_create_project(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.can_create_project(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION private.can_create_project(UUID) TO authenticated, service_role;

-- 4. HARDEN SUBSCRIPTION ROW LEVEL SECURITY: ZERO DIRECT MUTATION FOR TENANTS
-- Drop all legacy policies
DROP POLICY IF EXISTS rls_subscriptions_select ON public.subscriptions;
DROP POLICY IF EXISTS rls_subscriptions_insert ON public.subscriptions;
DROP POLICY IF EXISTS rls_subscriptions_update ON public.subscriptions;
DROP POLICY IF EXISTS rls_subscriptions_delete ON public.subscriptions;
DROP POLICY IF EXISTS rls_subscriptions_service_role ON public.subscriptions;

-- Subscriptions SELECT: Active tenant members can ONLY read subscription data.
CREATE POLICY rls_subscriptions_select ON public.subscriptions
    FOR SELECT TO authenticated
    USING (
        private.is_active_org_member(org_id) OR private.is_platform_super_admin()
    );

-- ZERO INSERT / UPDATE / DELETE for authenticated tenant users!
-- Mutations must go through trusted server backend (service_role) via verified webhooks or internal workflow.
CREATE POLICY rls_subscriptions_service_role ON public.subscriptions
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- 5. HARDEN BILLING INVOICES ROW LEVEL SECURITY
DROP POLICY IF EXISTS rls_billing_invoices_select ON public.billing_invoices;
DROP POLICY IF EXISTS rls_billing_invoices_insert ON public.billing_invoices;
DROP POLICY IF EXISTS rls_billing_invoices_update ON public.billing_invoices;
DROP POLICY IF EXISTS rls_billing_invoices_delete ON public.billing_invoices;
DROP POLICY IF EXISTS rls_billing_invoices_service_role ON public.billing_invoices;

-- SELECT: Platform super admin across all tenants, or authorized tenant billing readers.
CREATE POLICY rls_billing_invoices_select ON public.billing_invoices
    FOR SELECT TO authenticated
    USING (
        private.is_platform_super_admin()
        OR (
            private.is_active_org_member(org_id)
            AND private.is_org_billing_reader(org_id)
        )
    );

-- ZERO direct mutation for tenant users.
CREATE POLICY rls_billing_invoices_service_role ON public.billing_invoices
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- 6. HARDEN WEBHOOK EVENTS: 100% BLOCKED FROM TENANTS
DROP POLICY IF EXISTS rls_webhook_events_select ON public.webhook_events;
DROP POLICY IF EXISTS rls_webhook_events_superadmin_select ON public.webhook_events;
DROP POLICY IF EXISTS rls_webhook_events_service_role ON public.webhook_events;

-- Only platform super admin can select webhook audit logs. Normal tenants get 0 rows.
CREATE POLICY rls_webhook_events_superadmin_select ON public.webhook_events
    FOR SELECT TO authenticated
    USING (private.is_platform_super_admin());

CREATE POLICY rls_webhook_events_service_role ON public.webhook_events
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- 7. ATOMIC FAIL-CLOSED QUOTA RPCS WITH ROW-LEVEL LOCKS AND CANONICAL STATUS EVALUATOR

-- RPC: Invite user with fail-closed quota check
CREATE OR REPLACE FUNCTION public.invite_user_with_quota_check(
    p_org_id UUID,
    p_email TEXT,
    p_full_name TEXT,
    p_role TEXT,
    p_job_title TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_max_users INT;
    v_current_users INT;
    v_existing_profile_id UUID;
    v_new_profile_id UUID;
    v_sub_status TEXT;
    v_period_end TIMESTAMPTZ;
    v_grace_end TIMESTAMPTZ;
    v_normalized_email TEXT;
BEGIN
    -- 1. Verify Caller Authorization: Caller MUST be OWNER or ADMIN of target org, or Platform Admin
    IF NOT (private.is_org_billing_admin(p_org_id) OR private.is_platform_super_admin()) THEN
        RAISE EXCEPTION 'UNAUTHORIZED_ACCESS: Pemanggil bukan OWNER atau ADMIN dari organisasi target %.', p_org_id
            USING ERRCODE = '42501';
    END IF;

    -- 2. Validate Invitation Role
    IF p_role NOT IN (
        'OWNER', 'ADMIN', 'COMMERCIAL_MANAGER', 'QS', 'FINANCE_MANAGER',
        'PROJECT_MANAGER', 'PROJECT_CONTROL', 'PROCUREMENT', 'VIEWER'
    ) THEN
        RAISE EXCEPTION 'INVALID_ARGUMENT: Role invitation % tidak valid atau dilarang.', p_role
            USING ERRCODE = '22023';
    END IF;

    -- 3. Normalize Email
    v_normalized_email := pg_catalog.lower(pg_catalog.btrim(p_email));
    IF v_normalized_email = '' OR v_normalized_email IS NULL THEN
        RAISE EXCEPTION 'INVALID_ARGUMENT: Email tidak boleh kosong.'
            USING ERRCODE = '22023';
    END IF;

    -- 4. Acquire row-level lock on organization to serialize concurrent mutations
    PERFORM 1 FROM public.organizations WHERE id = p_org_id FOR UPDATE;

    -- 5. Check if user already exists as active or invited member (re-invitation pattern: does not consume extra seat)
    SELECT p.id INTO v_existing_profile_id
    FROM public.profiles p
    JOIN public.organization_members om ON om.user_id = p.id
    WHERE om.organization_id = p_org_id
      AND pg_catalog.lower(p.email) = v_normalized_email
    LIMIT 1;

    IF v_existing_profile_id IS NOT NULL THEN
        RETURN v_existing_profile_id;
    END IF;

    -- 6. Retrieve active subscription and entitlement (FAIL-CLOSED: NO COALESCE DEFAULTS)
    SELECT s.status, s.current_period_end, s.grace_period_end, pe.max_users
    INTO v_sub_status, v_period_end, v_grace_end, v_max_users
    FROM public.subscriptions s
    JOIN public.plan_entitlements pe ON pe.plan_id = s.plan_id
    WHERE s.org_id = p_org_id
    ORDER BY s.created_at DESC
    LIMIT 1;

    IF v_sub_status IS NULL OR v_max_users IS NULL THEN
        RAISE EXCEPTION 'ENTITLEMENT_GUARD_REJECTED: Organisasi % tidak memiliki langganan atau entitlement aktif.', p_org_id
            USING ERRCODE = 'P0001';
    END IF;

    -- 7. Canonical Subscription Status Evaluator
    IF v_sub_status IN ('READ_ONLY', 'SUSPENDED', 'CANCELLED', 'EXPIRED') THEN
        RAISE EXCEPTION 'ENTITLEMENT_GUARD_REJECTED: Operasi ditolak karena status langganan % tidak mengizinkan mutasi pengguna.', v_sub_status
            USING ERRCODE = 'P0001';
    ELSIF v_sub_status = 'PAST_DUE' AND (v_grace_end IS NULL OR v_grace_end < pg_catalog.now()) THEN
        RAISE EXCEPTION 'ENTITLEMENT_GUARD_REJECTED: Operasi ditolak karena masa tenggang pembayaran telah berakhir.'
            USING ERRCODE = 'P0001';
    ELSIF v_sub_status = 'CANCEL_AT_PERIOD_END' AND (v_period_end IS NULL OR v_period_end < pg_catalog.now()) THEN
        RAISE EXCEPTION 'ENTITLEMENT_GUARD_REJECTED: Operasi ditolak karena masa periode langganan telah berakhir.'
            USING ERRCODE = 'P0001';
    ELSIF v_sub_status = 'MANUAL_GRANT' AND (v_period_end IS NOT NULL AND v_period_end < pg_catalog.now()) THEN
        RAISE EXCEPTION 'ENTITLEMENT_GUARD_REJECTED: Operasi ditolak karena masa hibah manual telah berakhir.'
            USING ERRCODE = 'P0001';
    ELSIF v_sub_status NOT IN ('ACTIVE', 'PILOT_ACTIVE', 'MANUAL_GRANT', 'PAST_DUE', 'CANCEL_AT_PERIOD_END') THEN
        RAISE EXCEPTION 'ENTITLEMENT_GUARD_REJECTED: Status langganan % tidak valid.', v_sub_status
            USING ERRCODE = 'P0001';
    END IF;

    -- 8. Count current active seats under row lock
    SELECT pg_catalog.count(*) INTO v_current_users
    FROM public.organization_members
    WHERE organization_id = p_org_id
      AND status IN ('active', 'invited');

    IF v_current_users >= v_max_users THEN
        RAISE EXCEPTION 'ENTITLEMENT_GUARD_REJECTED: User quota exceeded for organization % (%/%). Upgrade plan to invite more users.',
            p_org_id, v_current_users, v_max_users
            USING ERRCODE = 'P0001';
    END IF;

    -- 9. Insert Profile and Membership atomically (No orphan profiles)
    SELECT id INTO v_new_profile_id FROM public.profiles WHERE pg_catalog.lower(email) = v_normalized_email LIMIT 1;
    IF v_new_profile_id IS NULL THEN
        INSERT INTO public.profiles (full_name, email)
        VALUES (p_full_name, v_normalized_email)
        RETURNING id INTO v_new_profile_id;
    END IF;

    INSERT INTO public.organization_members (organization_id, user_id, role, job_title, status)
    VALUES (p_org_id, v_new_profile_id, p_role, COALESCE(p_job_title, p_role), 'invited');

    RETURN v_new_profile_id;
END;
$$;

REVOKE ALL ON FUNCTION public.invite_user_with_quota_check FROM PUBLIC;
REVOKE ALL ON FUNCTION public.invite_user_with_quota_check FROM anon;
GRANT EXECUTE ON FUNCTION public.invite_user_with_quota_check TO authenticated, service_role;

-- RPC: Create project with fail-closed quota check
CREATE OR REPLACE FUNCTION public.create_project_with_quota_check(
    p_org_id UUID,
    p_client_id UUID,
    p_project_code TEXT,
    p_project_name TEXT,
    p_contract_number TEXT,
    p_contract_title TEXT,
    p_original_contract_value NUMERIC
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_max_active_projects INT;
    v_current_active_projects INT;
    v_new_project_id UUID;
    v_new_contract_id UUID;
    v_sub_status TEXT;
    v_period_end TIMESTAMPTZ;
    v_grace_end TIMESTAMPTZ;
BEGIN
    -- 1. Verify Caller Authorization: Caller MUST have project creation permission on target org
    IF NOT (private.can_create_project(p_org_id) OR private.is_platform_super_admin()) THEN
        RAISE EXCEPTION 'UNAUTHORIZED_ACCESS: Pemanggil tidak memiliki wewenang membuat proyek pada organisasi target %.', p_org_id
            USING ERRCODE = '42501';
    END IF;

    -- 2. Acquire row-level lock on organization
    PERFORM 1 FROM public.organizations WHERE id = p_org_id FOR UPDATE;

    -- 3. Retrieve active subscription and entitlement (FAIL-CLOSED: NO COALESCE DEFAULTS)
    SELECT s.status, s.current_period_end, s.grace_period_end, pe.max_active_projects
    INTO v_sub_status, v_period_end, v_grace_end, v_max_active_projects
    FROM public.subscriptions s
    JOIN public.plan_entitlements pe ON pe.plan_id = s.plan_id
    WHERE s.org_id = p_org_id
    ORDER BY s.created_at DESC
    LIMIT 1;

    IF v_sub_status IS NULL OR v_max_active_projects IS NULL THEN
        RAISE EXCEPTION 'ENTITLEMENT_GUARD_REJECTED: Organisasi % tidak memiliki langganan atau entitlement aktif.', p_org_id
            USING ERRCODE = 'P0001';
    END IF;

    -- 4. Canonical Subscription Status Evaluator
    IF v_sub_status IN ('READ_ONLY', 'SUSPENDED', 'CANCELLED', 'EXPIRED') THEN
        RAISE EXCEPTION 'ENTITLEMENT_GUARD_REJECTED: Operasi ditolak karena status langganan % tidak mengizinkan penambahan proyek.', v_sub_status
            USING ERRCODE = 'P0001';
    ELSIF v_sub_status = 'PAST_DUE' AND (v_grace_end IS NULL OR v_grace_end < pg_catalog.now()) THEN
        RAISE EXCEPTION 'ENTITLEMENT_GUARD_REJECTED: Operasi ditolak karena masa tenggang pembayaran telah berakhir.'
            USING ERRCODE = 'P0001';
    ELSIF v_sub_status = 'CANCEL_AT_PERIOD_END' AND (v_period_end IS NULL OR v_period_end < pg_catalog.now()) THEN
        RAISE EXCEPTION 'ENTITLEMENT_GUARD_REJECTED: Operasi ditolak karena masa periode langganan telah berakhir.'
            USING ERRCODE = 'P0001';
    ELSIF v_sub_status = 'MANUAL_GRANT' AND (v_period_end IS NOT NULL AND v_period_end < pg_catalog.now()) THEN
        RAISE EXCEPTION 'ENTITLEMENT_GUARD_REJECTED: Operasi ditolak karena masa hibah manual telah berakhir.'
            USING ERRCODE = 'P0001';
    ELSIF v_sub_status NOT IN ('ACTIVE', 'PILOT_ACTIVE', 'MANUAL_GRANT', 'PAST_DUE', 'CANCEL_AT_PERIOD_END') THEN
        RAISE EXCEPTION 'ENTITLEMENT_GUARD_REJECTED: Status langganan % tidak valid.', v_sub_status
            USING ERRCODE = 'P0001';
    END IF;

    -- 5. Count current active projects
    SELECT pg_catalog.count(*) INTO v_current_active_projects
    FROM public.projects
    WHERE organization_id = p_org_id
      AND status = 'active';

    IF v_current_active_projects >= v_max_active_projects THEN
        RAISE EXCEPTION 'ENTITLEMENT_GUARD_REJECTED: Batas kuota proyek aktif untuk paket Anda (% proyek) telah tercapai. Tambahkan lisensi Project Add-on atau arsipkan proyek selesai.',
            v_max_active_projects
            USING ERRCODE = 'P0001';
    END IF;

    -- 6. Insert project and contract atomically
    INSERT INTO public.projects (organization_id, client_id, project_code, project_name, status)
    VALUES (p_org_id, p_client_id, p_project_code, p_project_name, 'active')
    RETURNING id INTO v_new_project_id;

    INSERT INTO public.contracts (organization_id, project_id, contract_number, contract_title, original_contract_value, current_contract_value)
    VALUES (p_org_id, v_new_project_id, p_contract_number, p_contract_title, p_original_contract_value, p_original_contract_value)
    RETURNING id INTO v_new_contract_id;

    RETURN v_new_project_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_project_with_quota_check FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_project_with_quota_check FROM anon;
GRANT EXECUTE ON FUNCTION public.create_project_with_quota_check TO authenticated, service_role;

-- 8. SECURE WEBHOOK RETENTION PURGE ENGINE (SERVICE ROLE & PLATFORM ADMIN ONLY)
CREATE OR REPLACE FUNCTION public.purge_old_webhook_events(
    p_retention_days INT DEFAULT 90,
    p_dry_run BOOLEAN DEFAULT FALSE
) RETURNS TABLE (
    purged_count INT,
    preserved_for_investigation_count INT,
    cutoff_timestamp TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_cutoff TIMESTAMPTZ;
    v_purged INT := 0;
    v_preserved INT := 0;
BEGIN
    -- 1. Enforce caller privilege: only service_role or platform admin can execute retention purge
    IF auth.role() != 'service_role' AND NOT private.is_platform_super_admin() THEN
        RAISE EXCEPTION 'UNAUTHORIZED_ACCESS: Eksekusi retention purge hanya diizinkan untuk service process atau platform administrator.'
            USING ERRCODE = '42501';
    END IF;

    v_cutoff := pg_catalog.now() - (p_retention_days || ' days')::INTERVAL;

    -- Count preserved records (failures, pending investigations, or pending reconciliations)
    SELECT pg_catalog.count(*) INTO v_preserved
    FROM public.webhook_events
    WHERE created_at < v_cutoff
      AND (
          processing_status IN ('FAILED', 'PENDING_INVESTIGATION')
          OR raw_payload->>'investigation_required' = 'true'
          OR raw_payload->>'reconciliation_status' = 'PENDING'
      );

    IF NOT p_dry_run THEN
        WITH deleted AS (
            DELETE FROM public.webhook_events
            WHERE created_at < v_cutoff
              AND processing_status NOT IN ('FAILED', 'PENDING_INVESTIGATION')
              AND pg_catalog.coalesce(raw_payload->>'investigation_required', 'false') != 'true'
              AND pg_catalog.coalesce(raw_payload->>'reconciliation_status', '') != 'PENDING'
            RETURNING id
        )
        SELECT pg_catalog.count(*) INTO v_purged FROM deleted;

        -- Record audit log
        INSERT INTO public.billing_audit_logs (
            org_id,
            actor_id,
            actor_role,
            action,
            target_entity,
            target_id,
            details
        ) VALUES (
            '00000000-0000-0000-0000-000000000000',
            'SYSTEM_SCHEDULER',
            'SYSTEM_RETENTION_SCHEDULER',
            'PURGE_WEBHOOK_EVENTS',
            'webhook_events',
            'bulk_retention_purge',
            jsonb_build_object(
                'purged_count', v_purged,
                'preserved_for_investigation_count', v_preserved,
                'retention_days', p_retention_days,
                'cutoff_timestamp', v_cutoff
            )
        );
    ELSE
        SELECT pg_catalog.count(*) INTO v_purged
        FROM public.webhook_events
        WHERE created_at < v_cutoff
          AND processing_status NOT IN ('FAILED', 'PENDING_INVESTIGATION')
          AND pg_catalog.coalesce(raw_payload->>'investigation_required', 'false') != 'true'
          AND pg_catalog.coalesce(raw_payload->>'reconciliation_status', '') != 'PENDING';
    END IF;

    RETURN QUERY SELECT v_purged, v_preserved, v_cutoff;
END;
$$;

-- REVOKE EXECUTE from PUBLIC, anon, and regular authenticated
REVOKE ALL ON FUNCTION public.purge_old_webhook_events FROM PUBLIC;
REVOKE ALL ON FUNCTION public.purge_old_webhook_events FROM anon;
REVOKE ALL ON FUNCTION public.purge_old_webhook_events FROM authenticated;
GRANT EXECUTE ON FUNCTION public.purge_old_webhook_events TO service_role;

-- 9. HARDEN LEGACY SECURITY DEFINER FUNCTIONS IN PUBLIC SCHEMA
CREATE OR REPLACE FUNCTION public.auth_user_profile_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RETURN (
        SELECT p.id
        FROM public.profiles p
        WHERE p.auth_user_id = auth.uid()
        LIMIT 1
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.auth_user_org_ids()
RETURNS SETOF UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RETURN QUERY
    SELECT om.organization_id
    FROM public.organization_members om
    JOIN public.profiles p ON p.id = om.user_id
    WHERE p.auth_user_id = auth.uid()
      AND om.status = 'active';
END;
$$;

CREATE OR REPLACE FUNCTION public.is_active_org_member(p_org_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RETURN private.is_active_org_member(p_org_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.is_org_billing_admin(p_org_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RETURN private.is_org_billing_admin(p_org_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.is_platform_super_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RETURN private.is_platform_super_admin();
END;
$$;

-- Revoke execute from PUBLIC and anon for legacy public wrappers
REVOKE ALL ON FUNCTION public.auth_user_profile_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.auth_user_profile_id() FROM anon;
GRANT EXECUTE ON FUNCTION public.auth_user_profile_id() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.auth_user_org_ids() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.auth_user_org_ids() FROM anon;
GRANT EXECUTE ON FUNCTION public.auth_user_org_ids() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.is_active_org_member(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_active_org_member(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_active_org_member(UUID) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.is_org_billing_admin(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_org_billing_admin(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_org_billing_admin(UUID) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.is_platform_super_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_platform_super_admin() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_platform_super_admin() TO authenticated, service_role;


