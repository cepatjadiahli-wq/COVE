-- =============================================================================
-- COVE V1 - pgTAP Database Test Suite: Phase 16R.4
-- 01_subscription_rls_and_concurrency.test.sql
-- Verification of 37 Comprehensive Security, RLS & Privilege Scenarios
-- =============================================================================

BEGIN;
SELECT plan(42);

-- -----------------------------------------------------------------------------
-- SETUP: Fixtures for Multi-Tenant Isolation, RLS, and Privileges
-- -----------------------------------------------------------------------------
CREATE TEMPORARY TABLE test_vars AS
SELECT
    gen_random_uuid() AS org_a_id,
    gen_random_uuid() AS org_b_id,
    gen_random_uuid() AS org_c_id, -- READ_ONLY tenant
    gen_random_uuid() AS org_d_id, -- No subscription tenant
    gen_random_uuid() AS user_owner_a_auth,
    gen_random_uuid() AS user_admin_a_auth,
    gen_random_uuid() AS user_qs_a_auth,
    gen_random_uuid() AS user_finance_a_auth,
    gen_random_uuid() AS user_owner_b_auth,
    gen_random_uuid() AS user_no_membership_auth,
    gen_random_uuid() AS user_platform_admin_auth,
    gen_random_uuid() AS client_a_id;

GRANT SELECT ON test_vars TO anon, authenticated, service_role;

-- Insert Organizations
INSERT INTO public.organizations (id, name, subscription_status)
SELECT org_a_id, 'Tenant A Construction', 'active' FROM test_vars
UNION ALL
SELECT org_b_id, 'Tenant B Builders', 'active' FROM test_vars
UNION ALL
SELECT org_c_id, 'Tenant C Heavy', 'suspended' FROM test_vars
UNION ALL
SELECT org_d_id, 'Tenant D Trial', 'trial' FROM test_vars;

-- Insert Client
INSERT INTO public.clients (id, organization_id, client_code, name)
SELECT client_a_id, org_a_id, 'CL-01', 'Test Client A' FROM test_vars;

-- Insert Auth Users into auth.users (so foreign keys to auth.users succeed)
INSERT INTO auth.users (id, email)
SELECT user_owner_a_auth, 'owner_a@example.com' FROM test_vars
UNION ALL
SELECT user_admin_a_auth, 'admin_a@example.com' FROM test_vars
UNION ALL
SELECT user_qs_a_auth, 'qs_a@example.com' FROM test_vars
UNION ALL
SELECT user_finance_a_auth, 'finance_a@example.com' FROM test_vars
UNION ALL
SELECT user_owner_b_auth, 'owner_b@example.com' FROM test_vars
UNION ALL
SELECT user_no_membership_auth, 'no_org@example.com' FROM test_vars
UNION ALL
SELECT user_platform_admin_auth, 'superadmin@cove.id' FROM test_vars;

-- Insert Profiles (Canonical Option B: profiles.auth_user_id references auth.users(id))
INSERT INTO public.profiles (id, auth_user_id, full_name, email)
SELECT user_owner_a_auth, user_owner_a_auth, 'Owner A', 'owner_a@example.com' FROM test_vars
UNION ALL
SELECT user_admin_a_auth, user_admin_a_auth, 'Admin A', 'admin_a@example.com' FROM test_vars
UNION ALL
SELECT user_qs_a_auth, user_qs_a_auth, 'QS A', 'qs_a@example.com' FROM test_vars
UNION ALL
SELECT user_finance_a_auth, user_finance_a_auth, 'Finance A', 'finance_a@example.com' FROM test_vars
UNION ALL
SELECT user_owner_b_auth, user_owner_b_auth, 'Owner B', 'owner_b@example.com' FROM test_vars
UNION ALL
SELECT user_no_membership_auth, user_no_membership_auth, 'No Org User', 'no_org@example.com' FROM test_vars
UNION ALL
SELECT user_platform_admin_auth, user_platform_admin_auth, 'Platform Admin', 'superadmin@cove.id' FROM test_vars;

