-- ==============================================================================
-- COVE V1 — Migration 00009: Phase 17 Renewal, Dunning & Billing Recovery Engine
-- Source of Truth: COVE_SUBSCRIPTION_BILLING_BLUEPRINT_v1.0.md (Bagian 6, 7, 10, 11)
-- PRD Reference: COVE_PRD_v1.0_Validation_Gated_MVP.md (Section 28 Open Data Guarantee)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. PREFLIGHT: IDEMPOTENT UNIQUE CONSTRAINT ON PROFILES.AUTH_USER_ID
-- ------------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_schema = 'public'
          AND table_name = 'profiles'
          AND constraint_type = 'UNIQUE'
          AND constraint_name = 'profiles_auth_user_id_key'
    ) THEN
        ALTER TABLE public.profiles ADD CONSTRAINT profiles_auth_user_id_key UNIQUE (auth_user_id);
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 2. PREFLIGHT: RESTRICT DIRECT SELECT ON SUBSCRIPTIONS TO BILLING READERS ONLY
-- ------------------------------------------------------------------------------
-- Previously allowed any active org member; now restricted strictly to billing reader roles
-- (OWNER, ADMIN, FINANCE, FINANCE_MANAGER, COMMERCIAL_MANAGER) or Platform Super Admin.
DROP POLICY IF EXISTS rls_subscriptions_select ON public.subscriptions;

CREATE POLICY rls_subscriptions_select ON public.subscriptions
    FOR SELECT TO authenticated
    USING (
        private.is_org_billing_reader(org_id) OR private.is_platform_super_admin()
    );

-- ------------------------------------------------------------------------------
-- 3. PREFLIGHT: SAFE REMOVAL OF OBSOLETE PUBLIC AUTHORIZATION WRAPPERS
-- ------------------------------------------------------------------------------
-- All internal policies and database RPCs now reside strictly in schema `private`.
DROP FUNCTION IF EXISTS public.is_active_org_member(UUID);
DROP FUNCTION IF EXISTS public.is_org_billing_admin(UUID);
DROP FUNCTION IF EXISTS public.is_platform_super_admin();

-- ------------------------------------------------------------------------------
-- 4. ADDITIVE DUNNING DATA MODEL
-- ------------------------------------------------------------------------------

-- 4.1 DUNNING CYCLES: Tracks overall dunning workflow per tenant, subscription, and invoice
CREATE TABLE IF NOT EXISTS public.dunning_cycles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    subscription_id UUID NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
    billing_invoice_id UUID REFERENCES public.billing_invoices(id) ON DELETE SET NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'RECOVERED', 'MAX_RETRIES_EXCEEDED', 'CANCELLED'
    stage VARCHAR(50) NOT NULL DEFAULT 'H_MINUS_7', -- 'H_MINUS_7', 'H_MINUS_1', 'DUE_DATE', 'H_PLUS_1', 'H_PLUS_3', 'H_PLUS_7', 'H_PLUS_21', 'RECOVERED'
    scheduled_at TIMESTAMPTZ NOT NULL,
    processed_at TIMESTAMPTZ,
    attempt_count INT NOT NULL DEFAULT 0,
    idempotency_key VARCHAR(255) UNIQUE NOT NULL,
    last_error_code VARCHAR(100),
    last_error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4.2 DUNNING EVENTS: Fine-grained ledger of discrete actions (notifications, retries, transitions)
CREATE TABLE IF NOT EXISTS public.dunning_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    subscription_id UUID NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
    billing_invoice_id UUID REFERENCES public.billing_invoices(id) ON DELETE SET NULL,
    dunning_cycle_id UUID REFERENCES public.dunning_cycles(id) ON DELETE CASCADE,
    stage VARCHAR(50) NOT NULL, -- 'H_MINUS_7', 'H_MINUS_1', 'DUE_DATE', 'H_PLUS_1', 'H_PLUS_3', 'H_PLUS_7', 'H_PLUS_21'
    action_type VARCHAR(50) NOT NULL, -- 'NOTIFICATION', 'STATE_TRANSITION', 'PAYMENT_RETRY'
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'PROCESSED', 'FAILED', 'SKIPPED'
    scheduled_at TIMESTAMPTZ NOT NULL,
    processed_at TIMESTAMPTZ,
    attempt_count INT NOT NULL DEFAULT 0,
    idempotency_key VARCHAR(255) UNIQUE NOT NULL,
    last_error_code VARCHAR(100),
    last_error_message TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4.3 BILLING NOTIFICATIONS: Multi-channel customer notification audit trail
