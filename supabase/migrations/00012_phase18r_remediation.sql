-- ==============================================================================
-- COVE PHASE 18R: ADMIN BILLING INTEGRITY AND COMPLETENESS REMEDIATION
-- Migration: 00012_phase18r_remediation.sql
-- 
-- 1. Canonical source of truth: manual_subscription_overrides
-- 2. Deprecate legacy subscription_overrides table
-- 3. Enforce append-only immutability on admin_audit_logs via trigger (SQLSTATE P0001)
-- 4. Atomic PostgreSQL stored procedures with row-level locking (FOR UPDATE):
--    - reconcile_payment_atomic
--    - unapply_payment_atomic
--    - process_partial_payment_atomic
-- 5. Scope & currency uniqueness constraint on saas_metrics_snapshots
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. DEPRECATE HISTORICAL OVERRIDES TABLE & SET SINGLE SOURCE OF TRUTH
-- ------------------------------------------------------------------------------
COMMENT ON TABLE public.subscription_overrides IS 'DEPRECATED in Phase 18R: Use manual_subscription_overrides as the single canonical source of truth for all runtime entitlements and administrative overrides.';

-- Partial unique index to guarantee no duplicate active overrides of the same type
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_manual_override_per_type
    ON public.manual_subscription_overrides (subscription_id, override_type)
    WHERE (is_revoked = false);

-- Add updated_at to billing_invoices for consistent audit tracking
ALTER TABLE public.billing_invoices
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ------------------------------------------------------------------------------
-- 2. DATABASE TRIGGER: APPEND-ONLY IMMUTABILITY FOR admin_audit_logs
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_admin_audit_logs_reject_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RAISE EXCEPTION 'CANNOT_MODIFY_AUDIT_LOG: Admin audit logs are append-only and cannot be updated or deleted.'
        USING ERRCODE = 'P0001';
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_admin_audit_logs_immutable ON public.admin_audit_logs;
CREATE TRIGGER trg_admin_audit_logs_immutable
    BEFORE UPDATE OR DELETE ON public.admin_audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_admin_audit_logs_reject_mutation();

-- ------------------------------------------------------------------------------
-- 3. ENFORCE UNIQUE METRICS SNAPSHOT PER PERIOD, DATE, FORMULA & CURRENCY
-- ------------------------------------------------------------------------------
ALTER TABLE public.saas_metrics_snapshots
    DROP CONSTRAINT IF EXISTS uq_saas_metrics_snapshot;

ALTER TABLE public.saas_metrics_snapshots
    ADD CONSTRAINT uq_saas_metrics_snapshot
    UNIQUE (period_type, snapshot_date, formula_version, currency);

-- ------------------------------------------------------------------------------
-- 4. ATOMIC RECONCILIATION ENGINE PROCEDURES (ROW LOCKING VIA FOR UPDATE)
-- ------------------------------------------------------------------------------