-- Insert Memberships in organization_members
INSERT INTO public.organization_members (organization_id, user_id, role, status)
SELECT v.org_a_id, v.user_owner_a_auth, 'OWNER', 'active' FROM test_vars v
UNION ALL
SELECT v.org_a_id, v.user_admin_a_auth, 'ADMIN', 'active' FROM test_vars v
UNION ALL
SELECT v.org_a_id, v.user_qs_a_auth, 'QS', 'active' FROM test_vars v
UNION ALL
SELECT v.org_a_id, v.user_finance_a_auth, 'FINANCE_MANAGER', 'active' FROM test_vars v
UNION ALL
SELECT v.org_b_id, v.user_owner_b_auth, 'OWNER', 'active' FROM test_vars v
UNION ALL
SELECT v.org_c_id, v.user_owner_a_auth, 'OWNER', 'active' FROM test_vars v
UNION ALL
SELECT v.org_d_id, v.user_owner_a_auth, 'OWNER', 'active' FROM test_vars v;

-- Insert Platform Admin
INSERT INTO public.platform_admins (auth_user_id, notes)
SELECT user_platform_admin_auth, 'Official Platform Administrator' FROM test_vars;

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
    ('price_b2b_core_monthly', 'b2b_core', 'IDR', 2499000, 'monthly', NOW(), true),
    ('price_b2b_scale_monthly', 'b2b_scale', 'IDR', 4999000, 'monthly', NOW(), true),
    ('price_ent_monthly', 'b2b_enterprise', 'IDR', 9999000, 'monthly', NOW(), true)
ON CONFLICT (id) DO NOTHING;

-- Insert Plan Entitlements (Core max 1 project, max 10 users; Scale max 5 projects, max 25 users)
INSERT INTO public.plan_entitlements (plan_id, max_active_projects, max_users, export_enabled)
VALUES 
    ('b2b_core', 1, 10, true),
    ('b2b_scale', 5, 25, true);

-- Insert Subscriptions
INSERT INTO public.subscriptions (id, org_id, plan_id, price_id, status, current_period_start, current_period_end)
SELECT gen_random_uuid(), v.org_a_id, 'b2b_core', 'price_b2b_core_monthly', 'ACTIVE', NOW(), NOW() + INTERVAL '30 days' FROM test_vars v
UNION ALL
SELECT gen_random_uuid(), v.org_b_id, 'b2b_scale', 'price_b2b_scale_monthly', 'ACTIVE', NOW(), NOW() + INTERVAL '30 days' FROM test_vars v
UNION ALL
SELECT gen_random_uuid(), v.org_c_id, 'b2b_core', 'price_b2b_core_monthly', 'READ_ONLY', NOW() - INTERVAL '35 days', NOW() - INTERVAL '5 days' FROM test_vars v;
-- Note: org_d_id has NO subscription record.

-- Insert Webhook Event
INSERT INTO public.webhook_events (id, provider, event_id, event_type, processing_status, raw_payload)
VALUES (gen_random_uuid(), 'MOCK', 'evt_mock_sec_01', 'payment.succeeded', 'PROCESSED', '{"amount": 5000000}'::jsonb);

-- -----------------------------------------------------------------------------
-- SCENARIO 1: Anon cannot execute quota RPC
-- -----------------------------------------------------------------------------
SET LOCAL ROLE anon;
SELECT throws_ok(
    $$SELECT public.invite_user_with_quota_check((SELECT org_a_id FROM test_vars), 'anon_invitee@test.com', 'Anon Invitee', 'VIEWER')$$,
    '42501',
    NULL,
    'Scenario 1: Anon user is rejected when executing quota RPC'
);

-- -----------------------------------------------------------------------------
-- SCENARIO 2: Authenticated non-member cannot execute quota RPC for any org
-- -----------------------------------------------------------------------------
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', (SELECT user_no_membership_auth::text FROM test_vars), true);

SELECT throws_ok(
    $$SELECT public.invite_user_with_quota_check((SELECT org_a_id FROM test_vars), 'some_user@test.com', 'Some User', 'VIEWER')$$,
    '42501',
    NULL,
    'Scenario 2: Authenticated non-member cannot execute quota RPC for any organization'
);

