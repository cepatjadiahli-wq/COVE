-- =============================================================================
-- COVE V1 - Construction Operations Value Engine
-- Migration 00005: Realistic Demo Seed Data
-- Seed Organization: PT Nusantara Buildindo & 4 Projects
-- =============================================================================

DO $$
DECLARE
    -- Org ID
    v_org_id UUID := '11111111-1111-1111-1111-111111111111';
    
    -- Profiles
    v_user_raka UUID := '22222222-2222-2222-2222-222222222221';
    v_user_dimas UUID := '22222222-2222-2222-2222-222222222222';
    v_user_andi UUID := '22222222-2222-2222-2222-222222222223';
    v_user_rani UUID := '22222222-2222-2222-2222-222222222224';
    v_user_fajar UUID := '22222222-2222-2222-2222-222222222225';
    
    -- Clients
    v_client_meridian UUID := '33333333-3333-3333-3333-333333333331';
    v_client_logistic UUID := '33333333-3333-3333-3333-333333333332';
    v_client_graha UUID := '33333333-3333-3333-3333-333333333333';
    v_client_permata UUID := '33333333-3333-3333-3333-333333333334';
    
    -- Projects
    v_proj_meridian UUID := '44444444-4444-4444-4444-444444444441';
    v_proj_logistic UUID := '44444444-4444-4444-4444-444444444442';
    v_proj_graha UUID := '44444444-4444-4444-4444-444444444443';
    v_proj_permata UUID := '44444444-4444-4444-4444-444444444444';
    
    -- Contracts
    v_contract_meridian UUID := '55555555-5555-5555-5555-555555555551';
    v_contract_logistic UUID := '55555555-5555-5555-5555-555555555552';
    v_contract_graha UUID := '55555555-5555-5555-5555-555555555553';
    v_contract_permata UUID := '55555555-5555-5555-5555-555555555554';
    
    -- Claims
    v_claim_mc006 UUID := '66666666-6666-6666-6666-666666666661';
    v_claim_log03 UUID := '66666666-6666-6666-6666-666666666662';
    v_claim_med02 UUID := '66666666-6666-6666-6666-666666666663';
    v_claim_per05 UUID := '66666666-6666-6666-6666-666666666664';
    
    -- Invoices
    v_inv_meridian UUID := '77777777-7777-7777-7777-777777777771';
    v_inv_logistic UUID := '77777777-7777-7777-7777-777777777772';
    v_inv_permata UUID := '77777777-7777-7777-7777-777777777773';

