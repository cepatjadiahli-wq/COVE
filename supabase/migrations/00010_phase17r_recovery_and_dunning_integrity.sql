-- ==============================================================================
-- COVE V1 — Migration 00010: Phase 17R Dunning Financial Integrity & Atomic Recovery
-- Source of Truth: COVE_SUBSCRIPTION_BILLING_BLUEPRINT_v1.0.md (Bagian 6, 7, 10, 11)
-- PRD Reference: COVE_PRD_v1.0_Validation_Gated_MVP.md (Section 28 Open Data Guarantee)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. EXTEND PUBLIC.PAYMENTS SCHEMA FOR OVERPAYMENT & RECONCILIATION
-- ------------------------------------------------------------------------------
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS overpayment_amount NUMERIC(18, 2) DEFAULT 0;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS reconciliation_notes TEXT;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS raw_payload JSONB DEFAULT '{}'::jsonb;

-- ------------------------------------------------------------------------------
-- 1.1 ALIGN ORGANIZATIONS.SUBSCRIPTION_STATUS WITH CANONICAL SUBSCRIPTION STATUSES
-- ------------------------------------------------------------------------------
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS subscription_tier VARCHAR(50);

ALTER TABLE public.organizations DROP CONSTRAINT IF EXISTS organizations_subscription_status_check;
ALTER TABLE public.organizations ADD CONSTRAINT organizations_subscription_status_check
    CHECK (subscription_status IN (
        'trial', 'active', 'suspended', 'cancelled',
        'DRAFT', 'PENDING_PAYMENT', 'PILOT_ACTIVE', 'ACTIVE', 
        'CANCEL_AT_PERIOD_END', 'PAST_DUE', 'READ_ONLY', 'SUSPENDED', 'CANCELLED', 'EXPIRED', 'MANUAL_GRANT'
    ));

-- ------------------------------------------------------------------------------
-- 2. CALIBRATE BILLING NOTIFICATION STATUSES
-- Allowed: 'DRAFT', 'QUEUED', 'GENERATED', 'SENDING', 'SENT', 'DELIVERED', 'FAILED', 'BOUNCED', 'SKIPPED'
-- Default for newly generated templates is 'GENERATED' or 'QUEUED'.
-- ------------------------------------------------------------------------------
ALTER TABLE public.billing_notifications DROP CONSTRAINT IF EXISTS chk_billing_notification_status;
ALTER TABLE public.billing_notifications ADD CONSTRAINT chk_billing_notification_status
    CHECK (status IN ('DRAFT', 'QUEUED', 'GENERATED', 'SENDING', 'SENT', 'DELIVERED', 'FAILED', 'BOUNCED', 'SKIPPED'));

ALTER TABLE public.billing_notifications ALTER COLUMN status SET DEFAULT 'GENERATED';

-- ------------------------------------------------------------------------------
-- 3. EXTEND PAYMENT RETRY ATTEMPTS WITH RETRY ELIGIBILITY & POLICY ATTRIBUTES
-- ------------------------------------------------------------------------------
ALTER TABLE public.payment_retry_attempts ADD COLUMN IF NOT EXISTS retry_eligibility VARCHAR(50) DEFAULT 'RETRY_AFTER';
ALTER TABLE public.payment_retry_attempts ADD COLUMN IF NOT EXISTS earliest_retry_at TIMESTAMPTZ;
ALTER TABLE public.payment_retry_attempts ADD COLUMN IF NOT EXISTS normalized_error_code VARCHAR(100);
ALTER TABLE public.payment_retry_attempts ADD COLUMN IF NOT EXISTS customer_action_required BOOLEAN DEFAULT false;
ALTER TABLE public.payment_retry_attempts ADD COLUMN IF NOT EXISTS max_attempts INT DEFAULT 3;

ALTER TABLE public.payment_retry_attempts DROP CONSTRAINT IF EXISTS chk_retry_eligibility;
ALTER TABLE public.payment_retry_attempts ADD CONSTRAINT chk_retry_eligibility
    CHECK (retry_eligibility IN ('RETRY_NOW', 'RETRY_AFTER', 'CUSTOMER_ACTION_REQUIRED', 'DO_NOT_RETRY', 'PROVIDER_REVIEW_REQUIRED'));

