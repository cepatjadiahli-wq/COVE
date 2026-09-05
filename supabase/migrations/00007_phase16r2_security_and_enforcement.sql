-- =============================================================================
-- COVE V1 - Construction Operations Value Engine
-- Migration 00007: Phase 16R.2 Production Authorization & Database Enforcement
-- Strict Multi-Tenant Billing RLS, Atomic Quota Locks, Webhook Retention & Audit
-- =============================================================================

-- 1. ENHANCED BILLING RLS HELPER FUNCTIONS
-- Helper: Checks if the calling auth user is an active member of the specified organization
CREATE OR REPLACE FUNCTION public.is_active_org_member(p_org_id UUID)
RETURNS BOOLEAN AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper: Checks if calling user is an active OWNER or ADMIN of the specified organization
CREATE OR REPLACE FUNCTION public.is_org_billing_admin(p_org_id UUID)
RETURNS BOOLEAN AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper: Checks if calling user is a platform SUPER_ADMIN
CREATE OR REPLACE FUNCTION public.is_platform_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM public.organization_members om
        JOIN public.profiles p ON p.id = om.user_id
        WHERE p.auth_user_id = auth.uid()
          AND om.role = 'SUPER_ADMIN'
          AND om.status = 'active'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. HARDENED ROW LEVEL SECURITY ON SUBSCRIPTIONS & BILLING TABLES
-- Drop legacy loose policies if they exist
DROP POLICY IF EXISTS rls_subscriptions_select ON public.subscriptions;
DROP POLICY IF EXISTS rls_subscriptions_insert ON public.subscriptions;
DROP POLICY IF EXISTS rls_subscriptions_update ON public.subscriptions;
DROP POLICY IF EXISTS rls_subscriptions_delete ON public.subscriptions;

-- Subscriptions SELECT: Active members of the tenant organization ONLY
CREATE POLICY rls_subscriptions_select ON public.subscriptions
    FOR SELECT TO authenticated
    USING (
        public.is_active_org_member(org_id) OR public.is_platform_super_admin()
    );

-- Subscriptions INSERT/UPDATE: Authorized OWNER/ADMIN of the tenant ONLY
CREATE POLICY rls_subscriptions_insert ON public.subscriptions
    FOR INSERT TO authenticated
    WITH CHECK (
        public.is_org_billing_admin(org_id) OR public.is_platform_super_admin()
    );

CREATE POLICY rls_subscriptions_update ON public.subscriptions
    FOR UPDATE TO authenticated
    USING (
        public.is_org_billing_admin(org_id) OR public.is_platform_super_admin()
    )
    WITH CHECK (
        public.is_org_billing_admin(org_id) OR public.is_platform_super_admin()
    );

-- Subscriptions DELETE: Strictly prohibited for normal tenant users (soft cancellation only)
CREATE POLICY rls_subscriptions_delete ON public.subscriptions
    FOR DELETE TO authenticated
    USING (public.is_platform_super_admin());

-- 3. WEBHOOK EVENTS SECURITY: ZERO ACCESS FOR TENANT USERS
DROP POLICY IF EXISTS rls_webhook_events_select ON public.webhook_events;
DROP POLICY IF EXISTS rls_webhook_events_all ON public.webhook_events;

-- Normal tenant users are 100% blocked from selecting webhook_events.
-- Only platform SUPER_ADMIN or service_role processes can read webhook audit logs.
CREATE POLICY rls_webhook_events_superadmin_select ON public.webhook_events
    FOR SELECT TO authenticated
    USING (public.is_platform_super_admin());