-- -----------------------------------------------------------------------------
-- SCENARIO 3: Member of Tenant A cannot run RPC for Tenant B
-- -----------------------------------------------------------------------------
SELECT set_config('request.jwt.claim.sub', (SELECT user_owner_a_auth::text FROM test_vars), true);

SELECT throws_ok(
    $$SELECT public.invite_user_with_quota_check((SELECT org_b_id FROM test_vars), 'intruder@test.com', 'Intruder', 'VIEWER')$$,
    '42501',
    NULL,
    'Scenario 3: Member of Tenant A cannot execute quota RPC for Tenant B (Cross-Tenant)'
);

-- -----------------------------------------------------------------------------
-- SCENARIO 4: QS of Tenant A cannot invite users (Only OWNER or ADMIN allowed)
-- -----------------------------------------------------------------------------
SELECT set_config('request.jwt.claim.sub', (SELECT user_qs_a_auth::text FROM test_vars), true);

SELECT throws_ok(
    $$SELECT public.invite_user_with_quota_check((SELECT org_a_id FROM test_vars), 'qs_invitee@test.com', 'QS Invitee', 'VIEWER')$$,
    '42501',
    NULL,
    'Scenario 4: QS member cannot execute invite_user_with_quota_check (Insufficient role)'
);

-- -----------------------------------------------------------------------------
-- SCENARIO 5: OWNER of Tenant A can only invite users for Tenant A
-- -----------------------------------------------------------------------------
SELECT set_config('request.jwt.claim.sub', (SELECT user_owner_a_auth::text FROM test_vars), true);

SELECT lives_ok(
    $$SELECT public.invite_user_with_quota_check((SELECT org_a_id FROM test_vars), 'new_staff_a@test.com', 'New Staff A', 'QS')$$,
    'Scenario 5: OWNER of Tenant A successfully invites a user for Tenant A'
);

-- -----------------------------------------------------------------------------
-- SCENARIO 6: Comprehensive Direct Billing Mutation Tests (Zero Direct Mutate)
-- -----------------------------------------------------------------------------
-- Under hardened RLS, authenticated users have zero UPDATE policy on subscriptions.
-- 6a: plan_id UPDATE by OWNER
UPDATE public.subscriptions SET plan_id = 'b2b_enterprise' WHERE org_id = (SELECT org_a_id FROM test_vars);
SELECT results_eq(
    'SELECT plan_id FROM public.subscriptions WHERE org_id = (SELECT org_a_id FROM test_vars)',
    'SELECT ''b2b_core''::varchar',
    'Scenario 6a: Direct UPDATE plan_id by OWNER affects zero rows'
);

-- 6b: status UPDATE by OWNER
UPDATE public.subscriptions SET status = 'EXPIRED' WHERE org_id = (SELECT org_a_id FROM test_vars);
SELECT results_eq(
    'SELECT status FROM public.subscriptions WHERE org_id = (SELECT org_a_id FROM test_vars)',
    'SELECT ''ACTIVE''::varchar',
    'Scenario 6b: Direct UPDATE status by OWNER affects zero rows'
);

-- 6c: price_id UPDATE by OWNER
UPDATE public.subscriptions SET price_id = 'price_fake' WHERE org_id = (SELECT org_a_id FROM test_vars);
SELECT results_eq(
    'SELECT price_id FROM public.subscriptions WHERE org_id = (SELECT org_a_id FROM test_vars)',
    'SELECT ''price_b2b_core_monthly''::varchar',
    'Scenario 6c: Direct UPDATE price_id by OWNER affects zero rows'
);

-- 6d: current_period_end UPDATE by OWNER
UPDATE public.subscriptions SET current_period_end = NOW() + INTERVAL '100 years' WHERE org_id = (SELECT org_a_id FROM test_vars);
SELECT results_eq(
    'SELECT current_period_end > NOW() + INTERVAL ''1 year'' FROM public.subscriptions WHERE org_id = (SELECT org_a_id FROM test_vars)',
    'SELECT false',
    'Scenario 6d: Direct UPDATE current_period_end by OWNER affects zero rows'
);

