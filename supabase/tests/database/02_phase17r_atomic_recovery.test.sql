-- =============================================================================
-- COVE V1 - pgTAP Database Test Suite: Phase 17R
-- 02_phase17r_atomic_recovery.test.sql
-- Verification of Atomic Payment Recovery RPC & 15 Strict Integrity Constraints
-- =============================================================================

BEGIN;
SELECT plan(15);

-- -----------------------------------------------------------------------------
-- SETUP: Fixtures for Phase 17R Testing
-- -----------------------------------------------------------------------------
CREATE TEMPORARY TABLE test_phase17r_vars AS
SELECT
    gen_random_uuid() AS org_id,
    gen_random_uuid() AS org_other_id,
    gen_random_uuid() AS sub_past_due_id,
    gen_random_uuid() AS sub_read_only_id,
    gen_random_uuid() AS sub_suspended_id,
    gen_random_uuid() AS inv_valid_id,
    gen_random_uuid() AS inv_paid_id,
    gen_random_uuid() AS inv_void_id,
    gen_random_uuid() AS claim_construction_id,
    gen_random_uuid() AS user_auth_id;

-- Insert Organizations
INSERT INTO public.organizations (id, name, subscription_status)
SELECT org_id, 'PT Konstruksi Nusantara 17R', 'PAST_DUE' FROM test_phase17r_vars
UNION ALL
SELECT org_other_id, 'PT Pesaing Jahat 17R', 'ACTIVE' FROM test_phase17r_vars;

-- Insert Plans
INSERT INTO public.plans (id, name, tier_level, is_active, is_public)
VALUES
    ('b2b_core', 'COVE Core', 1, true, true),
    ('b2b_scale', 'COVE Scale', 2, true, true),
    ('b2b_enterprise', 'COVE Enterprise', 3, true, true)
ON CONFLICT (id) DO NOTHING;

-- Insert Prices
INSERT INTO public.prices (id, plan_id, currency, amount, billing_interval, effective_from, is_current)
VALUES
    ('price_core_monthly_v1', 'b2b_core', 'IDR', 2500000, 'MONTHLY', NOW(), true),
    ('price_b2b_core_monthly', 'b2b_core', 'IDR', 2500000, 'MONTHLY', NOW(), true)
ON CONFLICT (id) DO NOTHING;

-- Insert Plan Entitlements
INSERT INTO public.plan_entitlements (plan_id, max_active_projects, max_users, export_enabled, import_enabled, value_gap_ledger_enabled, claim_readiness_enabled, action_queue_enabled, roi_ledger_enabled)
VALUES 
    ('b2b_core', 1, 10, true, true, true, true, true, true);

-- Insert Subscriptions (PAST_DUE, READ_ONLY, SUSPENDED)
INSERT INTO public.subscriptions (
    id, org_id, plan_id, price_id, provider, billing_interval, status,
    current_period_start, current_period_end, currency
)
SELECT
    sub_past_due_id, org_id, 'b2b_core', 'price_core_monthly_v1', 'XENDIT', 'MONTHLY', 'PAST_DUE',
    NOW() - INTERVAL '35 days', NOW() - INTERVAL '5 days', 'IDR'
FROM test_phase17r_vars
UNION ALL
SELECT
    sub_read_only_id, org_id, 'b2b_core', 'price_core_monthly_v1', 'XENDIT', 'MONTHLY', 'READ_ONLY',
    NOW() - INTERVAL '40 days', NOW() - INTERVAL '10 days', 'IDR'
FROM test_phase17r_vars
UNION ALL
SELECT
    sub_suspended_id, org_id, 'b2b_core', 'price_core_monthly_v1', 'XENDIT', 'MONTHLY', 'SUSPENDED',
    NOW() - INTERVAL '55 days', NOW() - INTERVAL '25 days', 'IDR'
FROM test_phase17r_vars;

-- Insert Active Dunning Cycles for PAST_DUE subscription
INSERT INTO public.dunning_cycles (
    id, org_id, subscription_id, status, stage, scheduled_at, idempotency_key
)
SELECT
    gen_random_uuid(), org_id, sub_past_due_id, 'ACTIVE', 'H_PLUS_1', NOW(), 'dunning_cycle_seed_17r'
