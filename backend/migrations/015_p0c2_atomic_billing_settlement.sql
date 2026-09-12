-- ============================================================================
-- COVE — Atomic Billing Settlement & Canonical Payments (Gate P0-C.2)
-- Acuan: COVE_PRD_v2.0_Product_End_State.md, COVE_ERD_v2.0_Logical_Data_Model.md §2, §9
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.billing_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    checkout_session_id UUID REFERENCES public.checkout_sessions(id) ON DELETE SET NULL,
    provider TEXT NOT NULL DEFAULT 'MAYAR',
    provider_payment_id TEXT NOT NULL,
    provider_event_id TEXT,
    amount NUMERIC(18, 2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'IDR',
    status TEXT NOT NULL DEFAULT 'SETTLED' CHECK (status IN ('PENDING', 'SETTLED', 'FAILED', 'REFUNDED')),
    paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_billing_payments_provider_payment UNIQUE (provider, provider_payment_id)
);

CREATE INDEX IF NOT EXISTS idx_billing_payments_org ON public.billing_payments(organization_id);
CREATE INDEX IF NOT EXISTS idx_billing_payments_checkout ON public.billing_payments(checkout_session_id);
CREATE INDEX IF NOT EXISTS idx_billing_payments_provider_payment ON public.billing_payments(provider, provider_payment_id);

-- Enable RLS on billing_payments
ALTER TABLE public.billing_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS billing_payments_tenant_isolation ON public.billing_payments;
CREATE POLICY billing_payments_tenant_isolation ON public.billing_payments
    FOR ALL
    TO authenticated
    USING (organization_id IN (SELECT public.current_user_org_ids()));