CREATE TABLE IF NOT EXISTS public.billing_notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    subscription_id UUID NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
    billing_invoice_id UUID REFERENCES public.billing_invoices(id) ON DELETE SET NULL,
    stage VARCHAR(50) NOT NULL,
    channel VARCHAR(50) NOT NULL, -- 'IN_APP', 'EMAIL', 'WHATSAPP'
    recipient VARCHAR(255) NOT NULL,
    subject TEXT,
    body_text TEXT NOT NULL,
    action_url TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'QUEUED', -- 'QUEUED', 'SENT', 'FAILED'
    scheduled_at TIMESTAMPTZ NOT NULL,
    processed_at TIMESTAMPTZ,
    attempt_count INT NOT NULL DEFAULT 0,
    idempotency_key VARCHAR(255) UNIQUE NOT NULL,
    last_error_code VARCHAR(100),
    last_error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4.4 RENEWAL JOBS: Scheduled automated subscription renewal queue
CREATE TABLE IF NOT EXISTS public.renewal_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    subscription_id UUID NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
    billing_invoice_id UUID REFERENCES public.billing_invoices(id) ON DELETE SET NULL,
    stage VARCHAR(50) NOT NULL DEFAULT 'RENEWAL',
    status VARCHAR(50) NOT NULL DEFAULT 'SCHEDULED', -- 'SCHEDULED', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED'
    scheduled_at TIMESTAMPTZ NOT NULL,
    processed_at TIMESTAMPTZ,
    attempt_count INT NOT NULL DEFAULT 0,
    idempotency_key VARCHAR(255) UNIQUE NOT NULL,
    last_error_code VARCHAR(100),
    last_error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4.5 PAYMENT RETRY ATTEMPTS: Ledger of discrete gateway debit retries
CREATE TABLE IF NOT EXISTS public.payment_retry_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    subscription_id UUID NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
    billing_invoice_id UUID REFERENCES public.billing_invoices(id) ON DELETE CASCADE,
    stage VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'SUCCEEDED', 'FAILED', 'SKIPPED'
    scheduled_at TIMESTAMPTZ NOT NULL,
    processed_at TIMESTAMPTZ,
    attempt_count INT NOT NULL DEFAULT 0,
    idempotency_key VARCHAR(255) UNIQUE NOT NULL,
    last_error_code VARCHAR(100),
    last_error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY ON DUNNING TABLES
-- ------------------------------------------------------------------------------

ALTER TABLE public.dunning_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dunning_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.renewal_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_retry_attempts ENABLE ROW LEVEL SECURITY;

-- 5.1 dunning_cycles policies
CREATE POLICY rls_dunning_cycles_select ON public.dunning_cycles
    FOR SELECT TO authenticated
    USING (
        private.is_org_billing_reader(org_id) OR private.is_platform_super_admin()
    );

CREATE POLICY rls_dunning_cycles_service_role ON public.dunning_cycles
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- 5.2 dunning_events policies
CREATE POLICY rls_dunning_events_select ON public.dunning_events
    FOR SELECT TO authenticated
    USING (
        private.is_org_billing_reader(org_id) OR private.is_platform_super_admin()
    );

CREATE POLICY rls_dunning_events_service_role ON public.dunning_events
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- 5.3 billing_notifications policies
CREATE POLICY rls_billing_notifications_select ON public.billing_notifications
    FOR SELECT TO authenticated
    USING (
        private.is_org_billing_reader(org_id) OR private.is_platform_super_admin()
    );

CREATE POLICY rls_billing_notifications_service_role ON public.billing_notifications
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- 5.4 renewal_jobs policies
CREATE POLICY rls_renewal_jobs_select ON public.renewal_jobs
    FOR SELECT TO authenticated
    USING (
        private.is_org_billing_reader(org_id) OR private.is_platform_super_admin()
    );

CREATE POLICY rls_renewal_jobs_service_role ON public.renewal_jobs
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- 5.5 payment_retry_attempts policies
CREATE POLICY rls_payment_retry_attempts_select ON public.payment_retry_attempts
    FOR SELECT TO authenticated
    USING (
        private.is_org_billing_reader(org_id) OR private.is_platform_super_admin()
    );