-- 6e: cancel_at_period_end UPDATE by OWNER
UPDATE public.subscriptions SET cancel_at_period_end = true WHERE org_id = (SELECT org_a_id FROM test_vars);
SELECT results_eq(
    'SELECT cancel_at_period_end FROM public.subscriptions WHERE org_id = (SELECT org_a_id FROM test_vars)',
    'SELECT false',
    'Scenario 6e: Direct UPDATE cancel_at_period_end by OWNER affects zero rows'
);

-- 6f: provider_subscription_id UPDATE by OWNER
UPDATE public.subscriptions SET provider_subscription_id = 'sub_hacked' WHERE org_id = (SELECT org_a_id FROM test_vars);
SELECT is_empty(
    'SELECT provider_subscription_id FROM public.subscriptions WHERE org_id = (SELECT org_a_id FROM test_vars) AND provider_subscription_id IS NOT NULL',
    'Scenario 6f: Direct UPDATE provider_subscription_id by OWNER affects zero rows'
);

-- 6g: direct DELETE subscription by OWNER
DELETE FROM public.subscriptions WHERE org_id = (SELECT org_a_id FROM test_vars);
SELECT results_eq(
    'SELECT count(*)::int FROM public.subscriptions WHERE org_id = (SELECT org_a_id FROM test_vars)',
    'SELECT 1',
    'Scenario 6g: Direct DELETE subscription by OWNER affects zero rows'
);

-- 6h: direct UPDATE on Tenant B subscription by OWNER A
UPDATE public.subscriptions SET status = 'CANCELLED' WHERE org_id = (SELECT org_b_id FROM test_vars);
SET LOCAL ROLE postgres;
SELECT results_eq(
    'SELECT status FROM public.subscriptions WHERE org_id = (SELECT org_b_id FROM test_vars)',
    'SELECT ''ACTIVE''::varchar',
    'Scenario 6h: Direct UPDATE on Tenant B subscription by OWNER A affects zero rows'
);
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', (SELECT user_owner_a_auth::text FROM test_vars), true);

-- 6i: direct UPDATE on billing_invoices status by tenant
UPDATE public.billing_invoices SET status = 'VOID' WHERE org_id = (SELECT org_a_id FROM test_vars);
SELECT is_empty(
    'SELECT * FROM public.billing_invoices WHERE org_id = (SELECT org_a_id FROM test_vars) AND status = ''VOID''',
    'Scenario 6i: Direct UPDATE on billing_invoices status by tenant affects zero rows'
);

-- 6j: direct UPDATE on subscriptions by tenant ADMIN
SELECT set_config('request.jwt.claim.sub', (SELECT user_admin_a_auth::text FROM test_vars), true);
UPDATE public.subscriptions SET plan_id = 'b2b_enterprise' WHERE org_id = (SELECT org_a_id FROM test_vars);
SELECT results_eq(
    'SELECT plan_id FROM public.subscriptions WHERE org_id = (SELECT org_a_id FROM test_vars)',
    'SELECT ''b2b_core''::varchar',
    'Scenario 6j: Direct UPDATE on subscriptions by tenant ADMIN affects zero rows'
);

-- 6k: direct UPDATE on subscriptions by tenant FINANCE_MANAGER
SELECT set_config('request.jwt.claim.sub', (SELECT user_finance_a_auth::text FROM test_vars), true);
UPDATE public.subscriptions SET plan_id = 'b2b_enterprise' WHERE org_id = (SELECT org_a_id FROM test_vars);
SELECT results_eq(
    'SELECT plan_id FROM public.subscriptions WHERE org_id = (SELECT org_a_id FROM test_vars)',
    'SELECT ''b2b_core''::varchar',
    'Scenario 6k: Direct UPDATE on subscriptions by FINANCE_MANAGER affects zero rows'
);

