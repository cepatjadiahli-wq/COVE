BEGIN;
SELECT plan(16);

-- 1. Verify that new Phase 18 tables exist
SELECT has_table('public', 'reconciliation_queue', 'Table reconciliation_queue exists');
SELECT has_table('public', 'payment_refunds', 'Table payment_refunds exists');
SELECT has_table('public', 'provider_configurations', 'Table provider_configurations exists');
SELECT has_table('public', 'manual_subscription_overrides', 'Table manual_subscription_overrides exists');
SELECT has_table('public', 'admin_audit_logs', 'Table admin_audit_logs exists');
SELECT has_table('public', 'saas_metrics_snapshots', 'Table saas_metrics_snapshots exists');

-- 2. Verify column scheduler_owner on subscriptions
SELECT has_column('public', 'subscriptions', 'scheduler_owner', 'Column scheduler_owner exists on subscriptions');
SELECT has_column('public', 'subscriptions', 'scheduler_owner_effective_date', 'Column scheduler_owner_effective_date exists on subscriptions');

-- 3. Verify RLS is enabled on all new tables (checking relrowsecurity in pg_class)
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE relname = 'reconciliation_queue'), 'RLS is enabled on reconciliation_queue');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE relname = 'payment_refunds'), 'RLS is enabled on payment_refunds');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE relname = 'provider_configurations'), 'RLS is enabled on provider_configurations');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE relname = 'manual_subscription_overrides'), 'RLS is enabled on manual_subscription_overrides');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE relname = 'admin_audit_logs'), 'RLS is enabled on admin_audit_logs');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE relname = 'saas_metrics_snapshots'), 'RLS is enabled on saas_metrics_snapshots');

-- 4. Verify check constraint on scheduler_owner
SELECT throws_ok(
    $$
    INSERT INTO public.subscriptions (
        id, org_id, plan_id, price_id, provider, billing_interval, status,
        current_period_start, current_period_end, scheduler_owner
    ) VALUES (
        gen_random_uuid(), gen_random_uuid(), 'b2b_core', 'price_core_monthly_v1', 'XENDIT', 'MONTHLY', 'ACTIVE',
        now(), now() + interval '1 month', 'INVALID_SCHEDULER'
    )
    $$,
    '23514',
    NULL,
    'Invalid scheduler_owner is rejected by check constraint'
);

-- 5. Verify manual override mandatory future expiry constraint
SELECT throws_ok(
    $$
    INSERT INTO public.manual_subscription_overrides (
        id, subscription_id, org_id, override_type, previous_value, new_value, reason, admin_id, granted_at, expires_at
    ) VALUES (
        gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), 'STATUS_OVERRIDE', '{}', '{}', 'Test override', gen_random_uuid(),
        now(), now() - interval '1 day'
    )
    $$,
    '23514',
    NULL,
    'Manual override with past expiry is rejected by check constraint'
);

SELECT * FROM finish();
ROLLBACK;
