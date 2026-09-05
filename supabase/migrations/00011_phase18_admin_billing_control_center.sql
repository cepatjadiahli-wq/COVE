-- ==============================================================================
-- COVE PHASE 18: ADMIN BILLING CONTROL CENTER, RECONCILIATION & SAAS METRICS
-- Source of Truth: COVE_SUBSCRIPTION_BILLING_BLUEPRINT_v1.0.md & PRD v1.0
-- 
-- Tables Created / Altered:
-- 1. reconciliation_queue: Tracks financial anomalies (partial, overpayment, mismatch, dispute)
-- 2. payment_refunds: Full/partial refunds, chargebacks, reversals, and disputes
-- 3. provider_configurations: Fine-grained multi-dimensional gateway configuration
-- 4. manual_subscription_overrides: Time-bound overrides with mandatory reason & expiry
-- 5. admin_audit_logs: Immutable forensically audited before/after actions
-- 6. saas_metrics_snapshots: Immutable daily/monthly SaaS financial metrics
-- 7. subscriptions: Extends with scheduler_owner ('COVE' | 'PROVIDER')
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. EXTEND SUBSCRIPTIONS WITH SCHEDULER OWNERSHIP
-- ------------------------------------------------------------------------------
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS scheduler_owner VARCHAR(20) NOT NULL DEFAULT 'COVE';
ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS chk_scheduler_owner;
ALTER TABLE public.subscriptions ADD CONSTRAINT chk_scheduler_owner CHECK (scheduler_owner IN ('COVE', 'PROVIDER'));
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS scheduler_owner_effective_date TIMESTAMPTZ;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS scheduler_owner_transition_state VARCHAR(50) DEFAULT 'IDLE';

-- ------------------------------------------------------------------------------
-- 2. TABEL RECONCILIATION QUEUE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reconciliation_queue (
    id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
    billing_invoice_id UUID REFERENCES public.billing_invoices(id) ON DELETE SET NULL,
    org_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
    status VARCHAR(50) NOT NULL,
    amount NUMERIC(18, 2) NOT NULL,
    unapplied_amount NUMERIC(18, 2) NOT NULL,
    applied_amount NUMERIC(18, 2) NOT NULL DEFAULT 0,
    reason TEXT,
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    resolved_by UUID REFERENCES public.platform_admins(id) ON DELETE SET NULL,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT pg_catalog.now(),
    updated_at TIMESTAMPTZ DEFAULT pg_catalog.now(),
    CONSTRAINT chk_reconciliation_status CHECK (
        status IN (
            'UNAPPLIED', 'PARTIALLY_APPLIED', 'OVERPAYMENT',
            'DUPLICATE_SUSPECTED', 'TENANT_MISMATCH', 'INVOICE_MISMATCH',
            'MANUAL_REVIEW', 'REFUNDED', 'CHARGEBACK', 'REVERSED', 'RESOLVED'
        )
    )
);

ALTER TABLE public.reconciliation_queue ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.reconciliation_queue FROM PUBLIC;
REVOKE ALL ON TABLE public.reconciliation_queue FROM anon;
GRANT SELECT ON TABLE public.reconciliation_queue TO authenticated;
GRANT ALL ON TABLE public.reconciliation_queue TO service_role;

DROP POLICY IF EXISTS rls_reconciliation_queue_select ON public.reconciliation_queue;
CREATE POLICY rls_reconciliation_queue_select ON public.reconciliation_queue
    FOR SELECT TO authenticated
    USING (private.is_platform_super_admin());

DROP POLICY IF EXISTS rls_reconciliation_queue_service_role ON public.reconciliation_queue;
CREATE POLICY rls_reconciliation_queue_service_role ON public.reconciliation_queue
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 3. TABEL PAYMENT REFUNDS, CHARGEBACKS & DISPUTES
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payment_refunds (
    id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
    billing_invoice_id UUID REFERENCES public.billing_invoices(id) ON DELETE SET NULL,
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    amount NUMERIC(18, 2) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'IDR',
    status VARCHAR(50) NOT NULL DEFAULT 'SUCCEEDED',
    provider VARCHAR(50) NOT NULL,
    provider_refund_id VARCHAR(150),
    reason TEXT NOT NULL,
    requested_by UUID,
    impact_on_revenue NUMERIC(18, 2) NOT NULL DEFAULT 0,
    impact_on_entitlement VARCHAR(100),
    raw_payload JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT pg_catalog.now(),
    CONSTRAINT chk_payment_refund_type CHECK (
        type IN (
            'FULL_REFUND', 'PARTIAL_REFUND', 'CHARGEBACK', 'REVERSAL',
            'DISPUTE_OPENED', 'DISPUTE_WON', 'DISPUTE_LOST'
        )
    ),
    CONSTRAINT chk_payment_refund_status CHECK (
        status IN ('PENDING', 'SUCCEEDED', 'FAILED', 'REVERSED')
    )
);

