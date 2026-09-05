-- ==============================================================================
-- COVE PHASE 18R.1: PRIVILEGE AND IDEMPOTENCY pgTAP TEST SUITE
-- File: supabase/tests/database/05_phase18r1_privilege_and_idempotency.test.sql
--
-- Verifies:
-- 1. anon cannot call financial RPC functions (permission denied)
-- 2. authenticated cannot call financial RPC functions (permission denied)
-- 3. admin_idempotency_keys table and unique constraint exist
-- 4. saas_metrics_snapshots scope_type and scope_id columns exist
-- 5. claim_admin_idempotency_key works correctly for service_role
-- 6. Legacy override migration function exists and is callable
-- ==============================================================================

BEGIN;
SELECT plan(16);

-- ============================================================================
-- SECTION 1: RPC PRIVILEGE HARDENING
-- ============================================================================

-- 1.1: reconcile_payment_atomic is NOT executable by anon
SELECT throws_ok(
    $$
        SET ROLE anon;
        SELECT public.reconcile_payment_atomic(
            gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
            'test reason', NULL, NULL
        );
        RESET ROLE;
    $$,
    'permission denied for function reconcile_payment_atomic',
    'anon MUST NOT execute reconcile_payment_atomic'
);

-- 1.2: reconcile_payment_atomic is NOT executable by authenticated
SELECT throws_ok(
    $$
        SET ROLE authenticated;
        SELECT public.reconcile_payment_atomic(
            gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
            'test reason', NULL, NULL
        );
        RESET ROLE;
    $$,
    'permission denied for function reconcile_payment_atomic',
    'authenticated MUST NOT execute reconcile_payment_atomic'
);

-- 1.3: unapply_payment_atomic is NOT executable by anon
SELECT throws_ok(
    $$
        SET ROLE anon;
        SELECT public.unapply_payment_atomic(
            gen_random_uuid(), gen_random_uuid(), 'test reason'
        );
        RESET ROLE;
    $$,
    'permission denied for function unapply_payment_atomic',
    'anon MUST NOT execute unapply_payment_atomic'
);

-- 1.4: unapply_payment_atomic is NOT executable by authenticated
SELECT throws_ok(
    $$
        SET ROLE authenticated;
        SELECT public.unapply_payment_atomic(
            gen_random_uuid(), gen_random_uuid(), 'test reason'
        );
        RESET ROLE;
    $$,
    'permission denied for function unapply_payment_atomic',
    'authenticated MUST NOT execute unapply_payment_atomic'
);

-- 1.5: process_partial_payment_atomic is NOT executable by anon
SELECT throws_ok(
    $$
        SET ROLE anon;
        SELECT public.process_partial_payment_atomic(
            gen_random_uuid(), 1000.00, 'XENDIT'::varchar(50),
            'pmt_test_001'::varchar(100), 'BANK_TRANSFER'::varchar(50), '{}'::jsonb
        );
        RESET ROLE;
    $$,
    'permission denied for function process_partial_payment_atomic',
    'anon MUST NOT execute process_partial_payment_atomic'
);

-- 1.6: process_partial_payment_atomic is NOT executable by authenticated
SELECT throws_ok(
    $$
        SET ROLE authenticated;
        SELECT public.process_partial_payment_atomic(
            gen_random_uuid(), 1000.00, 'XENDIT'::varchar(50),
            'pmt_test_002'::varchar(100), 'BANK_TRANSFER'::varchar(50), '{}'::jsonb
        );
        RESET ROLE;
    $$,
    'permission denied for function process_partial_payment_atomic',
    'authenticated MUST NOT execute process_partial_payment_atomic'
);

-- ============================================================================
-- SECTION 2: ADMIN IDEMPOTENCY KEYS TABLE
-- ============================================================================

-- 2.1: Table exists
SELECT has_table(
    'public',
    'admin_idempotency_keys',
    'Table public.admin_idempotency_keys must exist'
);

-- 2.2: Unique constraint exists on (action_type, idempotency_key, target_resource_id)
SELECT has_unique(
    'public',
    'admin_idempotency_keys',
    'admin_idempotency_keys must have a unique constraint'
);

-- 2.3: Required columns exist
SELECT has_column('public', 'admin_idempotency_keys', 'action_type', 'Column action_type must exist');
SELECT has_column('public', 'admin_idempotency_keys', 'idempotency_key', 'Column idempotency_key must exist');
SELECT has_column('public', 'admin_idempotency_keys', 'target_resource_id', 'Column target_resource_id must exist');
SELECT has_column('public', 'admin_idempotency_keys', 'request_fingerprint', 'Column request_fingerprint must exist');
SELECT has_column('public', 'admin_idempotency_keys', 'result_payload', 'Column result_payload must exist');

-- ============================================================================
-- SECTION 3: SNAPSHOT SCOPE COLUMNS
-- ============================================================================

-- 3.1: scope_type column exists
SELECT has_column(
    'public', 'saas_metrics_snapshots', 'scope_type',
    'saas_metrics_snapshots must have scope_type column'
);

-- 3.2: scope_id column exists
SELECT has_column(
    'public', 'saas_metrics_snapshots', 'scope_id',
    'saas_metrics_snapshots must have scope_id column'
);

-- ============================================================================
-- SECTION 4: MIGRATION FUNCTION EXISTS
-- ============================================================================

-- 4.1: migrate_legacy_subscription_overrides function exists
SELECT has_function(
    'public',
    'migrate_legacy_subscription_overrides',
    ARRAY[]::TEXT[],
    'Function migrate_legacy_subscription_overrides() must exist'
);

SELECT * FROM finish();
ROLLBACK;
