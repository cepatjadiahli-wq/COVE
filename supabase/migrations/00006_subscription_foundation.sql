-- ==============================================================================
-- COVE V1 — Migration 00006: Subscription & Entitlement Foundation
-- PRD Reference: COVE_SUBSCRIPTION_BILLING_BLUEPRINT_v1.0.md (Bagian 4, 8, 9, 16)
-- Phase 14: Billing Data Model dan Entitlement Foundation
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. PERLUASAN TABEL ORGANIZATIONS (Additive Columns)
-- ------------------------------------------------------------------------------
ALTER TABLE public.organizations 
    ADD COLUMN IF NOT EXISTS active_subscription_id UUID,
    ADD COLUMN IF NOT EXISTS billing_email VARCHAR(255),
    ADD COLUMN IF NOT EXISTS billing_phone VARCHAR(50),
    ADD COLUMN IF NOT EXISTS npwp_number VARCHAR(50),
    ADD COLUMN IF NOT EXISTS tax_invoice_address TEXT;

-- ------------------------------------------------------------------------------
-- 2. TABEL BILLING CUSTOMERS (Pemetaan Customer Gateway ke Tenant)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.billing_customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL, -- 'XENDIT', 'MAYAR', 'MOCK'
    provider_customer_id VARCHAR(150) NOT NULL,
    default_payment_method VARCHAR(50), -- 'VIRTUAL_ACCOUNT', 'CREDIT_CARD', 'DIRECT_DEBIT', 'QRIS'
    payment_method_masked VARCHAR(50), -- misal: 'Mastercard **** 4242'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_billing_customer_provider UNIQUE (org_id, provider)
);

