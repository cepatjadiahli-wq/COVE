-- Seed script for local development
-- Initial demo data is managed via migration 00005_seed_demo_data.sql
SELECT 1;

-- Seed baseline plans, prices, entitlements
INSERT INTO public.plans (id, name, tier_level, is_active, is_public)
VALUES
    ('b2b_core', 'COVE Core', 1, true, true),
    ('b2b_scale', 'COVE Scale', 2, true, true),
    ('b2b_enterprise', 'COVE Enterprise', 3, true, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.prices (id, plan_id, currency, amount, billing_interval, effective_from, is_current)
VALUES
    ('price_b2b_core_monthly', 'b2b_core', 'IDR', 2499000, 'monthly', NOW(), true),
    ('price_b2b_scale_monthly', 'b2b_scale', 'IDR', 4999000, 'monthly', NOW(), true),
    ('price_ent_monthly', 'b2b_enterprise', 'IDR', 9999000, 'monthly', NOW(), true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.plan_entitlements (plan_id, max_active_projects, max_users, export_enabled)
SELECT 'b2b_core', 1, 10, true
WHERE NOT EXISTS (SELECT 1 FROM public.plan_entitlements WHERE plan_id = 'b2b_core');

INSERT INTO public.plan_entitlements (plan_id, max_active_projects, max_users, export_enabled)
SELECT 'b2b_scale', 5, 25, true
WHERE NOT EXISTS (SELECT 1 FROM public.plan_entitlements WHERE plan_id = 'b2b_scale');