ALTER TABLE public.payment_refunds ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.payment_refunds FROM PUBLIC;
REVOKE ALL ON TABLE public.payment_refunds FROM anon;
GRANT SELECT ON TABLE public.payment_refunds TO authenticated;
GRANT ALL ON TABLE public.payment_refunds TO service_role;

DROP POLICY IF EXISTS rls_payment_refunds_select ON public.payment_refunds;
CREATE POLICY rls_payment_refunds_select ON public.payment_refunds
    FOR SELECT TO authenticated
    USING (private.is_platform_super_admin());

DROP POLICY IF EXISTS rls_payment_refunds_service_role ON public.payment_refunds;
CREATE POLICY rls_payment_refunds_service_role ON public.payment_refunds
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 4. TABEL PROVIDER CONFIGURATIONS REGISTRY
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.provider_configurations (
    id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    provider VARCHAR(50) NOT NULL,
    merchant_account_id VARCHAR(100) NOT NULL,
    api_version VARCHAR(50) NOT NULL DEFAULT 'v1',
    country VARCHAR(10) NOT NULL DEFAULT 'ID',
    payment_channel VARCHAR(50) NOT NULL,
    environment VARCHAR(20) NOT NULL,
    capability_status VARCHAR(50) NOT NULL,
    activation_status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    consent_requirement VARCHAR(50) NOT NULL DEFAULT 'NONE',
    saved_token_availability BOOLEAN NOT NULL DEFAULT false,
    scheduler_owner VARCHAR(20) NOT NULL DEFAULT 'COVE',
    scheduler_collision_risk VARCHAR(50) NOT NULL DEFAULT 'UNVERIFIED',
    verified_at TIMESTAMPTZ,
    verified_by UUID REFERENCES public.platform_admins(id) ON DELETE SET NULL,
    evidence_reference TEXT,
    created_at TIMESTAMPTZ DEFAULT pg_catalog.now(),
    updated_at TIMESTAMPTZ DEFAULT pg_catalog.now(),
    CONSTRAINT uq_provider_config UNIQUE (provider, merchant_account_id, api_version, country, payment_channel, environment),
    CONSTRAINT chk_provider_env CHECK (environment IN ('SANDBOX', 'PRODUCTION')),
    CONSTRAINT chk_provider_cap_status CHECK (
        capability_status IN ('SUPPORTED', 'UNSUPPORTED', 'REQUIRES_ACTIVATION', 'REQUIRES_CUSTOMER_CONSENT', 'UNKNOWN')
    ),
    CONSTRAINT chk_provider_sched_owner CHECK (scheduler_owner IN ('COVE', 'PROVIDER')),
    CONSTRAINT chk_provider_sched_risk CHECK (
        scheduler_collision_risk IN ('UNVERIFIED', 'CONTROLLED', 'CONFLICT_DETECTED', 'NONE')
    )
);

ALTER TABLE public.provider_configurations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.provider_configurations FROM PUBLIC;
REVOKE ALL ON TABLE public.provider_configurations FROM anon;
GRANT SELECT ON TABLE public.provider_configurations TO authenticated;
GRANT ALL ON TABLE public.provider_configurations TO service_role;

DROP POLICY IF EXISTS rls_provider_configs_select ON public.provider_configurations;
CREATE POLICY rls_provider_configs_select ON public.provider_configurations
    FOR SELECT TO authenticated
    USING (private.is_platform_super_admin());