-- ------------------------------------------------------------------------------
-- 3. TABEL PLANS (Katalog Paket Langganan B2B)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.plans (
    id VARCHAR(50) PRIMARY KEY, -- 'b2b_pilot', 'b2b_core', 'b2b_scale', 'b2b_enterprise', 'b2b_addon_project', 'lifetime_799k'
    name VARCHAR(100) NOT NULL,
    description TEXT,
    tier_level INT NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_public BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 4. TABEL PRICES (Versi Harga Bertanggal / Price Versioning)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.prices (
    id VARCHAR(50) PRIMARY KEY, -- misal: 'price_core_monthly_v1', 'price_scale_monthly_v1'
    plan_id VARCHAR(50) NOT NULL REFERENCES public.plans(id),
    currency VARCHAR(10) NOT NULL DEFAULT 'IDR',
    amount NUMERIC(18, 2) NOT NULL,
    billing_interval VARCHAR(20) NOT NULL, -- 'MONTHLY', 'ANNUAL', 'ONEOFF_45_DAYS'
    effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    effective_until TIMESTAMPTZ, -- NULL berarti harga saat ini aktif
    is_current BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 5. TABEL PLAN ENTITLEMENTS (Batas Kuota & Fitur Paket)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.plan_entitlements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plan_id VARCHAR(50) NOT NULL REFERENCES public.plans(id),
    max_active_projects INT NOT NULL DEFAULT 1, -- -1 untuk unlimited
    max_users INT NOT NULL DEFAULT 10, -- -1 untuk unlimited
    import_enabled BOOLEAN NOT NULL DEFAULT true,
    value_gap_ledger_enabled BOOLEAN NOT NULL DEFAULT true,
    claim_readiness_enabled BOOLEAN NOT NULL DEFAULT true,
    action_queue_enabled BOOLEAN NOT NULL DEFAULT true,
    portfolio_review_level VARCHAR(50) NOT NULL DEFAULT 'SINGLE', -- 'SINGLE', 'MULTI_RANKING', 'ENTERPRISE'
    roi_ledger_enabled BOOLEAN NOT NULL DEFAULT true,
    audit_level VARCHAR(50) NOT NULL DEFAULT 'STANDARD',
    email_digest_enabled BOOLEAN NOT NULL DEFAULT true,
    export_enabled BOOLEAN NOT NULL DEFAULT true,
    api_enabled BOOLEAN NOT NULL DEFAULT false,
    sso_enabled BOOLEAN NOT NULL DEFAULT false,
    storage_limit_mb INT NOT NULL DEFAULT 15360, -- 15 GB
    support_tier VARCHAR(50) NOT NULL DEFAULT 'STANDARD',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 6. TABEL SUBSCRIPTIONS (Lifecycle Status Langganan Organisasi)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    plan_id VARCHAR(50) NOT NULL REFERENCES public.plans(id),
    price_id VARCHAR(50) NOT NULL REFERENCES public.prices(id),
    provider VARCHAR(50) NOT NULL DEFAULT 'XENDIT',
    provider_subscription_id VARCHAR(150),
    billing_interval VARCHAR(20) NOT NULL DEFAULT 'MONTHLY',
    status VARCHAR(50) NOT NULL DEFAULT 'DRAFT', 
    -- Status resmi: 'DRAFT', 'PENDING_PAYMENT', 'PILOT_ACTIVE', 'ACTIVE', 
    -- 'CANCEL_AT_PERIOD_END', 'PAST_DUE', 'READ_ONLY', 'SUSPENDED', 'CANCELLED', 'EXPIRED', 'MANUAL_GRANT'
    current_period_start TIMESTAMPTZ NOT NULL,
    current_period_end TIMESTAMPTZ NOT NULL,
    cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
    canceled_at TIMESTAMPTZ,
    churn_reason TEXT,
    grace_period_end TIMESTAMPTZ,
    next_billing_date TIMESTAMPTZ,
    currency VARCHAR(10) NOT NULL DEFAULT 'IDR',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Relasikan foreign key organizations.active_subscription_id ke subscriptions
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_org_active_subscription'
    ) THEN
        ALTER TABLE public.organizations
            ADD CONSTRAINT fk_org_active_subscription 
            FOREIGN KEY (active_subscription_id) 
            REFERENCES public.subscriptions(id) 
            ON DELETE SET NULL;
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 7. TABEL SUBSCRIPTION ITEMS (Base Plan + Add-on Proyek)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subscription_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subscription_id UUID NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
    item_type VARCHAR(50) NOT NULL, -- 'BASE_PLAN', 'ACTIVE_PROJECT_ADDON'
    unit_price NUMERIC(18, 2) NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    subtotal NUMERIC(18, 2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 8. TABEL SUBSCRIPTION STATUS EVENTS (Histori Forensik Transisi Status)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subscription_status_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subscription_id UUID NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
    from_status VARCHAR(50) NOT NULL,
    to_status VARCHAR(50) NOT NULL,
    reason TEXT NOT NULL,
    source VARCHAR(50) NOT NULL, -- 'WEBHOOK', 'CRON', 'ADMIN_OVERRIDE', 'MIGRATION'
    actor_id VARCHAR(100),
    correlation_id VARCHAR(150),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 9. TABEL BILLING INVOICES (Faktur Tagihan SaaS COVE ke Kontraktor)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.billing_invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
    invoice_number VARCHAR(100) UNIQUE NOT NULL, -- misal: 'INV-COVE-2026-09-001'
    amount_subtotal NUMERIC(18, 2) NOT NULL,
    discount_amount NUMERIC(18, 2) NOT NULL DEFAULT 0,
    tax_amount NUMERIC(18, 2) NOT NULL DEFAULT 0, -- PPN 11% / 12%
    amount_total NUMERIC(18, 2) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'IDR',
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING', -- 'DRAFT', 'PENDING', 'PAID', 'VOID', 'FAILED'
    due_date TIMESTAMPTZ NOT NULL,
    paid_at TIMESTAMPTZ,
    pdf_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 10. TABEL PAYMENTS (Catatan Pembayaran Langganan Terverifikasi)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    billing_invoice_id UUID REFERENCES public.billing_invoices(id),
    provider VARCHAR(50) NOT NULL,
    provider_payment_id VARCHAR(150) NOT NULL,
    amount NUMERIC(18, 2) NOT NULL,
    fee_amount NUMERIC(18, 2) NOT NULL DEFAULT 0,
    net_amount NUMERIC(18, 2) NOT NULL,
    payment_method VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'SUCCEEDED', -- 'SUCCEEDED', 'REFUNDED', 'PARTIALLY_REFUNDED'
    paid_at TIMESTAMPTZ NOT NULL,
    receipt_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_payment_provider_id UNIQUE (provider, provider_payment_id)
);

-- ------------------------------------------------------------------------------
-- 11. TABEL PAYMENT ATTEMPTS (Histori Percobaan Debit & Dunning)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payment_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    billing_invoice_id UUID NOT NULL REFERENCES public.billing_invoices(id) ON DELETE CASCADE,
    attempt_number INT NOT NULL DEFAULT 1,
    status VARCHAR(50) NOT NULL, -- 'SUCCESS', 'FAILED', 'PENDING'
    gateway_error_code VARCHAR(100),
    gateway_error_message TEXT,
    attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 12. TABEL WEBHOOK EVENTS (Log Webhook Idempotent)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.webhook_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider VARCHAR(50) NOT NULL,
    event_id VARCHAR(150) NOT NULL, -- ID unik dari gateway
    event_type VARCHAR(100) NOT NULL,
    raw_payload JSONB NOT NULL,
    processing_status VARCHAR(50) NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'PROCESSED', 'FAILED', 'IGNORED'
    error_message TEXT,
    retry_count INT NOT NULL DEFAULT 0,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_webhook_provider_event UNIQUE (provider, event_id)
);