-- 6l: legitimate SELECT on subscription by OWNER
SELECT set_config('request.jwt.claim.sub', (SELECT user_owner_a_auth::text FROM test_vars), true);
SELECT results_eq(
    'SELECT count(*)::int FROM public.subscriptions WHERE org_id = (SELECT org_a_id FROM test_vars)',
    'SELECT 1',
    'Scenario 6l: Legitimate SELECT on own subscription by OWNER succeeds'
);

-- 6m: legitimate SELECT on invoice by FINANCE_MANAGER
SET LOCAL ROLE postgres;
INSERT INTO public.billing_invoices (id, org_id, invoice_number, status, amount_subtotal, amount_total, currency, due_date)
VALUES (gen_random_uuid(), (SELECT org_a_id FROM test_vars), 'INV-2026-A-001', 'PAID', 2500000, 2500000, 'IDR', NOW() + INTERVAL '7 days');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', (SELECT user_finance_a_auth::text FROM test_vars), true);
SELECT results_eq(
    'SELECT count(*)::int FROM public.billing_invoices WHERE org_id = (SELECT org_a_id FROM test_vars)',
    'SELECT 1',
    'Scenario 6m: Legitimate SELECT on own invoice by FINANCE_MANAGER succeeds'
);
-- Restore OWNER A context
SELECT set_config('request.jwt.claim.sub', (SELECT user_owner_a_auth::text FROM test_vars), true);

-- -----------------------------------------------------------------------------
-- SCENARIO 7: Tenant OWNER cannot activate plan without webhook (Zero direct INSERT)
-- -----------------------------------------------------------------------------
PREPARE insert_sub_direct AS
INSERT INTO public.subscriptions (id, org_id, plan_id, price_id, status, current_period_start)
VALUES (gen_random_uuid(), (SELECT org_a_id FROM test_vars), 'b2b_enterprise', 'price_ent_monthly', 'ACTIVE', NOW());

SELECT throws_ok(
    'EXECUTE insert_sub_direct',
    '42501',
    NULL,
    'Scenario 7: Direct INSERT into subscriptions by tenant OWNER is denied by RLS'
);

-- -----------------------------------------------------------------------------
-- SCENARIO 8: Tenant user cannot read webhook_events table
-- -----------------------------------------------------------------------------
SELECT is_empty(
    'SELECT * FROM public.webhook_events',
    'Scenario 8: Tenant user (even OWNER) cannot read webhook_events table'
);

-- -----------------------------------------------------------------------------
-- SCENARIO 9: Tenant OWNER cannot become Platform Admin (Zero INSERT into platform_admins)
-- -----------------------------------------------------------------------------
PREPARE exploit_platform_admin AS
INSERT INTO public.platform_admins (auth_user_id, notes)
VALUES ((SELECT user_owner_a_auth FROM test_vars), 'Self-promoted admin');

SELECT throws_ok(
    'EXECUTE exploit_platform_admin',
    '42501',
    NULL,
    'Scenario 9: Tenant OWNER cannot insert self into platform_admins'
);

-- -----------------------------------------------------------------------------
-- SCENARIO 10: Organization without subscription is rejected in quota RPC (Fail-Closed)
-- -----------------------------------------------------------------------------
SELECT throws_ok(
    $$SELECT public.invite_user_with_quota_check((SELECT org_d_id FROM test_vars), 'staff_d@test.com', 'Staff D', 'VIEWER')$$,
    'P0001',
    NULL,
    'Scenario 10: Organization without active subscription is rejected (Fail-Closed)'
);

-- -----------------------------------------------------------------------------
-- SCENARIO 11: READ_ONLY and SUSPENDED subscription rejected in quota RPC
-- -----------------------------------------------------------------------------
SELECT throws_ok(
    $$SELECT public.invite_user_with_quota_check((SELECT org_c_id FROM test_vars), 'staff_c@test.com', 'Staff C', 'VIEWER')$$,
    'P0001',
    NULL,
    'Scenario 11: READ_ONLY subscription is rejected in quota RPC'
);