CREATE POLICY rls_payment_retry_attempts_service_role ON public.payment_retry_attempts
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 6. ATOMIC DATABASE RPC: PROCESS DUNNING STAGE TRANSITION (ROW-LOCKED)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.process_dunning_stage_transition(
    p_subscription_id UUID,
    p_target_stage VARCHAR,
    p_target_status VARCHAR,
    p_scheduled_at TIMESTAMPTZ,
    p_idempotency_key VARCHAR
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_sub RECORD;
    v_org_id UUID;
    v_old_status VARCHAR;
    v_event_id UUID;
BEGIN
    -- 1. Idempotency Check: if idempotency key already processed, return early
    IF EXISTS (
        SELECT 1 FROM public.dunning_events
        WHERE idempotency_key = p_idempotency_key
          AND status = 'PROCESSED'
    ) THEN
        RETURN pg_catalog.jsonb_build_object(
            'success', true,
            'idempotent_replay', true,
            'message', 'Dunning event already processed.'
        );
    END IF;

    -- 2. Lock subscription row for update to serialize parallel execution
    SELECT * INTO v_sub
    FROM public.subscriptions
    WHERE id = p_subscription_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'SUBSCRIPTION_NOT_FOUND: Langganan dengan ID % tidak ditemukan.', p_subscription_id
            USING ERRCODE = 'P0002';
    END IF;

    v_org_id := v_sub.org_id;
    v_old_status := v_sub.status;

    -- 3. If target status differs from current status, apply state transition
    IF p_target_status IS NOT NULL AND p_target_status <> v_old_status THEN
        -- Verify legal transitions
        IF v_old_status = 'ACTIVE' AND p_target_status IN ('PAST_DUE', 'CANCEL_AT_PERIOD_END', 'CANCELLED') OR
           v_old_status = 'PAST_DUE' AND p_target_status IN ('READ_ONLY', 'ACTIVE', 'CANCELLED') OR
           v_old_status = 'READ_ONLY' AND p_target_status IN ('SUSPENDED', 'ACTIVE', 'CANCELLED') OR
           v_old_status = 'SUSPENDED' AND p_target_status IN ('ACTIVE', 'CANCELLED') OR
           v_old_status = 'CANCEL_AT_PERIOD_END' AND p_target_status IN ('CANCELLED', 'ACTIVE')
        THEN
            UPDATE public.subscriptions
            SET status = p_target_status,
                updated_at = NOW()
            WHERE id = p_subscription_id;

            -- Mirror status on organization
            UPDATE public.organizations
            SET subscription_status = p_target_status
            WHERE id = v_org_id;

            -- Record immutable status audit event
            INSERT INTO public.subscription_status_events (
                id,
                subscription_id,
                from_status,
                to_status,
                reason,
                source,
                created_at
            ) VALUES (
                pg_catalog.gen_random_uuid(),
                p_subscription_id,
                v_old_status,
                p_target_status,
                'Automated dunning transition to ' || p_target_status || ' at stage ' || p_target_stage,
                'DUNNING_CRON',
                NOW()
            );
        ELSE
            RAISE EXCEPTION 'ILLEGAL_TRANSITION: Transisi dari % ke % tidak diizinkan pada stage %.',
                v_old_status, p_target_status, p_target_stage
                USING ERRCODE = 'P0001';
        END IF;
    END IF;

    -- 4. Record processed dunning event
    INSERT INTO public.dunning_events (
        id,
        org_id,
        subscription_id,
        stage,
        action_type,
        status,
        scheduled_at,
        processed_at,
        attempt_count,
        idempotency_key,
        created_at,
        updated_at
    ) VALUES (
        pg_catalog.gen_random_uuid(),
        v_org_id,
        p_subscription_id,
        p_target_stage,
        'STATE_TRANSITION',
        'PROCESSED',
        p_scheduled_at,
        NOW(),
        1,
        p_idempotency_key,
        NOW(),
        NOW()
    )
    RETURNING id INTO v_event_id;

    RETURN pg_catalog.jsonb_build_object(
        'success', true,
        'event_id', v_event_id,
        'from_status', v_old_status,
        'to_status', COALESCE(p_target_status, v_old_status),
        'stage', p_target_stage
    );
END;
$$;

REVOKE ALL ON FUNCTION private.process_dunning_stage_transition(UUID, VARCHAR, VARCHAR, TIMESTAMPTZ, VARCHAR) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.process_dunning_stage_transition(UUID, VARCHAR, VARCHAR, TIMESTAMPTZ, VARCHAR) FROM anon;
REVOKE ALL ON FUNCTION private.process_dunning_stage_transition(UUID, VARCHAR, VARCHAR, TIMESTAMPTZ, VARCHAR) FROM authenticated;
GRANT EXECUTE ON FUNCTION private.process_dunning_stage_transition(UUID, VARCHAR, VARCHAR, TIMESTAMPTZ, VARCHAR) TO service_role;