-- ------------------------------------------------------------------------------
-- 13. TABEL ENTITLEMENT SNAPSHOTS (Hak Akses Efektif Terkunci)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.entitlement_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
    max_active_projects INT NOT NULL,
    max_users INT NOT NULL,
    features JSONB NOT NULL,
    effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    effective_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 14. TABEL USAGE RECORDS (Metrik Pemakaian Nyata Proyek & User)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.usage_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    metric_name VARCHAR(50) NOT NULL, -- 'ACTIVE_PROJECTS', 'ACTIVE_USERS', 'STORAGE_BYTES'
    current_value NUMERIC(18, 2) NOT NULL DEFAULT 0,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 15. TABEL SUBSCRIPTION OVERRIDES (Pemberian Akses Manual Terotorisasi)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subscription_overrides (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    granted_by VARCHAR(100) NOT NULL,
    reason TEXT NOT NULL,
    override_max_projects INT,
    override_features JSONB,
    starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 16. TABEL DISCOUNTS (Kupon & Diskon Terbatas)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.discounts (
    id VARCHAR(50) PRIMARY KEY, -- misal: 'PILOT_EARLY_BIRD'
    name VARCHAR(100) NOT NULL,
    discount_type VARCHAR(20) NOT NULL, -- 'PERCENTAGE', 'FIXED_AMOUNT'
    discount_value NUMERIC(18, 2) NOT NULL,
    applicable_plan_id VARCHAR(50) REFERENCES public.plans(id),
    max_redemptions INT,
    current_redemptions INT NOT NULL DEFAULT 0,
    valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    valid_until TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 17. TABEL BILLING AUDIT LOGS (Histori Forensik Penagihan)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.billing_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
    actor_id VARCHAR(100) NOT NULL,
    actor_role VARCHAR(50) NOT NULL,
    action VARCHAR(100) NOT NULL,
    target_entity VARCHAR(50) NOT NULL,
    target_id VARCHAR(150) NOT NULL,
    before_state JSONB,
    after_state JSONB,
    ip_address VARCHAR(50),
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 18. ROW LEVEL SECURITY (RLS) POLICIES PADA TABEL BILLING
-- ------------------------------------------------------------------------------
ALTER TABLE public.billing_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_status_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entitlement_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_audit_logs ENABLE ROW LEVEL SECURITY;

-- Tenant Isolation Policies (Read-Only untuk User dalam Organisasi)
CREATE POLICY rls_billing_customers_select ON public.billing_customers
    FOR SELECT USING (org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY rls_subscriptions_select ON public.subscriptions
    FOR SELECT USING (org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY rls_billing_invoices_select ON public.billing_invoices
    FOR SELECT USING (org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY rls_payments_select ON public.payments
    FOR SELECT USING (org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY rls_entitlement_snapshots_select ON public.entitlement_snapshots
    FOR SELECT USING (org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY rls_usage_records_select ON public.usage_records
    FOR SELECT USING (org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY rls_subscription_overrides_select ON public.subscription_overrides
    FOR SELECT USING (org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY rls_billing_audit_logs_select ON public.billing_audit_logs
    FOR SELECT USING (org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid()));