BEGIN
    -- 1. Create Organization
    INSERT INTO organizations (id, name, legal_name, business_type, email, phone, city, province, default_currency, timezone, subscription_status)
    VALUES (v_org_id, 'PT Nusantara Buildindo', 'PT Nusantara Buildindo Perkasa', 'General Contractor', 'info@nusantarabuildindo.co.id', '+62 21 5790 1234', 'Jakarta Selatan', 'DKI Jakarta', 'IDR', 'Asia/Jakarta', 'active')
    ON CONFLICT (id) DO NOTHING;

    -- 2. Create Profiles
    INSERT INTO profiles (id, full_name, email, phone)
    VALUES 
        (v_user_raka, 'Raka Pratama', 'raka@nusantarabuildindo.co.id', '+62 811 1234 501'),
        (v_user_dimas, 'Dimas Sucipto', 'dimas@nusantarabuildindo.co.id', '+62 811 1234 502'),
        (v_user_andi, 'Andi Wijaya', 'andi@nusantarabuildindo.co.id', '+62 811 1234 503'),
        (v_user_rani, 'Rani Prameswari', 'rani@nusantarabuildindo.co.id', '+62 811 1234 504'),
        (v_user_fajar, 'Fajar Nugroho', 'fajar@nusantarabuildindo.co.id', '+62 811 1234 505')
    ON CONFLICT (id) DO NOTHING;

    -- 3. Create Org Members
    INSERT INTO organization_members (organization_id, user_id, role, job_title, status)
    VALUES 
        (v_org_id, v_user_raka, 'OWNER', 'Managing Director', 'active'),
        (v_org_id, v_user_dimas, 'COMMERCIAL_MANAGER', 'Commercial Manager', 'active'),
        (v_org_id, v_user_andi, 'QS', 'Senior Project QS', 'active'),
        (v_org_id, v_user_rani, 'FINANCE_MANAGER', 'Finance & Billing Manager', 'active'),
        (v_org_id, v_user_fajar, 'PROJECT_MANAGER', 'Senior Project Manager', 'active')
    ON CONFLICT (organization_id, user_id) DO NOTHING;

    -- 4. Create Clients
    INSERT INTO clients (id, organization_id, client_code, name, legal_name, client_type, email, phone)
    VALUES 
        (v_client_meridian, v_org_id, 'CL-MERIDIAN', 'PT Meridian Properti Indonesia', 'PT Meridian Properti Indonesia Tbk', 'Commercial Developer', 'commercial@meridian.co.id', '+62 21 2995 8888'),
        (v_client_logistic, v_org_id, 'CL-LOGISTIC', 'PT Indo Logistik Nusantara', 'PT Indo Logistik Nusantara', 'Industrial Developer', 'finance@indologistik.com', '+62 21 8934 7711'),
        (v_client_graha, v_org_id, 'CL-SENTOSA', 'PT Sentosa Medika Utama', 'PT Sentosa Medika Utama', 'Healthcare Operator', 'projects@sentosamedika.com', '+62 21 7812 4433'),
        (v_client_permata, v_org_id, 'CL-PERMATA', 'PT Permata Land Development', 'PT Permata Land Development', 'Residential Developer', 'billing@permataland.co.id', '+62 21 5566 9900')
    ON CONFLICT (id) DO NOTHING;

    -- 5. Create Projects
    INSERT INTO projects (id, organization_id, client_id, project_code, project_name, description, project_type, location, city, contract_start_date, contract_finish_date, currency_code, status, project_manager_id, commercial_manager_id, finance_owner_id)
    VALUES 
        (v_proj_meridian, v_org_id, v_client_meridian, 'PRJ-MERIDIAN-01', 'Grand Meridian Office Tower', 'Pembangunan Gedung Kantor 28 Lantai + 3 Basement', 'Commercial Highrise', 'Jl. Jend. Sudirman Kav. 45', 'Jakarta Pusat', '2025-06-01', '2026-12-31', 'IDR', 'active', v_user_fajar, v_user_dimas, v_user_rani),
        (v_proj_logistic, v_org_id, v_client_logistic, 'PRJ-LOGISTIC-02', 'Nusantara Logistic Hub', 'Pembangunan Gudang Modern dan Fasilitas Cold Storage', 'Industrial Warehouse', 'Kawasan Industri MM2100', 'Bekasi', '2025-09-01', '2026-08-31', 'IDR', 'active', v_user_fajar, v_user_dimas, v_user_rani),
        (v_proj_graha, v_org_id, v_client_graha, 'PRJ-SENTOSA-03', 'Graha Sentosa Medical Center', 'Pembangunan Rumah Sakit Tipe B 8 Lantai', 'Healthcare Facility', 'Jl. Margonda Raya No. 120', 'Depok', '2025-11-01', '2026-10-31', 'IDR', 'active', v_user_fajar, v_user_dimas, v_user_rani),
        (v_proj_permata, v_org_id, v_client_permata, 'PRJ-PERMATA-04', 'Permata Hills Housing Phase 2', 'Pembangunan 120 Unit Rumah Tinggal Premium', 'Residential Township', 'Sentul City', 'Bogor', '2025-03-01', '2026-05-31', 'IDR', 'completed', v_user_fajar, v_user_dimas, v_user_rani)
    ON CONFLICT (id) DO NOTHING;

    -- 6. Create Contracts
    INSERT INTO contracts (id, organization_id, project_id, contract_number, contract_title, original_contract_value, current_contract_value, payment_method, payment_term_days, retention_percent)
    VALUES 
        (v_contract_meridian, v_org_id, v_proj_meridian, 'CTR-NB-MRD-2025-01', 'Kontrak Utama Pekerjaan Struktur & Arsitektur Grand Meridian', 48500000000, 48500000000, 'Monthly Progress', 30, 5.0),
        (v_contract_logistic, v_org_id, v_proj_logistic, 'CTR-NB-LOG-2025-02', 'Kontrak Pekerjaan Konstruksi Sipil & Baja Nusantara Logistic Hub', 24800000000, 24800000000, 'Milestone Progress', 30, 5.0),
        (v_contract_graha, v_org_id, v_proj_graha, 'CTR-NB-SNT-2025-03', 'Kontrak Pembangunan Gedung Utama Graha Sentosa', 36200000000, 36200000000, 'Monthly Progress', 45, 5.0),
        (v_contract_permata, v_org_id, v_proj_permata, 'CTR-NB-PMT-2025-04', 'Kontrak Pekerjaan Konstruksi Permata Hills Phase 2', 18500000000, 18500000000, 'Termin Progress', 14, 5.0)
    ON CONFLICT (id) DO NOTHING;

    -- 7. Create Claims
    -- Claim MC-006 (Project A - Certification Bottleneck)
    INSERT INTO claims (id, organization_id, project_id, contract_id, claim_number, period_start, period_end, description, current_stage, risk_level, work_performed_value, measured_value, claimed_value, certified_value, expected_net_collectible, cash_received_value, expected_cash_date, current_stage_entered_at, responsible_owner_id, source_type, source_updated_at)
    VALUES (
        v_claim_mc006, v_org_id, v_proj_meridian, v_contract_meridian, 'MC-006',
        '2026-07-01', '2026-07-31', 'Progress Claim Periode Juli 2026 (Pekerjaan Struktur Lt 14-16 & Fasade)',
        'UNDER_REVIEW', 'CRITICAL',
        3200000000, 3000000000, 2750000000, 2100000000, 1995000000, 1400000000,
        CURRENT_DATE + INTERVAL '14 days',
        NOW() - INTERVAL '16 days',
        v_user_dimas, 'manual', NOW() - INTERVAL '2 hours'
    ) ON CONFLICT (id) DO NOTHING;

    -- Claim LOG-03 (Project B - Invoice Overdue)
    INSERT INTO claims (id, organization_id, project_id, contract_id, claim_number, period_start, period_end, description, current_stage, risk_level, work_performed_value, measured_value, claimed_value, certified_value, expected_net_collectible, cash_received_value, expected_cash_date, current_stage_entered_at, responsible_owner_id, source_type, source_updated_at)
    VALUES (
        v_claim_log03, v_org_id, v_proj_logistic, v_contract_logistic, 'MC-003',
        '2026-06-01', '2026-06-30', 'Progress Claim Pekerjaan Rangka Baja dan Atap',
        'DUE', 'AT_RISK',
        1800000000, 1800000000, 1800000000, 1800000000, 1710000000, 0,
        CURRENT_DATE - INTERVAL '10 days',
        NOW() - INTERVAL '35 days',
        v_user_rani, 'manual', NOW() - INTERVAL '1 day'
    ) ON CONFLICT (id) DO NOTHING;

    -- Claim MED-02 (Project C - Evidence Incomplete)
    INSERT INTO claims (id, organization_id, project_id, contract_id, claim_number, period_start, period_end, description, current_stage, risk_level, work_performed_value, measured_value, claimed_value, certified_value, expected_net_collectible, cash_received_value, expected_cash_date, current_stage_entered_at, responsible_owner_id, source_type, source_updated_at)
    VALUES (
        v_claim_med02, v_org_id, v_proj_graha, v_contract_graha, 'MC-002',
        '2026-07-15', '2026-08-15', 'Progress Claim Pekerjaan Pondasi Bored Pile & Pile Cap',
        'CLAIM_PREPARATION', 'WATCH',
        1500000000, 1400000000, 1200000000, 0, 1140000000, 0,
        CURRENT_DATE + INTERVAL '25 days',
        NOW() - INTERVAL '12 days',
        v_user_andi, 'xlsx_import', NOW() - INTERVAL '3 days'
    ) ON CONFLICT (id) DO NOTHING;

    -- Claim PER-05 (Project D - Healthy / Collected)
    INSERT INTO claims (id, organization_id, project_id, contract_id, claim_number, period_start, period_end, description, current_stage, risk_level, work_performed_value, measured_value, claimed_value, certified_value, expected_net_collectible, cash_received_value, expected_cash_date, current_stage_entered_at, responsible_owner_id, source_type, source_updated_at)
    VALUES (
        v_claim_per05, v_org_id, v_proj_permata, v_contract_permata, 'MC-005',
        '2026-05-01', '2026-05-31', 'Final Progress Claim Serah Terima Tahap 1',
        'PAID', 'HEALTHY',
        2500000000, 2500000000, 2500000000, 2500000000, 2375000000, 2375000000,
        CURRENT_DATE - INTERVAL '40 days',
        NOW() - INTERVAL '45 days',
        v_user_dimas, 'system', NOW() - INTERVAL '5 hours'
    ) ON CONFLICT (id) DO NOTHING;

    -- 8. Create Invoices
    INSERT INTO invoices (id, organization_id, project_id, claim_id, invoice_number, issue_date, due_date, gross_amount, retention_amount, tax_amount, net_receivable_amount, cash_received_amount, outstanding_amount, expected_payment_date, status, finance_owner_id)
    VALUES 
        (v_inv_meridian, v_org_id, v_proj_meridian, v_claim_mc006, 'INV-2026-MRD-006', CURRENT_DATE - INTERVAL '20 days', CURRENT_DATE + INTERVAL '10 days', 2100000000, 105000000, 0, 1995000000, 1400000000, 595000000, CURRENT_DATE + INTERVAL '10 days', 'partially_paid', v_user_rani),
        (v_inv_logistic, v_org_id, v_proj_logistic, v_claim_log03, 'INV-2026-LOG-003', CURRENT_DATE - INTERVAL '45 days', CURRENT_DATE - INTERVAL '15 days', 1800000000, 90000000, 0, 1710000000, 0, 1710000000, CURRENT_DATE - INTERVAL '15 days', 'overdue', v_user_rani),
        (v_inv_permata, v_org_id, v_proj_permata, v_claim_per05, 'INV-2026-PMT-005', CURRENT_DATE - INTERVAL '60 days', CURRENT_DATE - INTERVAL '30 days', 2500000000, 125000000, 0, 2375000000, 2375000000, 0, CURRENT_DATE - INTERVAL '30 days', 'paid', v_user_rani)
    ON CONFLICT (id) DO NOTHING;

    -- 9. Create Cash Receipts (Multiple Receipts for Meridian MC-006)
    INSERT INTO cash_receipts (organization_id, project_id, invoice_id, receipt_number, payment_date, amount, bank_reference, notes, recorded_by)
    VALUES 
        (v_org_id, v_proj_meridian, v_inv_meridian, 'CR-2026-0089', CURRENT_DATE - INTERVAL '5 days', 800000000, 'BCA-TRF-99281', 'Pembayaran termin 1 MC-006', v_user_rani),
        (v_org_id, v_proj_meridian, v_inv_meridian, 'CR-2026-0094', CURRENT_DATE - INTERVAL '2 days', 600000000, 'BCA-TRF-99402', 'Pembayaran termin 2 MC-006', v_user_rani),
        (v_org_id, v_proj_permata, v_inv_permata, 'CR-2026-0071', CURRENT_DATE - INTERVAL '32 days', 2375000000, 'MANDIRI-TRF-44120', 'Pelunasan invoice MC-005', v_user_rani)
    ON CONFLICT DO NOTHING;

    -- 10. Create Demo Blocker (Consultant Review Rp650M on MC-006)
    INSERT INTO blockers (organization_id, project_id, entity_type, entity_id, category, title, description, financial_exposure, severity, controllability, owner_id, raised_date, target_resolve_date, status)
    VALUES (
        v_org_id, v_proj_meridian, 'claim', v_claim_mc006,
        'consultant_review',
        'Verifikasi Volume Pembesian & Fasade Pending MK',
        'Final quantity verification pending consultant approval. Perbedaan metode opname volume fasade antara QS kontraktor dan tim MK.',
        650000000, 'high', 'joint', v_user_dimas,
        CURRENT_DATE - INTERVAL '9 days', CURRENT_DATE + INTERVAL '2 days', 'open'
    ) ON CONFLICT DO NOTHING;

    -- 11. Create Demo Action (Critical Action Assigned to Dimas)
    INSERT INTO actions (organization_id, project_id, entity_type, entity_id, risk_type, financial_exposure, title, description, owner_id, priority, due_date, status)
    VALUES (
        v_org_id, v_proj_meridian, 'claim', v_claim_mc006,
        'UNCERTIFIED_AT_RISK', 650000000,
        'Escalate final quantity approval',
        'Koordinasi rapat teknis bersama Lead QS MK dan Project Director Klien untuk pengesahan berita acara selisih volume fasade Rp650M.',
        v_user_dimas, 'critical', CURRENT_DATE + INTERVAL '1 day', 'open'
    ) ON CONFLICT DO NOTHING;

    -- 12. Create Stage SLA Rules
    INSERT INTO stage_sla_rules (organization_id, stage, warning_after_days, risk_after_days, critical_after_days, active)
    VALUES 
        (v_org_id, 'MEASUREMENT', 5, 10, 15, true),
        (v_org_id, 'CLAIM_PREPARATION', 5, 7, 14, true),
        (v_org_id, 'UNDER_REVIEW', 7, 14, 21, true),
        (v_org_id, 'INVOICE_ISSUED', 3, 7, 10, true),
        (v_org_id, 'DUE', 3, 7, 14, true)
    ON CONFLICT (organization_id, stage) DO NOTHING;

END $$;