FROM test_phase17r_vars;

-- Insert Billing Invoices
INSERT INTO public.billing_invoices (
    id, org_id, subscription_id, invoice_number, amount_subtotal, amount_total, currency, status, due_date
)
SELECT
    inv_valid_id, org_id, sub_past_due_id, 'INV-COVE-2026-09-001', 2500000, 2500000, 'IDR', 'PENDING', NOW() - INTERVAL '5 days'
FROM test_phase17r_vars
UNION ALL
SELECT
    inv_paid_id, org_id, sub_past_due_id, 'INV-COVE-2026-09-002', 2500000, 2500000, 'IDR', 'PAID', NOW() - INTERVAL '35 days'
FROM test_phase17r_vars
UNION ALL
SELECT
    inv_void_id, org_id, sub_past_due_id, 'INV-COVE-2026-09-003', 2500000, 2500000, 'IDR', 'VOID', NOW() - INTERVAL '10 days'
FROM test_phase17r_vars;

-- Insert Construction Project and Claim (Physical construction progress invoice)
INSERT INTO public.projects (id, organization_id, project_code, project_name)
SELECT gen_random_uuid(), org_id, 'PRJ-17R', 'Proyek Tol 17R' FROM test_phase17r_vars;

INSERT INTO public.claims (
    id, organization_id, project_id, claim_number, period_start, period_end,
    claimed_value, certified_value, current_stage
)
SELECT
    claim_construction_id, org_id, (SELECT id FROM public.projects WHERE project_code = 'PRJ-17R'), 'CLM-CONST-001', CURRENT_DATE - 30, CURRENT_DATE,
    150000000, 150000000, 'CERTIFIED'
FROM test_phase17r_vars;

-- -----------------------------------------------------------------------------
-- TEST 1: Atomic Recovery from PAST_DUE -> ACTIVE
-- -----------------------------------------------------------------------------
DO $$
DECLARE
    v_vars RECORD;
    v_res JSONB;
BEGIN
    SELECT * INTO v_vars FROM test_phase17r_vars;
    v_res := private.process_verified_payment_recovery(
        'XENDIT',
        'evt_valid_recovery_001',
        'pay_xendit_rec_001',
        v_vars.inv_valid_id,
        v_vars.org_id,
        2500000,
        'IDR',
        'SETTLED',
        'BANK_TRANSFER'
    );
    IF (v_res->>'success')::boolean IS NOT TRUE THEN
        RAISE EXCEPTION 'TEST 1 FAILED: %', v_res;
    END IF;
END $$;

SELECT is(
    (SELECT status FROM public.subscriptions WHERE id = (SELECT sub_past_due_id FROM test_phase17r_vars)),
    'ACTIVE',
    'Test 1: Atomic payment recovery successfully transitions subscription from PAST_DUE to ACTIVE'
);

-- -----------------------------------------------------------------------------
-- TEST 2: Invoice status updated to PAID atomically
-- -----------------------------------------------------------------------------
SELECT is(
    (SELECT status FROM public.billing_invoices WHERE id = (SELECT inv_valid_id FROM test_phase17r_vars)),
    'PAID',
    'Test 2: Billing invoice status updated to PAID in same atomic transaction'
);

-- -----------------------------------------------------------------------------
-- TEST 3: Dunning Cycle closed to RECOVERED atomically
-- -----------------------------------------------------------------------------
SELECT is(
    (SELECT status FROM public.dunning_cycles WHERE subscription_id = (SELECT sub_past_due_id FROM test_phase17r_vars)),
    'RECOVERED',
    'Test 3: Active dunning cycle transitioned to RECOVERED atomically'
);

-- -----------------------------------------------------------------------------
-- TEST 4: Subscription status audit event recorded
-- -----------------------------------------------------------------------------
SELECT is(
    (SELECT count(*)::int FROM public.subscription_status_events WHERE subscription_id = (SELECT sub_past_due_id FROM test_phase17r_vars) AND to_status = 'ACTIVE'),
    1,
    'Test 4: Forensically recorded subscription status transition event in same transaction'
);

