-- ==============================================================================
-- COVE PHASE 18R.1: FINAL FINANCIAL AND SERVERLESS SAFETY PATCH
-- Migration: 00013_phase18r1_safety_patch.sql
--
-- 1. Persistent PostgreSQL idempotency ledger (admin_idempotency_keys)
-- 2. RPC privilege hardening: REVOKE from PUBLIC, anon, authenticated with
--    explicit argument types; GRANT EXECUTE only to service_role
-- 3. Snapshot scope columns: scope_type + scope_id
-- 4. Legacy override migration audit function
-- 5. subscription_overrides read-only enforcement trigger
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. PERSISTENT ADMIN IDEMPOTENCY LEDGER
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_idempotency_keys (
    id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    action_type VARCHAR(100) NOT NULL,
    idempotency_key VARCHAR(255) NOT NULL,
    target_resource_id VARCHAR(255) NOT NULL,
    -- Fingerprint of the request payload (SHA256 hex of JSON-serialized body)
    request_fingerprint VARCHAR(64) NOT NULL,
    actor_admin_id UUID REFERENCES public.platform_admins(id) ON DELETE SET NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PROCESSING', -- PROCESSING, SUCCEEDED, FAILED
    result_payload JSONB,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (pg_catalog.now() + INTERVAL '7 days'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
    completed_at TIMESTAMPTZ,
    CONSTRAINT uq_admin_idempotency_key
        UNIQUE (action_type, idempotency_key, target_resource_id)
);

-- Index for TTL cleanup queries
CREATE INDEX IF NOT EXISTS idx_admin_idempotency_keys_expires
    ON public.admin_idempotency_keys (expires_at);

-- Index for actor lookups
CREATE INDEX IF NOT EXISTS idx_admin_idempotency_keys_actor
    ON public.admin_idempotency_keys (actor_admin_id, created_at DESC);

ALTER TABLE public.admin_idempotency_keys ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.admin_idempotency_keys FROM PUBLIC;
REVOKE ALL ON TABLE public.admin_idempotency_keys FROM anon;
REVOKE ALL ON TABLE public.admin_idempotency_keys FROM authenticated;
GRANT ALL ON TABLE public.admin_idempotency_keys TO service_role;

-- ------------------------------------------------------------------------------
-- 2. SNAPSHOT SCOPE COLUMNS
-- ------------------------------------------------------------------------------
ALTER TABLE public.saas_metrics_snapshots
    ADD COLUMN IF NOT EXISTS scope_type VARCHAR(50) NOT NULL DEFAULT 'PLATFORM';

ALTER TABLE public.saas_metrics_snapshots
    ADD COLUMN IF NOT EXISTS scope_id VARCHAR(100) NOT NULL DEFAULT 'GLOBAL';

-- Allow nullable retention rates when beginning_mrr == 0 (status: NOT_APPLICABLE)
ALTER TABLE public.saas_metrics_snapshots
    ALTER COLUMN gross_revenue_retention DROP NOT NULL,
    ALTER COLUMN net_revenue_retention DROP NOT NULL;

ALTER TABLE public.saas_metrics_snapshots
    ADD COLUMN IF NOT EXISTS gross_revenue_retention_status VARCHAR(50) DEFAULT 'CALCULATED',
    ADD COLUMN IF NOT EXISTS net_revenue_retention_status VARCHAR(50) DEFAULT 'CALCULATED';

-- Replace old uniqueness constraint with scoped version
ALTER TABLE public.saas_metrics_snapshots
    DROP CONSTRAINT IF EXISTS uq_saas_metrics_snapshot;

ALTER TABLE public.saas_metrics_snapshots
    ADD CONSTRAINT uq_saas_metrics_snapshot
    UNIQUE (period_type, snapshot_date, formula_version, currency, scope_type, scope_id);

-- ------------------------------------------------------------------------------
-- 3. RPC PRIVILEGE HARDENING — EXPLICIT ARGUMENT TYPES
-- ------------------------------------------------------------------------------

-- A. reconcile_payment_atomic(UUID, UUID, UUID, TEXT, NUMERIC, TEXT)
REVOKE ALL ON FUNCTION public.reconcile_payment_atomic(UUID, UUID, UUID, TEXT, NUMERIC, TEXT)
    FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reconcile_payment_atomic(UUID, UUID, UUID, TEXT, NUMERIC, TEXT)
    FROM anon;
REVOKE ALL ON FUNCTION public.reconcile_payment_atomic(UUID, UUID, UUID, TEXT, NUMERIC, TEXT)
    FROM authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_payment_atomic(UUID, UUID, UUID, TEXT, NUMERIC, TEXT)
    TO service_role;

-- B. unapply_payment_atomic(UUID, UUID, TEXT)
REVOKE ALL ON FUNCTION public.unapply_payment_atomic(UUID, UUID, TEXT)
    FROM PUBLIC;
REVOKE ALL ON FUNCTION public.unapply_payment_atomic(UUID, UUID, TEXT)
    FROM anon;
REVOKE ALL ON FUNCTION public.unapply_payment_atomic(UUID, UUID, TEXT)
    FROM authenticated;
GRANT EXECUTE ON FUNCTION public.unapply_payment_atomic(UUID, UUID, TEXT)
    TO service_role;

-- C. process_partial_payment_atomic(UUID, NUMERIC, VARCHAR, VARCHAR, VARCHAR, JSONB)
REVOKE ALL ON FUNCTION public.process_partial_payment_atomic(UUID, NUMERIC, VARCHAR, VARCHAR, VARCHAR, JSONB)
    FROM PUBLIC;
REVOKE ALL ON FUNCTION public.process_partial_payment_atomic(UUID, NUMERIC, VARCHAR, VARCHAR, VARCHAR, JSONB)
    FROM anon;
REVOKE ALL ON FUNCTION public.process_partial_payment_atomic(UUID, NUMERIC, VARCHAR, VARCHAR, VARCHAR, JSONB)
    FROM authenticated;
GRANT EXECUTE ON FUNCTION public.process_partial_payment_atomic(UUID, NUMERIC, VARCHAR, VARCHAR, VARCHAR, JSONB)
    TO service_role;

-- trg_admin_audit_logs_reject_mutation is a trigger function (not callable directly)
REVOKE ALL ON FUNCTION public.trg_admin_audit_logs_reject_mutation()
    FROM PUBLIC;
REVOKE ALL ON FUNCTION public.trg_admin_audit_logs_reject_mutation()
    FROM anon;
REVOKE ALL ON FUNCTION public.trg_admin_audit_logs_reject_mutation()
    FROM authenticated;

-- ------------------------------------------------------------------------------
-- 4. LEGACY SUBSCRIPTION_OVERRIDES READ-ONLY ENFORCEMENT
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_subscription_overrides_readonly()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RAISE EXCEPTION 'SUBSCRIPTION_OVERRIDES_DEPRECATED: This table is read-only. Use manual_subscription_overrides for all runtime entitlement overrides.'
        USING ERRCODE = 'P0009';
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_subscription_overrides_readonly ON public.subscription_overrides;
CREATE TRIGGER trg_subscription_overrides_readonly
    BEFORE INSERT OR UPDATE OR DELETE ON public.subscription_overrides
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_subscription_overrides_readonly();

-- Mark the table as read-only via comment
COMMENT ON TABLE public.subscription_overrides IS
    'DEPRECATED & READ-ONLY since Phase 18R.1: DML is blocked by trigger trg_subscription_overrides_readonly. '
    'Use public.manual_subscription_overrides as the single canonical source of truth. '
    'Existing records preserved for audit. Migration via migrate_legacy_subscription_overrides().';

-- ------------------------------------------------------------------------------
-- 5. LEGACY OVERRIDE MIGRATION FUNCTION
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.migrate_legacy_subscription_overrides()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_rec RECORD;
    v_sub_id UUID;
    v_total INT := 0;
    v_active_and_valid INT := 0;
    v_migrated INT := 0;
    v_already_migrated INT := 0;
    v_duplicate INT := 0;
    v_expired INT := 0;
    v_invalid INT := 0;
    v_failed INT := 0;
    v_remaining INT := 0;
    v_now TIMESTAMPTZ := pg_catalog.clock_timestamp();
    v_admin_id UUID;
BEGIN
    SELECT id INTO v_admin_id FROM public.platform_admins ORDER BY created_at ASC LIMIT 1;

    FOR v_rec IN
        SELECT
            so.id,
            so.org_id,
            so.granted_by,
            so.reason,
            so.override_max_projects,
            so.override_features,
            so.starts_at,
            so.expires_at,
            so.is_active,
            so.created_at
        FROM public.subscription_overrides so
        ORDER BY so.created_at ASC
    LOOP
        v_total := v_total + 1;

        -- Skip if already expired
        IF v_rec.expires_at <= v_now THEN
            v_expired := v_expired + 1;
            CONTINUE;
        END IF;

        -- Skip if explicitly inactive
        IF NOT v_rec.is_active THEN
            v_invalid := v_invalid + 1;
            CONTINUE;
        END IF;

        -- Find active subscription for this org
        SELECT id INTO v_sub_id
        FROM public.subscriptions
        WHERE org_id = v_rec.org_id
          AND status IN ('ACTIVE', 'PAST_DUE', 'READ_ONLY', 'PENDING_PAYMENT')
        ORDER BY created_at DESC
        LIMIT 1;

        IF v_sub_id IS NULL THEN
            v_invalid := v_invalid + 1;
            CONTINUE;
        END IF;

        v_active_and_valid := v_active_and_valid + 1;

        -- Check if already migrated previously (prevents duplicates on re-runs)
        IF EXISTS (
            SELECT 1 FROM public.manual_subscription_overrides mso
            WHERE mso.subscription_id = v_sub_id
              AND mso.override_type = 'ENTITLEMENT_BOOST'
              AND mso.new_value->>'legacy_id' = v_rec.id::text
        ) THEN
            v_already_migrated := v_already_migrated + 1;
            CONTINUE;
        END IF;

        -- Attempt idempotent insert into manual_subscription_overrides
        BEGIN
            INSERT INTO public.manual_subscription_overrides (
                subscription_id,
                org_id,
                override_type,
                previous_value,
                new_value,
                reason,
                admin_id,
                granted_at,
                expires_at,
                is_revoked,
                created_at
            ) VALUES (
                v_sub_id,
                v_rec.org_id,
                'ENTITLEMENT_BOOST',
                pg_catalog.jsonb_build_object(
                    'override_max_projects', v_rec.override_max_projects,
                    'override_features', v_rec.override_features
                ),
                pg_catalog.jsonb_build_object(
                    'migrated_from', 'subscription_overrides',
                    'legacy_id', v_rec.id,
                    'org_id', v_rec.org_id,
                    'granted_by', v_rec.granted_by,
                    'override_max_projects', v_rec.override_max_projects,
                    'override_features', v_rec.override_features
                ),
                'MIGRATED from legacy subscription_overrides: ' || COALESCE(v_rec.reason, 'No reason provided'),
                v_admin_id,
                COALESCE(v_rec.starts_at, v_rec.created_at, v_now - interval '1 hour'),
                v_rec.expires_at,
                false,
                COALESCE(v_rec.created_at, v_now)
            );
            v_migrated := v_migrated + 1;
        EXCEPTION
            WHEN unique_violation THEN
                v_duplicate := v_duplicate + 1;
            WHEN OTHERS THEN
                v_failed := v_failed + 1;
        END;
    END LOOP;

    v_remaining := v_active_and_valid - (v_migrated + v_already_migrated);

    RETURN pg_catalog.jsonb_build_object(
        'total_legacy_records', v_total,
        'active_and_valid', v_active_and_valid,
        'expired', v_expired,
        'invalid', v_invalid,
        'duplicate', v_duplicate,
        'successfully_migrated', v_migrated,
        'migrated', v_migrated,
        'already_migrated', v_already_migrated,
        'failed', v_failed,
        'remaining_unmigrated_active', v_remaining,
        'migration_timestamp', v_now
    );
END;
$$;

REVOKE ALL ON FUNCTION public.migrate_legacy_subscription_overrides()
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.migrate_legacy_subscription_overrides()
    TO service_role;

-- Helper function to seed simulated legacy override fixtures bypassing read-only trigger for testing
CREATE OR REPLACE FUNCTION public.create_legacy_override_fixture(
    p_org_id UUID,
    p_granted_by TEXT,
    p_reason TEXT,
    p_override_max_projects INT,
    p_override_features JSONB,
    p_starts_at TIMESTAMPTZ,
    p_expires_at TIMESTAMPTZ,
    p_is_active BOOLEAN
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_id UUID := gen_random_uuid();
BEGIN
    ALTER TABLE public.subscription_overrides DISABLE TRIGGER trg_subscription_overrides_readonly;

    INSERT INTO public.subscription_overrides (
        id, org_id, granted_by, reason,
        override_max_projects, override_features,
        starts_at, expires_at, is_active
    ) VALUES (
        v_id, p_org_id, p_granted_by, p_reason,
        p_override_max_projects, p_override_features,
        p_starts_at, p_expires_at, p_is_active
    );

    ALTER TABLE public.subscription_overrides ENABLE TRIGGER trg_subscription_overrides_readonly;
    RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_legacy_override_fixture(UUID, TEXT, TEXT, INT, JSONB, TIMESTAMPTZ, TIMESTAMPTZ, BOOLEAN)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_legacy_override_fixture(UUID, TEXT, TEXT, INT, JSONB, TIMESTAMPTZ, TIMESTAMPTZ, BOOLEAN)
    TO service_role;

-- Helper function to clean up legacy fixtures between test runs
CREATE OR REPLACE FUNCTION public.cleanup_legacy_override_fixtures_for_test()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    ALTER TABLE public.subscription_overrides DISABLE TRIGGER trg_subscription_overrides_readonly;
    DELETE FROM public.subscription_overrides;
    ALTER TABLE public.subscription_overrides ENABLE TRIGGER trg_subscription_overrides_readonly;

    DELETE FROM public.manual_subscription_overrides
    WHERE override_type = 'ENTITLEMENT_BOOST'
      AND new_value->>'migrated_from' = 'subscription_overrides';
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_legacy_override_fixtures_for_test()
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_legacy_override_fixtures_for_test()
    TO service_role;

-- ------------------------------------------------------------------------------
-- 6. CLAIM IDEMPOTENCY KEY — ATOMIC FUNCTION WITH TIMEOUT & RECOVERY
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_admin_idempotency_key(
    p_action_type VARCHAR(100),
    p_idempotency_key VARCHAR(255),
    p_target_resource_id VARCHAR(255),
    p_request_fingerprint VARCHAR(64),
    p_actor_admin_id UUID DEFAULT NULL,
    p_timeout_seconds INT DEFAULT 60
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_existing RECORD;
    v_new_id UUID;
    v_is_stuck BOOLEAN := FALSE;
    v_mutation_detected BOOLEAN := FALSE;
    v_recovered_payload JSONB := NULL;
BEGIN
    -- Try to find an existing key
    SELECT * INTO v_existing
    FROM public.admin_idempotency_keys
    WHERE action_type = p_action_type
      AND idempotency_key = p_idempotency_key
      AND target_resource_id = p_target_resource_id
    FOR UPDATE;

    IF FOUND THEN
        -- Check for payload conflict
        IF v_existing.request_fingerprint != p_request_fingerprint THEN
            RAISE EXCEPTION 'IDEMPOTENCY_PAYLOAD_CONFLICT: Key % was previously used with a different payload fingerprint. Rejecting to prevent unintended mutations.',
                p_idempotency_key
                USING ERRCODE = 'P0010';
        END IF;

        -- If already succeeded, return cached result immediately
        IF v_existing.status = 'SUCCEEDED' THEN
            RETURN pg_catalog.jsonb_build_object(
                'claimed', false,
                'is_duplicate', true,
                'status', 'SUCCEEDED',
                'result_payload', v_existing.result_payload,
                'key_id', v_existing.id
            );
        END IF;

        -- If currently in PROCESSING:
        IF v_existing.status = 'PROCESSING' THEN
            -- Check if timed out (stuck worker/crash)
            IF v_existing.created_at <= pg_catalog.clock_timestamp() - (COALESCE(p_timeout_seconds, 60) || ' seconds')::INTERVAL THEN
                v_is_stuck := TRUE;
            ELSE
                -- Actively in flight by another worker
                RETURN pg_catalog.jsonb_build_object(
                    'claimed', false,
                    'is_duplicate', true,
                    'status', 'PROCESSING',
                    'result_payload', NULL,
                    'key_id', v_existing.id
                );
            END IF;
        END IF;

        -- RECOVERY POLICY FOR STUCK PROCESSING RECORD:
        IF v_is_stuck THEN
            -- Check if the mutation actually completed before crash
            IF p_action_type = 'RECONCILE_PAYMENT' THEN
                SELECT EXISTS (
                    SELECT 1 FROM public.reconciliation_queue
                    WHERE id::text = p_target_resource_id
                      AND status IN ('RESOLVED', 'PARTIALLY_APPLIED')
                ) INTO v_mutation_detected;
            ELSIF p_action_type = 'UNAPPLY_PAYMENT' THEN
                SELECT EXISTS (
                    SELECT 1 FROM public.reconciliation_queue
                    WHERE id::text = p_target_resource_id
                      AND status = 'UNAPPLIED'
                ) INTO v_mutation_detected;
            ELSIF p_action_type = 'PROCESS_REFUND' THEN
                SELECT EXISTS (
                    SELECT 1 FROM public.payment_refunds
                    WHERE (payment_id::text = p_target_resource_id OR provider_refund_id = p_idempotency_key)
                      AND status = 'SUCCEEDED'
                ) INTO v_mutation_detected;
            END IF;

            IF v_mutation_detected THEN
                -- Mutation succeeded before crash -> complete key and return cached success
                v_recovered_payload := pg_catalog.jsonb_build_object(
                    'success', true,
                    'recovered', true,
                    'message', 'Recovered from crash: mutation was previously committed.',
                    'target_resource_id', p_target_resource_id
                );
                UPDATE public.admin_idempotency_keys
                SET status = 'SUCCEEDED',
                    result_payload = v_recovered_payload,
                    completed_at = pg_catalog.clock_timestamp()
                WHERE id = v_existing.id;

                RETURN pg_catalog.jsonb_build_object(
                    'claimed', false,
                    'is_duplicate', true,
                    'status', 'SUCCEEDED',
                    'recovered', true,
                    'result_payload', v_recovered_payload,
                    'key_id', v_existing.id
                );
            ELSE
                -- Crash happened BEFORE mutation occurred -> reclaim key and allow worker to proceed safely
                UPDATE public.admin_idempotency_keys
                SET status = 'PROCESSING',
                    created_at = pg_catalog.clock_timestamp()
                WHERE id = v_existing.id;

                RETURN pg_catalog.jsonb_build_object(
                    'claimed', true,
                    'is_duplicate', false,
                    'status', 'PROCESSING',
                    'recovered', true,
                    'result_payload', NULL,
                    'key_id', v_existing.id
                );
            END IF;
        END IF;

        -- If status was FAILED, allow safe retry
        IF v_existing.status = 'FAILED' THEN
            UPDATE public.admin_idempotency_keys
            SET status = 'PROCESSING',
                created_at = pg_catalog.clock_timestamp()
            WHERE id = v_existing.id;

            RETURN pg_catalog.jsonb_build_object(
                'claimed', true,
                'is_duplicate', false,
                'status', 'PROCESSING',
                'retrying_failed', true,
                'result_payload', NULL,
                'key_id', v_existing.id
            );
        END IF;
    END IF;

    -- Claim new key with race condition handling
    BEGIN
        INSERT INTO public.admin_idempotency_keys (
            action_type,
            idempotency_key,
            target_resource_id,
            request_fingerprint,
            actor_admin_id,
            status
        ) VALUES (
            p_action_type,
            p_idempotency_key,
            p_target_resource_id,
            p_request_fingerprint,
            p_actor_admin_id,
            'PROCESSING'
        )
        RETURNING id INTO v_new_id;

        RETURN pg_catalog.jsonb_build_object(
            'claimed', true,
            'is_duplicate', false,
            'status', 'PROCESSING',
            'result_payload', NULL,
            'key_id', v_new_id
        );
    EXCEPTION WHEN unique_violation THEN
        -- Concurrently inserted by another worker after our initial SELECT
        SELECT * INTO v_existing
        FROM public.admin_idempotency_keys
        WHERE action_type = p_action_type
          AND idempotency_key = p_idempotency_key
          AND target_resource_id = p_target_resource_id
        FOR UPDATE;

        IF FOUND THEN
            IF v_existing.request_fingerprint != p_request_fingerprint THEN
                RAISE EXCEPTION 'IDEMPOTENCY_PAYLOAD_CONFLICT: Key % was previously used with a different payload fingerprint. Rejecting to prevent unintended mutations.',
                    p_idempotency_key
                    USING ERRCODE = 'P0010';
            END IF;

            RETURN pg_catalog.jsonb_build_object(
                'claimed', false,
                'is_duplicate', true,
                'status', v_existing.status,
                'result_payload', v_existing.result_payload,
                'key_id', v_existing.id
            );
        END IF;

        RAISE EXCEPTION 'IDEMPOTENCY_RACE_FAILED: Could not locate concurrent idempotency key %', p_idempotency_key;
    END;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_admin_idempotency_key(VARCHAR, VARCHAR, VARCHAR, VARCHAR, UUID, INT)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_admin_idempotency_key(VARCHAR, VARCHAR, VARCHAR, VARCHAR, UUID, INT)
    TO service_role;

-- Function to complete an idempotency key after successful execution
CREATE OR REPLACE FUNCTION public.complete_admin_idempotency_key(
    p_key_id UUID,
    p_status VARCHAR(50),
    p_result_payload JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    UPDATE public.admin_idempotency_keys
    SET status = p_status,
        result_payload = p_result_payload,
        completed_at = pg_catalog.clock_timestamp()
    WHERE id = p_key_id;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_admin_idempotency_key(UUID, VARCHAR, JSONB)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_admin_idempotency_key(UUID, VARCHAR, JSONB)
    TO service_role;

-- ------------------------------------------------------------------------------
-- 6B. SINGLE-TRANSACTION ATOMIC FINANCIAL ACTION EXECUTOR
-- Claims idempotency key, executes financial mutation, writes audit log,
-- and completes idempotency key — all inside ONE single PostgreSQL transaction.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.execute_admin_financial_action_atomic(
    p_action_type VARCHAR(100),
    p_idempotency_key VARCHAR(255),
    p_target_resource_id VARCHAR(255),
    p_request_fingerprint VARCHAR(64),
    p_admin_id UUID,
    p_reason TEXT,
    p_payload JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_claim JSONB;
    v_result JSONB;
    v_key_id UUID;
BEGIN
    -- 1. Atomically claim idempotency key (locks row FOR UPDATE)
    v_claim := public.claim_admin_idempotency_key(
        p_action_type,
        p_idempotency_key,
        p_target_resource_id,
        p_request_fingerprint,
        p_admin_id,
        60
    );

    -- If already processed or duplicate cached, return result immediately
    IF (v_claim->>'claimed')::boolean = FALSE AND (v_claim->>'status') = 'SUCCEEDED' THEN
        RETURN pg_catalog.jsonb_build_object(
            'success', true,
            'is_idempotent', true,
            'data', v_claim->'result_payload'
        );
    END IF;

    IF (v_claim->>'claimed')::boolean = FALSE AND (v_claim->>'status') = 'PROCESSING' THEN
        RAISE EXCEPTION 'IDEMPOTENCY_IN_FLIGHT: Action is currently being processed by another worker'
            USING ERRCODE = 'P0011';
    END IF;

    v_key_id := (v_claim->>'key_id')::UUID;

    -- 2. Execute the financial mutation based on action_type
    IF p_action_type = 'RECONCILE_PAYMENT' THEN
        v_result := public.reconcile_payment_atomic(
            p_target_resource_id::UUID,
            (p_payload->>'invoiceId')::UUID,
            p_admin_id,
            p_reason,
            (p_payload->>'applyAmount')::NUMERIC,
            (p_payload->>'notes')::TEXT
        );
    ELSIF p_action_type = 'UNAPPLY_PAYMENT' THEN
        v_result := public.unapply_payment_atomic(
            p_target_resource_id::UUID,
            p_admin_id,
            p_reason
        );
    ELSE
        RAISE EXCEPTION 'UNSUPPORTED_ATOMIC_ACTION: Action % is not supported for single-transaction atomic execution', p_action_type
            USING ERRCODE = 'P0012';
    END IF;

    -- 3. Complete idempotency key atomically in the SAME transaction
    PERFORM public.complete_admin_idempotency_key(
        v_key_id,
        'SUCCEEDED',
        v_result
    );

    RETURN pg_catalog.jsonb_build_object(
        'success', true,
        'is_idempotent', false,
        'single_transaction_atomic', true,
        'data', v_result
    );
END;
$$;

REVOKE ALL ON FUNCTION public.execute_admin_financial_action_atomic(VARCHAR, VARCHAR, VARCHAR, VARCHAR, UUID, TEXT, JSONB)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.execute_admin_financial_action_atomic(VARCHAR, VARCHAR, VARCHAR, VARCHAR, UUID, TEXT, JSONB)
    TO service_role;

-- ------------------------------------------------------------------------------
-- 7. CONCURRENT REFUND PROTECTION TRIGGER WITH ROW-LEVEL LOCKING
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_payment_refunds_limit_check()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_payment RECORD;
    v_existing_refunded NUMERIC := 0;
BEGIN
    -- Only check on refund / dispute types that impact revenue
    IF NEW.type IN ('FULL_REFUND', 'PARTIAL_REFUND', 'REVERSAL', 'DISPUTE_LOST') THEN
        -- Row-level lock on the parent payment row to serialize concurrent refund requests
        SELECT * INTO v_payment
        FROM public.payments
        WHERE id = NEW.payment_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'PAYMENT_NOT_FOUND: Payment % not found', NEW.payment_id
                USING ERRCODE = 'P0011';
        END IF;

        -- Sum existing succeeded or pending refunds
        SELECT COALESCE(SUM(amount), 0) INTO v_existing_refunded
        FROM public.payment_refunds
        WHERE payment_id = NEW.payment_id
          AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
          AND status IN ('SUCCEEDED', 'PENDING')
          AND type IN ('FULL_REFUND', 'PARTIAL_REFUND', 'REVERSAL', 'DISPUTE_LOST');

        IF (v_existing_refunded + NEW.amount) > v_payment.amount THEN
            RAISE EXCEPTION 'CUMULATIVE_REFUND_EXCEEDS_SETTLED_AMOUNT: Akumulasi refund (Rp %) melebihi jumlah pembayaran terselesaikan (Rp %).',
                (v_existing_refunded + NEW.amount), v_payment.amount
                USING ERRCODE = 'P0008';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_payment_refunds_limit_check ON public.payment_refunds;
CREATE TRIGGER trg_payment_refunds_limit_check
    BEFORE INSERT ON public.payment_refunds
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_payment_refunds_limit_check();