DROP POLICY IF EXISTS rls_provider_configs_service_role ON public.provider_configurations;
CREATE POLICY rls_provider_configs_service_role ON public.provider_configurations
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 5. TABEL MANUAL SUBSCRIPTION OVERRIDES (MANDATORY EXPIRATION & REASON)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.manual_subscription_overrides (
    id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    subscription_id UUID NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    override_type VARCHAR(50) NOT NULL,
    previous_value JSONB NOT NULL,
    new_value JSONB NOT NULL,
    reason TEXT NOT NULL,
    admin_id UUID NOT NULL REFERENCES public.platform_admins(id) ON DELETE CASCADE,
    granted_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
    expires_at TIMESTAMPTZ NOT NULL, -- Mandatory time-bound expiration
    is_revoked BOOLEAN NOT NULL DEFAULT false,
    revoked_at TIMESTAMPTZ,
    revocation_reason TEXT,
    revoked_by UUID REFERENCES public.platform_admins(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT pg_catalog.now(),
    CONSTRAINT chk_override_type CHECK (
        override_type IN (
            'ACCESS_EXTENSION', 'STATUS_OVERRIDE', 'PRICE_OVERRIDE',
            'ENTITLEMENT_BOOST', 'DISCOUNT_APPLIED'
        )
    ),
    CONSTRAINT chk_override_expiry_future CHECK (expires_at > granted_at)
);

ALTER TABLE public.manual_subscription_overrides ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.manual_subscription_overrides FROM PUBLIC;
REVOKE ALL ON TABLE public.manual_subscription_overrides FROM anon;
GRANT SELECT ON TABLE public.manual_subscription_overrides TO authenticated;
GRANT ALL ON TABLE public.manual_subscription_overrides TO service_role;

DROP POLICY IF EXISTS rls_manual_overrides_select ON public.manual_subscription_overrides;
CREATE POLICY rls_manual_overrides_select ON public.manual_subscription_overrides
    FOR SELECT TO authenticated
    USING (private.is_platform_super_admin());

DROP POLICY IF EXISTS rls_manual_overrides_service_role ON public.manual_subscription_overrides;
CREATE POLICY rls_manual_overrides_service_role ON public.manual_subscription_overrides
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 6. TABEL ADMIN AUDIT LOGS (BEFORE/AFTER FORENSIC AUDIT TRAIL)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
    id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    admin_id UUID NOT NULL REFERENCES public.platform_admins(id) ON DELETE CASCADE,
    action VARCHAR(100) NOT NULL,
    target_entity VARCHAR(50) NOT NULL,
    target_id VARCHAR(100) NOT NULL,
    org_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
    reason TEXT NOT NULL,
    before_state JSONB,
    after_state JSONB,
    ip_address VARCHAR(45),
    request_id VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT pg_catalog.now()
);

ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.admin_audit_logs FROM PUBLIC;
REVOKE ALL ON TABLE public.admin_audit_logs FROM anon;
GRANT SELECT ON TABLE public.admin_audit_logs TO authenticated;
GRANT ALL ON TABLE public.admin_audit_logs TO service_role;

DROP POLICY IF EXISTS rls_admin_audit_logs_select ON public.admin_audit_logs;
CREATE POLICY rls_admin_audit_logs_select ON public.admin_audit_logs
    FOR SELECT TO authenticated
    USING (private.is_platform_super_admin());