-- -----------------------------------------------------------------------------
-- SCENARIO 12: Concurrency & quota limit enforcement: Second request rejected
-- -----------------------------------------------------------------------------
-- Core plan has max_active_projects = 1.
-- First project creation succeeds.
SELECT lives_ok(
    $$SELECT public.create_project_with_quota_check((SELECT org_a_id FROM test_vars), (SELECT client_a_id FROM test_vars), 'PRJ-TEST-1', 'Project One', 'CTR-001', 'Contract 1', 1000000000)$$,
    'Scenario 12a: First project creation succeeds (1/1 active)'
);

-- Second project creation on Core plan must be rejected (1/1 reached).
SELECT throws_ok(
    $$SELECT public.create_project_with_quota_check((SELECT org_a_id FROM test_vars), (SELECT client_a_id FROM test_vars), 'PRJ-TEST-2', 'Project Two', 'CTR-002', 'Contract 2', 2000000000)$$,
    'P0001',
    NULL,
    'Scenario 12b: Second project creation on quota limit 1 is rejected'
);

-- -----------------------------------------------------------------------------
-- SCENARIO 13: All SECURITY DEFINER functions have search_path = ''
-- -----------------------------------------------------------------------------
SELECT is_empty(
    $$SELECT proname FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname IN ('public', 'private')
        AND p.prosecdef = true
        AND (p.proconfig IS NULL OR NOT ('search_path=""' = ANY(p.proconfig)))$$,
    'Scenario 13: All SECURITY DEFINER functions in public and private enforce search_path = ""'
);

-- -----------------------------------------------------------------------------
-- SCENARIO 14: EXECUTE privilege not available to unauthorized roles
-- -----------------------------------------------------------------------------
SELECT ok(
    NOT has_function_privilege('anon', 'public.purge_old_webhook_events(integer, boolean)', 'EXECUTE'),
    'Scenario 14a: anon cannot execute purge_old_webhook_events'
);

SELECT ok(
    NOT has_function_privilege('authenticated', 'public.purge_old_webhook_events(integer, boolean)', 'EXECUTE'),
    'Scenario 14b: authenticated cannot execute purge_old_webhook_events'
);

SELECT ok(
    NOT has_function_privilege('anon', 'public.create_project_with_quota_check(uuid, uuid, text, text, text, text, numeric)', 'EXECUTE'),
    'Scenario 14c: anon cannot execute create_project_with_quota_check'
);

SELECT ok(
    NOT has_function_privilege('anon', 'public.invite_user_with_quota_check(uuid, text, text, text, text)', 'EXECUTE'),
    'Scenario 14d: anon cannot execute invite_user_with_quota_check'
);

SELECT ok(
    NOT has_function_privilege('anon', 'public.auth_user_profile_id()', 'EXECUTE'),
    'Scenario 14e: anon cannot execute auth_user_profile_id'
);

SELECT ok(
    NOT has_function_privilege('anon', 'public.auth_user_org_ids()', 'EXECUTE'),
    'Scenario 14f: anon cannot execute auth_user_org_ids'
);

SELECT ok(
    NOT has_function_privilege('anon', 'private.is_active_org_member(uuid)', 'EXECUTE'),
    'Scenario 14g: anon cannot execute is_active_org_member'
);

SELECT ok(
    NOT has_function_privilege('anon', 'private.is_org_billing_admin(uuid)', 'EXECUTE'),
    'Scenario 14h: anon cannot execute is_org_billing_admin'
);

SELECT ok(
    NOT has_function_privilege('anon', 'private.is_platform_super_admin()', 'EXECUTE'),
    'Scenario 14i: anon cannot execute is_platform_super_admin'
);

SELECT ok(
    has_function_privilege('service_role', 'public.purge_old_webhook_events(integer, boolean)', 'EXECUTE'),
    'Scenario 14j: service_role CAN execute purge_old_webhook_events'
);

-- -----------------------------------------------------------------------------
-- SCENARIO 15: Cross-tenant invoice read rejected for unauthorized roles
-- -----------------------------------------------------------------------------
-- Insert test invoice for Tenant B as service_role/postgres
SET LOCAL ROLE postgres;
INSERT INTO public.billing_invoices (id, org_id, invoice_number, status, amount_subtotal, amount_total, currency, due_date)
VALUES (gen_random_uuid(), (SELECT org_b_id FROM test_vars), 'INV-2026-B-001', 'PAID', 5000000, 5000000, 'IDR', NOW() + INTERVAL '7 days');

