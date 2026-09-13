-- ============================================================================
-- COVE — Canonical Plan Reference Data (Gate P0-C.4.1)
-- Acuan: COVE_PRD_v2.0_Product_End_State.md §7, COVE_ERD_v2.0_Logical_Data_Model.md §26
-- Populates authoritative plan reference catalog required for billing settlement.
-- Production-safe, deterministic, and idempotent.
-- ============================================================================

INSERT INTO public.plans (id, name, price_idr, billing_period, max_active_projects, max_users, status) VALUES
('pilot', 'Paid Pilot', 7500000.00, '45_DAYS', 1, 3, 'ACTIVE'),
('core', 'Core', 4900000.00, 'MONTHLY', 3, 5, 'ACTIVE'),
('scale', 'Scale', 9900000.00, 'MONTHLY', 10, 15, 'ACTIVE'),
('enterprise', 'Enterprise', 25000000.00, 'YEARLY', 999, 999, 'ACTIVE')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    price_idr = EXCLUDED.price_idr,
    billing_period = EXCLUDED.billing_period,
    max_active_projects = EXCLUDED.max_active_projects,
    max_users = EXCLUDED.max_users,
    status = EXCLUDED.status;
