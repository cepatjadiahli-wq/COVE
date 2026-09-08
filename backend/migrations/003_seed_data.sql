-- ============================================================================
-- COVE — Seed Data SQL v2.1
-- Acuan: lib/domain.ts dan COVE_PRD_v2.0_Product_End_State.md
-- ============================================================================

-- 1. Plans
INSERT INTO plans (id, name, price_idr, billing_period, max_active_projects, max_users, status) VALUES
('pilot', 'Paid Pilot', 7500000.00, '45_DAYS', 1, 3, 'ACTIVE'),
('core', 'Core', 4900000.00, 'MONTHLY', 3, 5, 'ACTIVE'),
('scale', 'Scale', 9900000.00, 'MONTHLY', 10, 15, 'ACTIVE'),
('enterprise', 'Enterprise', 25000000.00, 'YEARLY', 999, 999, 'ACTIVE')
ON CONFLICT (id) DO NOTHING;

-- 2. Organizations
INSERT INTO organizations (id, legal_name, display_name, timezone, default_currency, status) VALUES
('a0000000-0000-0000-0000-000000000001', 'PT Ruang Karya Konstruksi', 'Ruang Karya', 'Asia/Jakarta', 'IDR', 'ACTIVE')
ON CONFLICT (id) DO NOTHING;

-- 3. Profiles & Memberships
INSERT INTO profiles (id, auth_user_id, full_name, phone, status) VALUES
('b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Andi Pratama', '+62 811-1234-5678', 'ACTIVE'),
('b0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000002', 'Sari Wulandari', '+62 812-2345-6789', 'ACTIVE'),
('b0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000003', 'Dewi Lestari', '+62 813-3456-7890', 'ACTIVE'),
('b0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000004', 'Budi Santoso', '+62 814-4567-8901', 'ACTIVE')
ON CONFLICT (id) DO NOTHING;

INSERT INTO organization_memberships (id, org_id, profile_id, role, status) VALUES
('d0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'OWNER', 'ACTIVE'),
('d0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'QS', 'ACTIVE'),
('d0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000003', 'FINANCE_MANAGER', 'ACTIVE'),
('d0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000004', 'PROJECT_MANAGER', 'ACTIVE')
ON CONFLICT (id) DO NOTHING;

-- 4. Projects
INSERT INTO projects (id, org_id, project_code, project_name, customer_name, location, status) VALUES
('e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'COV-001', 'Gedung Meridian', 'PT Meridian Properti', 'Jakarta Selatan', 'ACTIVE'),
('e0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'COV-002', 'Logistik Cakrawala', 'PT Cakrawala Logistik', 'Bekasi, Jawa Barat', 'ACTIVE'),
('e0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'COV-003', 'MEP Rumah Sakit Aruna', 'Yayasan Aruna Sehat', 'Bandung, Jawa Barat', 'ACTIVE'),
('e0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'COV-004', 'Pabrik Nusa Industri', 'PT Nusa Industri', 'Karawang, Jawa Barat', 'ARCHIVED')
ON CONFLICT (id) DO NOTHING;

-- 5. Subscriptions
INSERT INTO subscriptions (id, org_id, plan_id, status, current_period_start, current_period_end) VALUES
('f0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'core', 'ACTIVE', '2026-09-08 00:00:00+07', '2026-10-08 23:59:59+07')
ON CONFLICT (id) DO NOTHING;