-- -----------------------------------------------------------------------------
-- TEST 5: Idempotency - Replaying processed webhook returns success without re-mutation
-- -----------------------------------------------------------------------------
SELECT is(
    (SELECT (private.process_verified_payment_recovery(
        'XENDIT',
        'evt_valid_recovery_001',
        'pay_xendit_rec_001',
        (SELECT inv_valid_id FROM test_phase17r_vars),
        (SELECT org_id FROM test_phase17r_vars),
        2500000,
        'IDR',
        'SETTLED'
    )->>'idempotent_replay')::boolean),
    true,
    'Test 5: Replayed webhook event detected as idempotent replay without duplicate mutation'
);

-- -----------------------------------------------------------------------------
-- TEST 6: Duplicate payment ID returns idempotent replay
-- -----------------------------------------------------------------------------
SELECT is(
    (SELECT (private.process_verified_payment_recovery(
        'XENDIT',
        'evt_different_id_002',
        'pay_xendit_rec_001',
        (SELECT inv_valid_id FROM test_phase17r_vars),
        (SELECT org_id FROM test_phase17r_vars),
        2500000,
        'IDR',
        'SETTLED'
    )->>'idempotent_replay')::boolean),
    true,
    'Test 6: Existing provider payment ID detected and safely idempotently handled'
);

-- -----------------------------------------------------------------------------
-- TEST 7: Negative Check - Partial payment rejected (amount < amount_due)
-- -----------------------------------------------------------------------------
-- Create new pending invoice for testing
DO $$
DECLARE
    v_vars RECORD;
    v_new_inv_id UUID := gen_random_uuid();
BEGIN
    SELECT * INTO v_vars FROM test_phase17r_vars;
    INSERT INTO public.billing_invoices (id, org_id, subscription_id, invoice_number, amount_subtotal, amount_total, currency, status, due_date)
    VALUES (v_new_inv_id, v_vars.org_id, v_vars.sub_read_only_id, 'INV-PARTIAL-TEST', 2500000, 2500000, 'IDR', 'PENDING', NOW() - INTERVAL '10 days');
END $$;

SELECT throws_ok(
    format(
        'SELECT private.process_verified_payment_recovery(''XENDIT'', ''evt_part_01'', ''pay_part_01'', %L::uuid, %L::uuid, 1000000, ''IDR'', ''SETTLED'')',
        (SELECT id FROM public.billing_invoices WHERE invoice_number = 'INV-PARTIAL-TEST'),
        (SELECT org_id FROM test_phase17r_vars)
    ),
    'P0009',
    NULL,
    'Test 7: Partial payment (amount < amount_due) throws PARTIAL_PAYMENT_REJECTED (P0009)'
);

-- Verify status of sub_read_only was NOT mutated
SELECT is(
    (SELECT status FROM public.subscriptions WHERE id = (SELECT sub_read_only_id FROM test_phase17r_vars)),
    'READ_ONLY',
    'Test 8: Subscription status strictly unchanged after partial payment rejection'
);

-- -----------------------------------------------------------------------------
-- TEST 9: Negative Check - Cross-tenant payment rejected
-- -----------------------------------------------------------------------------
SELECT throws_ok(
    format(
        'SELECT private.process_verified_payment_recovery(''XENDIT'', ''evt_cross_01'', ''pay_cross_01'', %L::uuid, %L::uuid, 2500000, ''IDR'', ''SETTLED'')',
        (SELECT id FROM public.billing_invoices WHERE invoice_number = 'INV-PARTIAL-TEST'),
        (SELECT org_other_id FROM test_phase17r_vars)
    ),
    'P0003',
    NULL,
    'Test 9: Cross-tenant payment attempt throws CROSS_TENANT_REJECTION (P0003)'
);

-- -----------------------------------------------------------------------------
-- TEST 10: Negative Check - Construction claim rejected (not billing invoice)
-- -----------------------------------------------------------------------------
SELECT throws_ok(
    format(
        'SELECT private.process_verified_payment_recovery(''XENDIT'', ''evt_const_01'', ''pay_const_01'', %L::uuid, %L::uuid, 150000000, ''IDR'', ''SETTLED'')',
        (SELECT claim_construction_id FROM test_phase17r_vars),
        (SELECT org_id FROM test_phase17r_vars)
    ),
    'P0004',
    NULL,
    'Test 10: Construction claim ID passed as billing invoice throws CONSTRUCTION_INVOICE_REJECTION (P0004)'
);