-- User Finance of Tenant A cannot read Tenant B's invoices
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', (SELECT user_finance_a_auth::text FROM test_vars), true);

SELECT is_empty(
    'SELECT * FROM public.billing_invoices WHERE org_id = (SELECT org_b_id FROM test_vars)',
    'Scenario 15: Finance member of Tenant A cannot read Tenant B invoices'
);

-- -----------------------------------------------------------------------------
-- SCENARIO 16: Unique constraint on profiles.auth_user_id verified (Preflight 1)
-- -----------------------------------------------------------------------------
SELECT ok(
    EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_schema = 'public'
          AND table_name = 'profiles'
          AND constraint_type = 'UNIQUE'
          AND constraint_name = 'profiles_auth_user_id_key'
    ),
    'Scenario 16: profiles.auth_user_id has unique constraint'
);

-- -----------------------------------------------------------------------------
-- SCENARIO 17: Non-billing role (QS) CANNOT direct SELECT subscriptions (Preflight 3)
-- -----------------------------------------------------------------------------
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', (SELECT user_qs_a_auth::text FROM test_vars), true);

SELECT is_empty(
    'SELECT * FROM public.subscriptions WHERE org_id = (SELECT org_a_id FROM test_vars)',
    'Scenario 17: Non-billing member (QS) cannot direct SELECT subscriptions'
);

-- -----------------------------------------------------------------------------
-- SCENARIO 18: Direct INSERT to dunning_cycles by tenant OWNER rejected by RLS
-- -----------------------------------------------------------------------------
SELECT set_config('request.jwt.claim.sub', (SELECT user_owner_a_auth::text FROM test_vars), true);

SELECT throws_ok(
    $$INSERT INTO public.dunning_cycles (id, org_id, subscription_id, stage, scheduled_at, idempotency_key)
      VALUES (gen_random_uuid(), (SELECT org_a_id FROM test_vars), (SELECT id FROM public.subscriptions WHERE org_id = (SELECT org_a_id FROM test_vars) LIMIT 1), 'H_MINUS_7', NOW(), 'key_test_owner_direct_insert')$$,
    '42501',
    NULL,
    'Scenario 18: Direct INSERT to dunning_cycles by tenant OWNER rejected by RLS'
);

-- -----------------------------------------------------------------------------
-- SCENARIO 19: Non-billing member (QS) CANNOT read dunning_cycles
-- -----------------------------------------------------------------------------
-- Insert test dunning cycle as postgres
SET LOCAL ROLE postgres;
INSERT INTO public.dunning_cycles (id, org_id, subscription_id, stage, scheduled_at, idempotency_key)
VALUES (
    gen_random_uuid(),
    (SELECT org_a_id FROM test_vars),
    (SELECT id FROM public.subscriptions WHERE org_id = (SELECT org_a_id FROM test_vars) LIMIT 1),
    'H_MINUS_7',
    NOW(),
    'dunning_fixture_test_01'
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', (SELECT user_qs_a_auth::text FROM test_vars), true);

SELECT is_empty(
    'SELECT * FROM public.dunning_cycles WHERE org_id = (SELECT org_a_id FROM test_vars)',
    'Scenario 19: Non-billing member (QS) cannot read dunning_cycles'
);

-- -----------------------------------------------------------------------------
-- SCENARIO 20: Billing reader (FINANCE) CAN read dunning_cycles
-- -----------------------------------------------------------------------------
SELECT set_config('request.jwt.claim.sub', (SELECT user_finance_a_auth::text FROM test_vars), true);

SELECT results_eq(
    'SELECT COUNT(*)::integer FROM public.dunning_cycles WHERE org_id = (SELECT org_a_id FROM test_vars)',
    ARRAY[1],
    'Scenario 20: Billing reader (FINANCE) can read dunning_cycles'
);

SELECT * FROM finish();
ROLLBACK;