-- Procedure A: reconcile_payment_atomic
CREATE OR REPLACE FUNCTION public.reconcile_payment_atomic(
    p_reconciliation_id UUID,
    p_target_invoice_id UUID,
    p_admin_id UUID,
    p_reason TEXT,
    p_apply_amount NUMERIC DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_rec RECORD;
    v_inv RECORD;
    v_sub RECORD;
    v_apply_amt NUMERIC;
    v_new_status VARCHAR(50);
    v_new_unapplied NUMERIC;
    v_new_applied NUMERIC;
    v_total_paid NUMERIC;
    v_invoice_settled BOOLEAN := FALSE;
    v_sub_reactivated BOOLEAN := FALSE;
    v_audit_id UUID;
BEGIN
    IF p_reason IS NULL OR LENGTH(TRIM(p_reason)) < 5 THEN
        RAISE EXCEPTION 'REASON_REQUIRED: Reconciliation requires a valid reason (min 5 characters)'
            USING ERRCODE = 'P0002';
    END IF;

    -- 1. Lock reconciliation queue item
    SELECT * INTO v_rec
    FROM public.reconciliation_queue
    WHERE id = p_reconciliation_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'RECONCILIATION_ITEM_NOT_FOUND: Item % not found', p_reconciliation_id
            USING ERRCODE = 'P0003';
    END IF;

    IF v_rec.status IN ('RESOLVED', 'REFUNDED') THEN
        RAISE EXCEPTION 'ITEM_ALREADY_RESOLVED: Item is already in terminal status %', v_rec.status
            USING ERRCODE = 'P0004';
    END IF;

    -- 2. Lock invoice row
    SELECT * INTO v_inv
    FROM public.billing_invoices
    WHERE id = p_target_invoice_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'INVOICE_NOT_FOUND: Invoice % not found', p_target_invoice_id
            USING ERRCODE = 'P0005';
    END IF;

    -- 3. Determine amount to apply
    v_apply_amt := COALESCE(p_apply_amount, v_rec.unapplied_amount);
    IF v_apply_amt <= 0 OR v_apply_amt > v_rec.unapplied_amount THEN
        RAISE EXCEPTION 'INVALID_APPLY_AMOUNT: Requested amount % exceeds unapplied %', v_apply_amt, v_rec.unapplied_amount
            USING ERRCODE = 'P0006';
    END IF;

    v_new_applied := v_rec.applied_amount + v_apply_amt;
    v_new_unapplied := v_rec.unapplied_amount - v_apply_amt;

    IF v_new_unapplied = 0 THEN
        v_new_status := 'RESOLVED';
    ELSE
        v_new_status := 'PARTIALLY_APPLIED';
    END IF;

    -- Update reconciliation queue item
    UPDATE public.reconciliation_queue
    SET status = v_new_status,
        billing_invoice_id = p_target_invoice_id,
        org_id = v_inv.org_id,
        applied_amount = v_new_applied,
        unapplied_amount = v_new_unapplied,
        resolved_by = p_admin_id,
        resolved_at = CASE WHEN v_new_status = 'RESOLVED' THEN pg_catalog.clock_timestamp() ELSE resolved_at END,
        notes = COALESCE(p_notes, notes),
        updated_at = pg_catalog.clock_timestamp()
    WHERE id = p_reconciliation_id;

    -- Calculate total paid on target invoice
    SELECT COALESCE(SUM(amount), 0) + v_new_applied INTO v_total_paid
    FROM public.payments
    WHERE billing_invoice_id = p_target_invoice_id
      AND status IN ('SUCCEEDED', 'SETTLED');

    -- Settle invoice if threshold reached
    IF v_total_paid >= v_inv.amount_total AND v_inv.status != 'PAID' THEN
        UPDATE public.billing_invoices
        SET status = 'PAID',
            paid_at = pg_catalog.clock_timestamp(),
            updated_at = pg_catalog.clock_timestamp()
        WHERE id = p_target_invoice_id;
        v_invoice_settled := TRUE;

        -- Check subscription and reactivate if in grace / past_due / read_only
        IF v_inv.subscription_id IS NOT NULL THEN
            SELECT * INTO v_sub
            FROM public.subscriptions
            WHERE id = v_inv.subscription_id
            FOR UPDATE;

            IF v_sub.status IN ('PAST_DUE', 'READ_ONLY', 'SUSPENDED', 'PENDING_PAYMENT') THEN
                UPDATE public.subscriptions
                SET status = 'ACTIVE',
                    grace_period_end = NULL,
                    updated_at = pg_catalog.clock_timestamp()
                WHERE id = v_inv.subscription_id;

                UPDATE public.organizations
                SET subscription_status = 'ACTIVE',
                    updated_at = pg_catalog.clock_timestamp()
                WHERE id = v_inv.org_id;

                v_sub_reactivated := TRUE;
            END IF;
        END IF;
    END IF;

    -- Insert into admin_audit_logs
    INSERT INTO public.admin_audit_logs (
        admin_id, action, target_entity, target_id, org_id, reason,
        before_state, after_state
    ) VALUES (
        p_admin_id, 'RECONCILE_PAYMENT', 'RECONCILIATION_ITEM', p_reconciliation_id::text, v_inv.org_id, p_reason,
        pg_catalog.jsonb_build_object('status', v_rec.status, 'unapplied_amount', v_rec.unapplied_amount, 'applied_amount', v_rec.applied_amount),
        pg_catalog.jsonb_build_object('status', v_new_status, 'unapplied_amount', v_new_unapplied, 'applied_amount', v_new_applied, 'invoice_settled', v_invoice_settled, 'subscription_reactivated', v_sub_reactivated)
    ) RETURNING id INTO v_audit_id;

    RETURN pg_catalog.jsonb_build_object(
        'success', true,
        'reconciliation_id', p_reconciliation_id,
        'status', v_new_status,
        'applied_amount', v_apply_amt,
        'remaining_unapplied_amount', v_new_unapplied,
        'invoice_settled', v_invoice_settled,
        'subscription_reactivated', v_sub_reactivated,
        'audit_log_id', v_audit_id
    );
END;
$$;

-- Procedure B: unapply_payment_atomic
CREATE OR REPLACE FUNCTION public.unapply_payment_atomic(
    p_reconciliation_id UUID,
    p_admin_id UUID,
    p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_rec RECORD;
    v_inv RECORD;
    v_audit_id UUID;
    v_total_paid NUMERIC;
    v_invoice_reverted BOOLEAN := FALSE;
BEGIN
    IF p_reason IS NULL OR LENGTH(TRIM(p_reason)) < 5 THEN
        RAISE EXCEPTION 'REASON_REQUIRED: Unapply requires a valid reason (min 5 characters)'
            USING ERRCODE = 'P0002';
    END IF;

    SELECT * INTO v_rec
    FROM public.reconciliation_queue
    WHERE id = p_reconciliation_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'RECONCILIATION_ITEM_NOT_FOUND: Item not found'
            USING ERRCODE = 'P0003';
    END IF;

    IF v_rec.applied_amount <= 0 THEN
        RAISE EXCEPTION 'ITEM_NOT_APPLIED: Item has no applied amount to unapply'
            USING ERRCODE = 'P0007';
    END IF;

    -- Lock target invoice if linked
    IF v_rec.billing_invoice_id IS NOT NULL THEN
        SELECT * INTO v_inv
        FROM public.billing_invoices
        WHERE id = v_rec.billing_invoice_id
        FOR UPDATE;

        IF FOUND THEN
            -- Check if unapplying leaves invoice below amount_total
            SELECT COALESCE(SUM(amount), 0) INTO v_total_paid
            FROM public.payments
            WHERE billing_invoice_id = v_rec.billing_invoice_id
              AND status IN ('SUCCEEDED', 'SETTLED');

            IF v_total_paid < v_inv.amount_total AND v_inv.status = 'PAID' THEN
                UPDATE public.billing_invoices
                SET status = 'PENDING',
                    paid_at = NULL,
                    updated_at = pg_catalog.clock_timestamp()
                WHERE id = v_rec.billing_invoice_id;
                v_invoice_reverted := TRUE;
            END IF;
        END IF;
    END IF;

    -- Update reconciliation queue
    UPDATE public.reconciliation_queue
    SET status = 'UNAPPLIED',
        unapplied_amount = v_rec.amount,
        applied_amount = 0,
        resolved_by = NULL,
        resolved_at = NULL,
        updated_at = pg_catalog.clock_timestamp()
    WHERE id = p_reconciliation_id;

    -- Insert audit log
    INSERT INTO public.admin_audit_logs (
        admin_id, action, target_entity, target_id, org_id, reason,
        before_state, after_state
    ) VALUES (
        p_admin_id, 'UNAPPLY_PAYMENT', 'RECONCILIATION_ITEM', p_reconciliation_id::text, v_rec.org_id, p_reason,
        pg_catalog.jsonb_build_object('status', v_rec.status, 'applied_amount', v_rec.applied_amount, 'unapplied_amount', v_rec.unapplied_amount),
        pg_catalog.jsonb_build_object('status', 'UNAPPLIED', 'applied_amount', 0, 'unapplied_amount', v_rec.amount, 'invoice_reverted', v_invoice_reverted)
    ) RETURNING id INTO v_audit_id;

    RETURN pg_catalog.jsonb_build_object(
        'success', true,
        'reconciliation_id', p_reconciliation_id,
        'status', 'UNAPPLIED',
        'unapplied_amount', v_rec.amount,
        'invoice_reverted', v_invoice_reverted,
        'audit_log_id', v_audit_id
    );
END;
$$;

-- Procedure C: process_partial_payment_atomic
CREATE OR REPLACE FUNCTION public.process_partial_payment_atomic(
    p_invoice_id UUID,
    p_payment_amount NUMERIC,
    p_provider VARCHAR(50),
    p_provider_payment_id VARCHAR(100),
    p_payment_method VARCHAR(50) DEFAULT 'BANK_TRANSFER',
    p_payment_details JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_inv RECORD;
    v_sub RECORD;
    v_payment_id UUID;
    v_rec_id UUID;
    v_total_paid NUMERIC;
    v_overpayment NUMERIC := 0;
    v_invoice_settled BOOLEAN := FALSE;
    v_sub_reactivated BOOLEAN := FALSE;
    v_rec_status VARCHAR(50);
BEGIN
    IF p_payment_amount <= 0 THEN
        RAISE EXCEPTION 'INVALID_AMOUNT: Payment amount must be positive'
            USING ERRCODE = 'P0008';
    END IF;

    -- 1. Lock invoice
    SELECT * INTO v_inv
    FROM public.billing_invoices
    WHERE id = p_invoice_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'INVOICE_NOT_FOUND: Invoice % not found', p_invoice_id
            USING ERRCODE = 'P0005';
    END IF;

    -- 2. Insert payment record
    INSERT INTO public.payments (
        billing_invoice_id, org_id, amount, status,
        provider, provider_payment_id, payment_method,
        net_amount, paid_at
    ) VALUES (
        p_invoice_id, v_inv.org_id, p_payment_amount, 'SUCCEEDED',
        p_provider, p_provider_payment_id, p_payment_method,
        p_payment_amount, pg_catalog.clock_timestamp()
    ) RETURNING id INTO v_payment_id;

    -- 3. Calculate cumulative paid amount on this invoice
    SELECT COALESCE(SUM(amount), 0) INTO v_total_paid
    FROM public.payments
    WHERE billing_invoice_id = p_invoice_id
      AND status IN ('SUCCEEDED', 'SETTLED');

    -- Check if total paid reaches or exceeds amount_total
    IF v_total_paid >= v_inv.amount_total THEN
        IF v_inv.status != 'PAID' THEN
            UPDATE public.billing_invoices
            SET status = 'PAID',
                paid_at = pg_catalog.clock_timestamp(),
                updated_at = pg_catalog.clock_timestamp()
            WHERE id = p_invoice_id;
            v_invoice_settled := TRUE;

            -- Restore subscription if needed
            IF v_inv.subscription_id IS NOT NULL THEN
                SELECT * INTO v_sub
                FROM public.subscriptions
                WHERE id = v_inv.subscription_id
                FOR UPDATE;

                IF v_sub.status IN ('PAST_DUE', 'READ_ONLY', 'SUSPENDED', 'PENDING_PAYMENT') THEN
                    UPDATE public.subscriptions
                    SET status = 'ACTIVE',
                        grace_period_end = NULL,
                        updated_at = pg_catalog.clock_timestamp()
                    WHERE id = v_inv.subscription_id;

                    UPDATE public.organizations
                    SET subscription_status = 'ACTIVE',
                        updated_at = pg_catalog.clock_timestamp()
                    WHERE id = v_inv.org_id;

                    v_sub_reactivated := TRUE;
                END IF;
            END IF;
        END IF;

        -- Check overpayment
        IF v_total_paid > v_inv.amount_total THEN
            v_overpayment := v_total_paid - v_inv.amount_total;
            -- Record overpayment in reconciliation queue
            INSERT INTO public.reconciliation_queue (
                payment_id, billing_invoice_id, org_id, status,
                amount, unapplied_amount, applied_amount, reason
            ) VALUES (
                v_payment_id, p_invoice_id, v_inv.org_id, 'OVERPAYMENT',
                v_overpayment, v_overpayment, 0,
                'Payment excess over invoice amount_total'
            ) RETURNING id INTO v_rec_id;
        END IF;
    ELSE
        -- Total paid is still less than amount_total -> record in reconciliation_queue as PARTIALLY_APPLIED
        v_rec_status := 'PARTIALLY_APPLIED';
        INSERT INTO public.reconciliation_queue (
            payment_id, billing_invoice_id, org_id, status,
            amount, unapplied_amount, applied_amount, reason
        ) VALUES (
            v_payment_id, p_invoice_id, v_inv.org_id, v_rec_status,
            p_payment_amount, 0, p_payment_amount,
            'Partial payment received - remaining amount due: ' || (v_inv.amount_total - v_total_paid)::text
        ) RETURNING id INTO v_rec_id;
    END IF;

    RETURN pg_catalog.jsonb_build_object(
        'success', true,
        'payment_id', v_payment_id,
        'total_paid', v_total_paid,
        'amount_total', v_inv.amount_total,
        'invoice_settled', v_invoice_settled,
        'subscription_reactivated', v_sub_reactivated,
        'overpayment_amount', v_overpayment,
        'reconciliation_id', v_rec_id
    );
END;
$$;

-- ------------------------------------------------------------------------------
-- 5. FUNCTION PERMISSIONS (SERVICE_ROLE ONLY)
-- ------------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.reconcile_payment_atomic FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reconcile_payment_atomic TO service_role;

REVOKE ALL ON FUNCTION public.unapply_payment_atomic FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unapply_payment_atomic TO service_role;

REVOKE ALL ON FUNCTION public.process_partial_payment_atomic FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.process_partial_payment_atomic TO service_role;