-- -----------------------------------------------------------------------------
-- TEST 11: Negative Check - Stale payment (already PAID invoice) rejected
-- -----------------------------------------------------------------------------
SELECT throws_ok(
    format(
        'SELECT private.process_verified_payment_recovery(''XENDIT'', ''evt_stale_01'', ''pay_stale_01'', %L::uuid, %L::uuid, 2500000, ''IDR'', ''SETTLED'')',
        (SELECT inv_paid_id FROM test_phase17r_vars),
        (SELECT org_id FROM test_phase17r_vars)
    ),
    'P0006',
    NULL,
    'Test 11: Stale payment targeting already PAID invoice throws STALE_PAYMENT_REJECTION (P0006)'
);

-- -----------------------------------------------------------------------------
-- TEST 12: Negative Check - Currency mismatch rejected
-- -----------------------------------------------------------------------------
SELECT throws_ok(
    format(
        'SELECT private.process_verified_payment_recovery(''XENDIT'', ''evt_curr_01'', ''pay_curr_01'', %L::uuid, %L::uuid, 2500000, ''USD'', ''SETTLED'')',
        (SELECT id FROM public.billing_invoices WHERE invoice_number = 'INV-PARTIAL-TEST'),
        (SELECT org_id FROM test_phase17r_vars)
    ),
    'P0007',
    NULL,
    'Test 12: Currency mismatch (USD vs IDR) throws CURRENCY_MISMATCH (P0007)'
);

-- -----------------------------------------------------------------------------
-- TEST 13: Negative Check - Unsettled gateway status rejected
-- -----------------------------------------------------------------------------
SELECT throws_ok(
    format(
        'SELECT private.process_verified_payment_recovery(''XENDIT'', ''evt_pending_01'', ''pay_pending_01'', %L::uuid, %L::uuid, 2500000, ''IDR'', ''PENDING'')',
        (SELECT id FROM public.billing_invoices WHERE invoice_number = 'INV-PARTIAL-TEST'),
        (SELECT org_id FROM test_phase17r_vars)
    ),
    'P0008',
    NULL,
    'Test 13: Unsettled gateway status (PENDING) throws UNSETTLED_PAYMENT (P0008)'
);

-- -----------------------------------------------------------------------------
-- TEST 14: Overpayment recorded for reconciliation without multiplying period
-- -----------------------------------------------------------------------------
DO $$
DECLARE
    v_vars RECORD;
    v_res JSONB;
    v_inv_id UUID := gen_random_uuid();
BEGIN
    SELECT * INTO v_vars FROM test_phase17r_vars;
    INSERT INTO public.billing_invoices (id, org_id, subscription_id, invoice_number, amount_subtotal, amount_total, currency, status, due_date)
    VALUES (v_inv_id, v_vars.org_id, v_vars.sub_suspended_id, 'INV-OVERPAY-TEST', 2500000, 2500000, 'IDR', 'PENDING', NOW() - INTERVAL '25 days');

    -- Pay Rp 3.000.000 (Rp 500.000 overpayment)
    v_res := private.process_verified_payment_recovery(
        'XENDIT',
        'evt_overpay_001',
        'pay_overpay_001',
        v_inv_id,
        v_vars.org_id,
        3000000,
        'IDR',
        'SETTLED'
    );
END $$;

SELECT is(
    (SELECT overpayment_amount FROM public.payments WHERE provider_payment_id = 'pay_overpay_001'),
    500000.00,
    'Test 14: Overpayment of Rp 500.000 is recorded explicitly for reconciliation in payments table'
);

-- -----------------------------------------------------------------------------
-- TEST 15: Security lockdown: anon and authenticated cannot execute private RPC
-- -----------------------------------------------------------------------------
SELECT throws_ok(
    'SET ROLE anon; SELECT private.process_verified_payment_recovery(''XENDIT'', ''a'', ''b'', gen_random_uuid(), gen_random_uuid(), 100, ''IDR'', ''SETTLED'');',
    '42501',
    NULL,
    'Test 15: Anon role cannot execute private.process_verified_payment_recovery (42501 permission denied)'
);

SELECT * FROM finish();
ROLLBACK;