-- Service role bypass / explicit policy for backend ingestion
CREATE POLICY rls_webhook_events_service_role ON public.webhook_events
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- 4. ATOMIC QUOTA ENFORCEMENT WITH ROW-LEVEL LOCKS (CONCURRENCY PROOF)
-- Prevents race conditions across concurrent serverless instances during user invitation
CREATE OR REPLACE FUNCTION public.invite_user_with_quota_check(
    p_org_id UUID,
    p_email TEXT,
    p_full_name TEXT,
    p_role TEXT,
    p_job_title TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_max_users INT;
    v_current_users INT;
    v_existing_profile_id UUID;
    v_new_profile_id UUID;
BEGIN
    -- 1. Acquire row lock on organization to serialize concurrent mutation requests for this tenant
    PERFORM 1 FROM public.organizations WHERE id = p_org_id FOR UPDATE;

    -- 2. Check if user already exists as an active member (re-invitation pattern)
    SELECT p.id INTO v_existing_profile_id
    FROM public.profiles p
    JOIN public.organization_members om ON om.user_id = p.id
    WHERE om.organization_id = p_org_id
      AND LOWER(p.email) = LOWER(p_email)
    LIMIT 1;

    IF v_existing_profile_id IS NOT NULL THEN
        -- Re-invite does not consume additional seat quota
        RETURN v_existing_profile_id;
    END IF;

    -- 3. Retrieve plan maxUsers limit from active subscription
    SELECT COALESCE(pe.max_users, 10) INTO v_max_users
    FROM public.subscriptions s
    JOIN public.plan_entitlements pe ON pe.plan_id = s.plan_id
    WHERE s.org_id = p_org_id AND s.status = 'ACTIVE'
    LIMIT 1;

    IF v_max_users IS NULL THEN
        v_max_users := 10;
    END IF;

    -- 4. Count current active seats with locked state
    SELECT COUNT(*) INTO v_current_users
    FROM public.organization_members
    WHERE organization_id = p_org_id
      AND status IN ('active', 'invited');

    IF v_current_users >= v_max_users THEN
        RAISE EXCEPTION 'ENTITLEMENT_GUARD_REJECTED: User quota exceeded for organization % (%/%). Upgrade plan to invite more users.',
            p_org_id, v_current_users, v_max_users
            USING ERRCODE = 'P0001';
    END IF;

    -- 5. Insert profile and membership atomically
    INSERT INTO public.profiles (full_name, email)
    VALUES (p_full_name, p_email)
    RETURNING id INTO v_new_profile_id;

    INSERT INTO public.organization_members (organization_id, user_id, role, job_title, status)
    VALUES (p_org_id, v_new_profile_id, p_role, COALESCE(p_job_title, p_role), 'invited');

    RETURN v_new_profile_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Prevents race conditions across concurrent serverless instances during project creation
CREATE OR REPLACE FUNCTION public.create_project_with_quota_check(
    p_org_id UUID,
    p_client_id UUID,
    p_project_code TEXT,
    p_project_name TEXT,
    p_contract_number TEXT,
    p_contract_title TEXT,
    p_original_contract_value NUMERIC
) RETURNS UUID AS $$
DECLARE
    v_max_active_projects INT;
    v_current_active_projects INT;
    v_new_project_id UUID;
    v_new_contract_id UUID;
BEGIN
    -- 1. Acquire row lock on organization to serialize concurrent creations
    PERFORM 1 FROM public.organizations WHERE id = p_org_id FOR UPDATE;

    -- 2. Retrieve plan maxActiveProjects limit from active subscription
    SELECT COALESCE(pe.max_active_projects, 1) INTO v_max_active_projects
    FROM public.subscriptions s
    JOIN public.plan_entitlements pe ON pe.plan_id = s.plan_id
    WHERE s.org_id = p_org_id AND s.status = 'ACTIVE'
    LIMIT 1;

    IF v_max_active_projects IS NULL THEN
        v_max_active_projects := 1;
    END IF;

    -- 3. Count current active projects with locked state
    SELECT COUNT(*) INTO v_current_active_projects
    FROM public.projects
    WHERE organization_id = p_org_id
      AND status = 'active';

    IF v_current_active_projects >= v_max_active_projects THEN
        RAISE EXCEPTION 'ENTITLEMENT_GUARD_REJECTED: Batas kuota proyek aktif untuk paket Anda (% proyek) telah tercapai. Tambahkan lisensi Project Add-on atau arsipkan proyek selesai.',
            v_max_active_projects
            USING ERRCODE = 'P0001';
    END IF;

    -- 4. Insert project and contract atomically
    INSERT INTO public.projects (organization_id, client_id, project_code, project_name, status)
    VALUES (p_org_id, p_client_id, p_project_code, p_project_name, 'active')
    RETURNING id INTO v_new_project_id;

    INSERT INTO public.contracts (organization_id, project_id, contract_number, contract_title, original_contract_value, current_contract_value)
    VALUES (p_org_id, v_new_project_id, p_contract_number, p_contract_title, p_original_contract_value, p_original_contract_value)
    RETURNING id INTO v_new_contract_id;

    RETURN v_new_project_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. WEBHOOK RETENTION PURGE ENGINE (90-DAY RETENTION WITH EXCLUSION RULES)
CREATE OR REPLACE FUNCTION public.purge_old_webhook_events(
    p_retention_days INT DEFAULT 90,
    p_dry_run BOOLEAN DEFAULT FALSE
) RETURNS TABLE (
    purged_count INT,
    preserved_for_investigation_count INT,
    cutoff_timestamp TIMESTAMPTZ
) AS $$
DECLARE
    v_cutoff TIMESTAMPTZ;
    v_purged INT := 0;
    v_preserved INT := 0;
BEGIN
    v_cutoff := NOW() - (p_retention_days || ' days')::INTERVAL;

    -- Count records older than cutoff that are preserved due to investigation / failure rules
    SELECT COUNT(*) INTO v_preserved
    FROM public.webhook_events
    WHERE created_at < v_cutoff
      AND (
          processing_status IN ('FAILED', 'PENDING_INVESTIGATION')
          OR raw_payload->>'investigation_required' = 'true'
          OR raw_payload->>'reconciliation_status' = 'PENDING'
      );

    IF NOT p_dry_run THEN
        -- Delete eligible records older than cutoff that do NOT require investigation
        WITH deleted AS (
            DELETE FROM public.webhook_events
            WHERE created_at < v_cutoff
              AND processing_status NOT IN ('FAILED', 'PENDING_INVESTIGATION')
              AND COALESCE(raw_payload->>'investigation_required', 'false') != 'true'
              AND COALESCE(raw_payload->>'reconciliation_status', '') != 'PENDING'
            RETURNING id
        )
        SELECT COUNT(*) INTO v_purged FROM deleted;

        -- Record audit log of the purge operation
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
        -- Dry-run: calculate purgeable count without deleting
        SELECT COUNT(*) INTO v_purged
        FROM public.webhook_events
        WHERE created_at < v_cutoff
          AND processing_status NOT IN ('FAILED', 'PENDING_INVESTIGATION')
          AND COALESCE(raw_payload->>'investigation_required', 'false') != 'true'
          AND COALESCE(raw_payload->>'reconciliation_status', '') != 'PENDING';
    END IF;

    RETURN QUERY SELECT v_purged, v_preserved, v_cutoff;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
