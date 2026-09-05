BEGIN;
SELECT plan(8);

-- 1. Verify that atomic procedures exist
SELECT has_function('public', 'reconcile_payment_atomic', 'Function reconcile_payment_atomic exists');
SELECT has_function('public', 'unapply_payment_atomic', 'Function unapply_payment_atomic exists');
SELECT has_function('public', 'process_partial_payment_atomic', 'Function process_partial_payment_atomic exists');

-- 2. Verify append-only immutability of admin_audit_logs
CREATE TEMP TABLE tmp_test_ids (admin_id UUID, log_id UUID);

DO $$
DECLARE
    v_auth_id UUID := gen_random_uuid();
    v_admin_id UUID := gen_random_uuid();
    v_log_id UUID := gen_random_uuid();
BEGIN
    -- Create test auth user
    INSERT INTO auth.users (id, email)
    VALUES (v_auth_id, 'test_audit_admin@cove.id');

    -- Create test platform admin
    INSERT INTO public.platform_admins (id, auth_user_id, notes)
    VALUES (v_admin_id, v_auth_id, 'Official Audit Tester');

    -- Insert an audit log row
    INSERT INTO public.admin_audit_logs (
        id, admin_id, action, target_entity, target_id, reason
    ) VALUES (
        v_log_id, v_admin_id, 'TEST_ACTION', 'TEST_ENTITY', 'target-1', 'Initial test log'
    );

    INSERT INTO tmp_test_ids VALUES (v_admin_id, v_log_id);
END;
$$;

-- 3. Verify UPDATE on admin_audit_logs raises P0001
SELECT throws_ok(
    $$
    UPDATE public.admin_audit_logs
    SET reason = 'Tampered reason'
    WHERE id = (SELECT log_id FROM tmp_test_ids LIMIT 1)
    $$,
    'P0001',
    'CANNOT_MODIFY_AUDIT_LOG: Admin audit logs are append-only and cannot be updated or deleted.',
    'UPDATE on admin_audit_logs is strictly rejected with P0001'
);

-- 4. Verify DELETE on admin_audit_logs raises P0001
SELECT throws_ok(
    $$
    DELETE FROM public.admin_audit_logs
    WHERE id = (SELECT log_id FROM tmp_test_ids LIMIT 1)
    $$,
    'P0001',
    'CANNOT_MODIFY_AUDIT_LOG: Admin audit logs are append-only and cannot be updated or deleted.',
    'DELETE on admin_audit_logs is strictly rejected with P0001'
);

-- 5. Verify partial unique index on manual_subscription_overrides prevents duplicate active override
CREATE TEMP TABLE tmp_sub_test (sub_id UUID, org_id UUID);

DO $$
DECLARE
    v_sub_id UUID := gen_random_uuid();
    v_org_id UUID := gen_random_uuid();
    v_admin_id UUID;
BEGIN
    SELECT admin_id INTO v_admin_id FROM tmp_test_ids LIMIT 1;

    -- Create dummy plan, price, org and subscription for foreign keys
    INSERT INTO public.plans (id, name, tier_level, is_active, is_public)
    VALUES ('b2b_core', 'COVE Core', 1, true, true)
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.prices (id, plan_id, currency, amount, billing_interval)
    VALUES ('price_core_monthly_v1', 'b2b_core', 'IDR', 2500000, 'MONTHLY')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.organizations (id, name)
    VALUES (v_org_id, 'Test Org Overrides')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.subscriptions (
        id, org_id, plan_id, price_id, provider, billing_interval, status,
        current_period_start, current_period_end
    ) VALUES (
        v_sub_id, v_org_id, 'b2b_core', 'price_core_monthly_v1', 'XENDIT', 'MONTHLY', 'ACTIVE',
        now(), now() + interval '1 month'
    ) ON CONFLICT (id) DO NOTHING;

    -- First active override
    INSERT INTO public.manual_subscription_overrides (
        subscription_id, org_id, override_type, previous_value, new_value, reason, admin_id, expires_at, is_revoked
    ) VALUES (
        v_sub_id, v_org_id, 'STATUS_OVERRIDE', '{}', '{"status":"ACTIVE"}', 'Active override 1', v_admin_id, now() + interval '7 days', false
    );

    INSERT INTO tmp_sub_test VALUES (v_sub_id, v_org_id);
END;
$$;

SELECT throws_ok(
    $$
    INSERT INTO public.manual_subscription_overrides (
        subscription_id, org_id, override_type, previous_value, new_value, reason, admin_id, expires_at, is_revoked
    ) VALUES (
        (SELECT sub_id FROM tmp_sub_test LIMIT 1),
        (SELECT org_id FROM tmp_sub_test LIMIT 1),
        'STATUS_OVERRIDE',
        '{}',
        '{"status":"ACTIVE"}',
        'Conflicting duplicate active override',
        (SELECT admin_id FROM tmp_test_ids LIMIT 1),
        now() + interval '10 days',
        false
    )
    $$,
    '23505',
    NULL,
    'Duplicate active override of same type on same subscription is rejected by unique index'
);

-- 6. Verify unique snapshot per period, date, formula, and currency
DO $$
BEGIN
    INSERT INTO public.saas_metrics_snapshots (
        period_type, snapshot_date, formula_version, currency, mrr, arr
    ) VALUES (
        'DAILY', '2026-09-01', 'v1.0', 'IDR', 1000000, 12000000
    );
END;
$$;

SELECT throws_ok(
    $$
    INSERT INTO public.saas_metrics_snapshots (
        period_type, snapshot_date, formula_version, currency, mrr, arr
    ) VALUES (
        'DAILY', '2026-09-01', 'v1.0', 'IDR', 2000000, 24000000
    )
    $$,
    '23505',
    NULL,
    'Duplicate snapshot on same date, period, formula, and currency is rejected'
);

-- 7. Verify table comments on deprecated subscription_overrides
SELECT has_table('public', 'subscription_overrides', 'Table subscription_overrides exists (deprecated)');

SELECT * FROM finish();
ROLLBACK;