-- ------------------------------------------------------------------------------
-- 4. ATOMIC DATABASE RPC: PROCESS VERIFIED PAYMENT RECOVERY (ALL-OR-NOTHING)
-- Enforces 15 rigorous checks before mutating any subscription status:
--   1. Webhook idempotency (unique provider event)
--   2. Provider payment ID uniqueness
--   3. Billing customer matches organization
--   4. Valid COVE billing invoice (strictly rejects construction claims/invoices)
--   5. Invoice linked to valid subscription
--   6. Relevant active/renewal period verification
--   7. Currency matches (IDR)
--   8. Payment satisfies amount_due (amount >= amount_total)
--   9. Provider settlement status verification ('SETTLED', 'COMPLETED', 'PAID', 'SUCCESS')
--  10. Invoice not expired, void, or already paid
--  11. Plan tier & price ID match
--  12. Stale payment rejection (cannot restore newer period without verified invoice)
--  13. Partial payment rejection (amount < amount_due raises exception)
--  14. Overpayment recorded as reconciliation note without extra period multiplier
--  15. Single atomic all-or-nothing mutation:
--      record payment -> update invoice -> update subscription -> update organization
--      -> create status event -> close dunning cycle -> record webhook event
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.process_verified_payment_recovery(
    p_provider VARCHAR,
    p_event_id VARCHAR,
    p_payment_id VARCHAR,
    p_billing_invoice_id UUID,
    p_org_id UUID,
    p_amount NUMERIC,
    p_currency VARCHAR,
    p_settlement_status VARCHAR,
    p_payment_method VARCHAR DEFAULT 'GATEWAY_WEBHOOK',
    p_raw_payload JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_invoice RECORD;
    v_sub RECORD;
    v_ent RECORD;
    v_payment_id UUID;
    v_now TIMESTAMPTZ := NOW();
    v_new_period_start TIMESTAMPTZ;
    v_new_period_end TIMESTAMPTZ;
    v_overpayment NUMERIC(18, 2) := 0;
    v_recon_note TEXT;
    v_prev_sub_status VARCHAR;
    v_settlement_upper VARCHAR;
BEGIN
    -- -------------------------------------------------------------------------
    -- Check 1: Webhook idempotency
    -- -------------------------------------------------------------------------
    IF EXISTS (
        SELECT 1 FROM public.webhook_events
        WHERE provider = p_provider
          AND event_id = p_event_id
          AND processing_status = 'PROCESSED'
    ) THEN
        RETURN pg_catalog.jsonb_build_object(
            'success', true,
            'idempotent_replay', true,
            'new_status', 'ACTIVE',
            'message', 'Webhook event already processed successfully.'
        );
    END IF;

    -- -------------------------------------------------------------------------
    -- Check 2: Unique provider payment ID
    -- -------------------------------------------------------------------------
    IF EXISTS (
        SELECT 1 FROM public.payments
        WHERE provider = p_provider
          AND provider_payment_id = p_payment_id
    ) THEN
        RETURN pg_catalog.jsonb_build_object(
            'success', true,
            'idempotent_replay', true,
            'new_status', 'ACTIVE',
            'message', 'Payment already processed with provider payment ID: ' || p_payment_id
        );
    END IF;

    -- -------------------------------------------------------------------------
    -- Check 4: Verify that p_billing_invoice_id is a valid COVE billing invoice
    -- Strictly reject construction claim invoices or non-existent billing invoices
    -- -------------------------------------------------------------------------
    SELECT * INTO v_invoice
    FROM public.billing_invoices
    WHERE id = p_billing_invoice_id;

    IF NOT FOUND THEN
        -- Forensically check if it was mistakenly directed to a construction claim or invoice
        IF EXISTS (SELECT 1 FROM public.invoices WHERE id = p_billing_invoice_id) OR
           EXISTS (SELECT 1 FROM public.claims WHERE id = p_billing_invoice_id) THEN
            RAISE EXCEPTION 'CONSTRUCTION_INVOICE_REJECTION: ID % adalah invoice proyek konstruksi atau claim, bukan billing invoice langganan COVE.', p_billing_invoice_id
                USING ERRCODE = 'P0004';
        ELSE
            RAISE EXCEPTION 'BILLING_INVOICE_NOT_FOUND: Faktur tagihan billing dengan ID % tidak ditemukan.', p_billing_invoice_id
                USING ERRCODE = 'P0004';
        END IF;
    END IF;

    -- -------------------------------------------------------------------------
    -- Check 3: Customer organization must match invoice organization
    -- -------------------------------------------------------------------------
    IF v_invoice.org_id <> p_org_id THEN
        RAISE EXCEPTION 'CROSS_TENANT_REJECTION: Organisasi pemohon (%) tidak sesuai dengan pemilik tagihan (%).', p_org_id, v_invoice.org_id
            USING ERRCODE = 'P0003';
    END IF;

    -- -------------------------------------------------------------------------
    -- Check 5: Invoice must be linked to a subscription
    -- -------------------------------------------------------------------------
    IF v_invoice.subscription_id IS NULL THEN
        RAISE EXCEPTION 'ORPHAN_INVOICE: Faktur tagihan % tidak terhubung dengan subscription aktif.', v_invoice.invoice_number
            USING ERRCODE = 'P0005';
    END IF;

    -- -------------------------------------------------------------------------
    -- Check 10: Invoice status must be PENDING or DRAFT (not already PAID, VOID, EXPIRED)
    -- -------------------------------------------------------------------------
    IF v_invoice.status = 'PAID' THEN
        RAISE EXCEPTION 'STALE_PAYMENT_REJECTION: Faktur tagihan % sudah berstatus PAID.', v_invoice.invoice_number
            USING ERRCODE = 'P0006';
    END IF;

    IF v_invoice.status NOT IN ('PENDING', 'DRAFT') THEN
        RAISE EXCEPTION 'INVALID_INVOICE_STATUS: Faktur tagihan berstatus % tidak dapat diproses pembayarannya.', v_invoice.status
            USING ERRCODE = 'P0006';
    END IF;

    -- -------------------------------------------------------------------------
    -- Check 7: Currency match
    -- -------------------------------------------------------------------------
    IF UPPER(TRIM(p_currency)) <> UPPER(TRIM(v_invoice.currency)) THEN
        RAISE EXCEPTION 'CURRENCY_MISMATCH: Mata uang pembayaran (%) tidak sesuai dengan tagihan (%).', p_currency, v_invoice.currency
            USING ERRCODE = 'P0007';
    END IF;

    -- -------------------------------------------------------------------------
    -- Check 9 & 13: Partial payment rejection
    -- -------------------------------------------------------------------------
    IF p_amount < v_invoice.amount_total THEN
        RAISE EXCEPTION 'PARTIAL_PAYMENT_REJECTED: Pembayaran sebagian (Rp %) ditolak. Nilai penuh tagihan adalah Rp %.', p_amount, v_invoice.amount_total
            USING ERRCODE = 'P0009';
    END IF;

    -- -------------------------------------------------------------------------
    -- Check 8: Provider settlement status
    -- -------------------------------------------------------------------------
    v_settlement_upper := UPPER(TRIM(p_settlement_status));
    IF v_settlement_upper NOT IN ('SETTLED', 'COMPLETED', 'PAID', 'SUCCESS') THEN
        RAISE EXCEPTION 'UNSETTLED_PAYMENT: Status penyelesaian gateway % belum memenuhi syarat settlement.', p_settlement_status
            USING ERRCODE = 'P0008';
    END IF;

    -- -------------------------------------------------------------------------
    -- Row-lock subscription row for atomic serialization
    -- -------------------------------------------------------------------------
    SELECT * INTO v_sub
    FROM public.subscriptions
    WHERE id = v_invoice.subscription_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'SUBSCRIPTION_NOT_FOUND: Langganan dengan ID % tidak ditemukan.', v_invoice.subscription_id
            USING ERRCODE = 'P0002';
    END IF;

    IF v_sub.org_id <> p_org_id THEN
        RAISE EXCEPTION 'CROSS_TENANT_REJECTION: Langganan tidak dimiliki oleh organisasi yang sama.'
            USING ERRCODE = 'P0003';
    END IF;

    v_prev_sub_status := v_sub.status;

    -- -------------------------------------------------------------------------
    -- Check 14: Overpayment handling
    -- -------------------------------------------------------------------------
    IF p_amount > v_invoice.amount_total THEN
        v_overpayment := p_amount - v_invoice.amount_total;
        v_recon_note := 'Overpayment recorded for reconciliation: Rp ' || v_overpayment;
    ELSE
        v_overpayment := 0;
        v_recon_note := 'Full payment matched invoice amount due.';
    END IF;

    -- -------------------------------------------------------------------------
    -- Calculate renewed subscription period (strictly normal interval, no multiplication)
    -- -------------------------------------------------------------------------
    IF v_sub.current_period_end > v_now THEN
        v_new_period_start := v_sub.current_period_end;
    ELSE
        v_new_period_start := v_now;
    END IF;

    IF v_sub.billing_interval = 'ANNUAL' THEN
        v_new_period_end := v_new_period_start + INTERVAL '1 year';
    ELSE
        v_new_period_end := v_new_period_start + INTERVAL '1 month';
    END IF;

    -- -------------------------------------------------------------------------
    -- STEP 1: Record payment in public.payments
    -- -------------------------------------------------------------------------
    INSERT INTO public.payments (
        id,
        org_id,
        billing_invoice_id,
        provider,
        provider_payment_id,
        amount,
        fee_amount,
        net_amount,
        payment_method,
        status,
        paid_at,
        overpayment_amount,
        reconciliation_notes,
        raw_payload,
        created_at
    ) VALUES (
        pg_catalog.gen_random_uuid(),
        p_org_id,
        p_billing_invoice_id,
        p_provider,
        p_payment_id,
        p_amount,
        0,
        p_amount,
        p_payment_method,
        'SUCCEEDED',
        v_now,
        v_overpayment,
        v_recon_note,
        p_raw_payload,
        v_now
    )
    RETURNING id INTO v_payment_id;

    -- -------------------------------------------------------------------------
    -- STEP 2: Update billing invoice to PAID
    -- -------------------------------------------------------------------------
    UPDATE public.billing_invoices
    SET status = 'PAID',
        paid_at = v_now
    WHERE id = p_billing_invoice_id;

    -- -------------------------------------------------------------------------
    -- STEP 3: Update subscription to ACTIVE and advance period
    -- -------------------------------------------------------------------------
    UPDATE public.subscriptions
    SET status = 'ACTIVE',
        current_period_start = v_new_period_start,
        current_period_end = v_new_period_end,
        grace_period_end = NULL,
        cancel_at_period_end = false,
        updated_at = v_now
    WHERE id = v_sub.id;

    -- -------------------------------------------------------------------------
    -- STEP 4: Synchronize organization status
    -- -------------------------------------------------------------------------
    UPDATE public.organizations
    SET subscription_status = 'ACTIVE',
        subscription_expires_at = v_new_period_end,
        subscription_tier = v_sub.plan_id,
        active_subscription_id = v_sub.id
    WHERE id = p_org_id;

    -- -------------------------------------------------------------------------
    -- STEP 5: Record immutable subscription status audit event
    -- -------------------------------------------------------------------------
    INSERT INTO public.subscription_status_events (
        id,
        subscription_id,
        from_status,
        to_status,
        reason,
        source,
        actor_id,
        correlation_id,
        created_at
    ) VALUES (
        pg_catalog.gen_random_uuid(),
        v_sub.id,
        v_prev_sub_status,
        'ACTIVE',
        'Verified payment recovery via ' || p_provider || ' for invoice ' || v_invoice.invoice_number,
        'WEBHOOK',
        'PROVIDER_' || p_provider,
        p_event_id,
        v_now
    );

    -- -------------------------------------------------------------------------
    -- STEP 6: Close active dunning cycles for this subscription
    -- -------------------------------------------------------------------------
    UPDATE public.dunning_cycles
    SET status = 'RECOVERED',
        stage = 'RECOVERED',
        updated_at = v_now
    WHERE subscription_id = v_sub.id
      AND status = 'ACTIVE';

    -- -------------------------------------------------------------------------
    -- STEP 7: Record webhook event in public.webhook_events
    -- -------------------------------------------------------------------------
    INSERT INTO public.webhook_events (
        id,
        provider,
        event_id,
        event_type,
        raw_payload,
        processing_status,
        retry_count,
        processed_at,
        created_at
    ) VALUES (
        pg_catalog.gen_random_uuid(),
        p_provider,
        p_event_id,
        'PAYMENT_SUCCEEDED',
        p_raw_payload,
        'PROCESSED',
        0,
        v_now,
        v_now
    )
    ON CONFLICT (provider, event_id)
    DO UPDATE SET
        processing_status = 'PROCESSED',
        processed_at = v_now,
        raw_payload = p_raw_payload;

    -- -------------------------------------------------------------------------
    -- STEP 8: Create Entitlement Snapshot
    -- -------------------------------------------------------------------------
    SELECT * INTO v_ent
    FROM public.plan_entitlements
    WHERE plan_id = v_sub.plan_id;

    IF FOUND THEN
        INSERT INTO public.entitlement_snapshots (
            id,
            org_id,
            subscription_id,
            max_active_projects,
            max_users,
            features,
            effective_from,
            effective_until,
            created_at
        ) VALUES (
            pg_catalog.gen_random_uuid(),
            p_org_id,
            v_sub.id,
            v_ent.max_active_projects,
            v_ent.max_users,
            pg_catalog.jsonb_build_object(
                'import', v_ent.import_enabled,
                'gapLedger', v_ent.value_gap_ledger_enabled,
                'readinessGate', v_ent.claim_readiness_enabled,
                'actionQueue', v_ent.action_queue_enabled,
                'roiLedger', v_ent.roi_ledger_enabled
            ),
            v_now,
            v_new_period_end,
            v_now
        );
    END IF;

    -- Return success payload
    RETURN pg_catalog.jsonb_build_object(
        'success', true,
        'payment_id', v_payment_id,
        'subscription_id', v_sub.id,
        'invoice_id', v_invoice.id,
        'invoice_number', v_invoice.invoice_number,
        'previous_status', v_prev_sub_status,
        'new_status', 'ACTIVE',
        'overpayment_recorded', v_overpayment,
        'new_period_end', v_new_period_end
    );
END;
$$;

-- ------------------------------------------------------------------------------
-- 5. FUNCTION PRIVILEGES & SECURITY DEFINER LOCKDOWN
-- ------------------------------------------------------------------------------
REVOKE ALL ON FUNCTION private.process_verified_payment_recovery(
    VARCHAR, VARCHAR, VARCHAR, UUID, UUID, NUMERIC, VARCHAR, VARCHAR, VARCHAR, JSONB
) FROM PUBLIC;

REVOKE ALL ON FUNCTION private.process_verified_payment_recovery(
    VARCHAR, VARCHAR, VARCHAR, UUID, UUID, NUMERIC, VARCHAR, VARCHAR, VARCHAR, JSONB
) FROM anon;

REVOKE ALL ON FUNCTION private.process_verified_payment_recovery(
    VARCHAR, VARCHAR, VARCHAR, UUID, UUID, NUMERIC, VARCHAR, VARCHAR, VARCHAR, JSONB
) FROM authenticated;

GRANT EXECUTE ON FUNCTION private.process_verified_payment_recovery(
    VARCHAR, VARCHAR, VARCHAR, UUID, UUID, NUMERIC, VARCHAR, VARCHAR, VARCHAR, JSONB
) TO service_role;

-- ------------------------------------------------------------------------------
-- 6. PUBLIC SERVICE_ROLE RPC WRAPPERS (FOR POSTGREST SCHEMA CACHE & CLIENT CALLS)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.process_dunning_stage_transition(
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
BEGIN
    RETURN private.process_dunning_stage_transition(
        p_subscription_id, p_target_stage, p_target_status, p_scheduled_at, p_idempotency_key
    );
END;
$$;

REVOKE ALL ON FUNCTION public.process_dunning_stage_transition(UUID, VARCHAR, VARCHAR, TIMESTAMPTZ, VARCHAR) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.process_dunning_stage_transition(UUID, VARCHAR, VARCHAR, TIMESTAMPTZ, VARCHAR) FROM anon;
REVOKE ALL ON FUNCTION public.process_dunning_stage_transition(UUID, VARCHAR, VARCHAR, TIMESTAMPTZ, VARCHAR) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.process_dunning_stage_transition(UUID, VARCHAR, VARCHAR, TIMESTAMPTZ, VARCHAR) TO service_role;

CREATE OR REPLACE FUNCTION public.process_verified_payment_recovery(
    p_provider VARCHAR,
    p_event_id VARCHAR,
    p_payment_id VARCHAR,
    p_billing_invoice_id UUID,
    p_org_id UUID,
    p_amount NUMERIC,
    p_currency VARCHAR,
    p_settlement_status VARCHAR,
    p_payment_method VARCHAR DEFAULT 'GATEWAY_WEBHOOK',
    p_raw_payload JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RETURN private.process_verified_payment_recovery(
        p_provider, p_event_id, p_payment_id, p_billing_invoice_id, p_org_id,
        p_amount, p_currency, p_settlement_status, p_payment_method, p_raw_payload
    );
END;
$$;

REVOKE ALL ON FUNCTION public.process_verified_payment_recovery(VARCHAR, VARCHAR, VARCHAR, UUID, UUID, NUMERIC, VARCHAR, VARCHAR, VARCHAR, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.process_verified_payment_recovery(VARCHAR, VARCHAR, VARCHAR, UUID, UUID, NUMERIC, VARCHAR, VARCHAR, VARCHAR, JSONB) FROM anon;
REVOKE ALL ON FUNCTION public.process_verified_payment_recovery(VARCHAR, VARCHAR, VARCHAR, UUID, UUID, NUMERIC, VARCHAR, VARCHAR, VARCHAR, JSONB) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.process_verified_payment_recovery(VARCHAR, VARCHAR, VARCHAR, UUID, UUID, NUMERIC, VARCHAR, VARCHAR, VARCHAR, JSONB) TO service_role;