DROP POLICY IF EXISTS rls_admin_audit_logs_service_role ON public.admin_audit_logs;
CREATE POLICY rls_admin_audit_logs_service_role ON public.admin_audit_logs
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 7. TABEL SAAS METRICS SNAPSHOTS (IMMUTABLE DAILY / MONTHLY)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.saas_metrics_snapshots (
    id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    period_type VARCHAR(20) NOT NULL,
    snapshot_date DATE NOT NULL,
    timezone VARCHAR(50) NOT NULL DEFAULT 'Asia/Jakarta',
    currency VARCHAR(10) NOT NULL DEFAULT 'IDR',
    formula_version VARCHAR(20) NOT NULL DEFAULT 'v1.0',
    is_locked BOOLEAN NOT NULL DEFAULT false,
    locked_at TIMESTAMPTZ,
    mrr NUMERIC(18, 2) NOT NULL DEFAULT 0,
    arr NUMERIC(18, 2) NOT NULL DEFAULT 0,
    beginning_mrr NUMERIC(18, 2) NOT NULL DEFAULT 0,
    new_mrr NUMERIC(18, 2) NOT NULL DEFAULT 0,
    expansion_mrr NUMERIC(18, 2) NOT NULL DEFAULT 0,
    contraction_mrr NUMERIC(18, 2) NOT NULL DEFAULT 0,
    reactivation_mrr NUMERIC(18, 2) NOT NULL DEFAULT 0,
    churned_mrr NUMERIC(18, 2) NOT NULL DEFAULT 0,
    ending_mrr NUMERIC(18, 2) NOT NULL DEFAULT 0,
    active_customers INT NOT NULL DEFAULT 0,
    new_customers INT NOT NULL DEFAULT 0,
    churned_customers INT NOT NULL DEFAULT 0,
    logo_churn_rate NUMERIC(8, 4) NOT NULL DEFAULT 0,
    revenue_churn_rate NUMERIC(8, 4) NOT NULL DEFAULT 0,
    gross_revenue_retention NUMERIC(8, 4) NOT NULL DEFAULT 0,
    net_revenue_retention NUMERIC(8, 4) NOT NULL DEFAULT 0,
    arpa NUMERIC(18, 2) NOT NULL DEFAULT 0,
    failed_payment_rate NUMERIC(8, 4) NOT NULL DEFAULT 0,
    dunning_recovery_rate NUMERIC(8, 4) NOT NULL DEFAULT 0,
    involuntary_churn_rate NUMERIC(8, 4) NOT NULL DEFAULT 0,
    renewal_rate NUMERIC(8, 4) NOT NULL DEFAULT 0,
    collection_rate NUMERIC(8, 4) NOT NULL DEFAULT 0,
    breakdown_by_plan JSONB NOT NULL DEFAULT '{}',
    breakdown_by_provider JSONB NOT NULL DEFAULT '{}',
    raw_details JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT pg_catalog.now(),
    CONSTRAINT chk_metrics_period_type CHECK (period_type IN ('DAILY', 'MONTHLY')),
    CONSTRAINT uq_saas_metrics_snapshot UNIQUE (period_type, snapshot_date, formula_version)
);

ALTER TABLE public.saas_metrics_snapshots ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.saas_metrics_snapshots FROM PUBLIC;
REVOKE ALL ON TABLE public.saas_metrics_snapshots FROM anon;
GRANT SELECT ON TABLE public.saas_metrics_snapshots TO authenticated;
GRANT ALL ON TABLE public.saas_metrics_snapshots TO service_role;

DROP POLICY IF EXISTS rls_saas_metrics_snapshots_select ON public.saas_metrics_snapshots;
CREATE POLICY rls_saas_metrics_snapshots_select ON public.saas_metrics_snapshots
    FOR SELECT TO authenticated
    USING (private.is_platform_super_admin());

DROP POLICY IF EXISTS rls_saas_metrics_snapshots_service_role ON public.saas_metrics_snapshots;
CREATE POLICY rls_saas_metrics_snapshots_service_role ON public.saas_metrics_snapshots
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 8. INITIAL SEED FOR PROVIDER CONFIGURATIONS
-- ------------------------------------------------------------------------------
INSERT INTO public.provider_configurations (
    provider, merchant_account_id, api_version, country, payment_channel,
    environment, capability_status, scheduler_owner, scheduler_collision_risk,
    activation_status, evidence_reference
) VALUES
    ('XENDIT', 'merch_xendit_sandbox_01', 'v1', 'ID', 'INVOICE', 'SANDBOX', 'SUPPORTED', 'COVE', 'CONTROLLED', 'ACTIVE', 'PRD-17-XENDIT-SANDBOX'),
    ('XENDIT', 'merch_xendit_sandbox_01', 'v1', 'ID', 'CREDIT_CARD', 'SANDBOX', 'REQUIRES_CUSTOMER_CONSENT', 'COVE', 'CONTROLLED', 'ACTIVE', 'PRD-17-XENDIT-TOKENIZATION'),
    ('XENDIT', 'merch_xendit_prod_01', 'v1', 'ID', 'INVOICE', 'PRODUCTION', 'SUPPORTED', 'COVE', 'CONTROLLED', 'ACTIVE', 'PRD-17-XENDIT-PROD-INVOICE'),
    ('MAYAR', 'merch_mayar_sandbox_01', 'v1', 'ID', 'INVOICE', 'SANDBOX', 'SUPPORTED', 'COVE', 'NONE', 'ACTIVE', 'PRD-17-MAYAR-SANDBOX'),
    ('MAYAR', 'merch_mayar_prod_01', 'v1', 'ID', 'INVOICE', 'PRODUCTION', 'SUPPORTED', 'COVE', 'NONE', 'ACTIVE', 'PRD-17-MAYAR-PROD')
ON CONFLICT (provider, merchant_account_id, api_version, country, payment_channel, environment) DO NOTHING;
