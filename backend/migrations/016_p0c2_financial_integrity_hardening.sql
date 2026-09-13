-- ============================================================================
-- COVE — Financial Integrity Hardening & Plan-Correct Entitlements (Gate P0-C.2.1)
-- Acuan: COVE_PRD_v2.0_Product_End_State.md §7, COVE_ERD_v2.0_Logical_Data_Model.md §2, §9
-- 1. Hardens billing_payments against cascade deletion (ON DELETE RESTRICT)
-- 2. Adds OVERPAYMENT_REVIEW status for distinct payments to already-settled checkouts
-- 3. Creates billing_payment_anomalies table for durable payment conflict evidence
-- 4. Prevents deletion and unauthorized updates on settled payment records
-- 5. Grants SELECT on billing_payments to authenticated tenant role
-- ============================================================================

-- 1. Replace ON DELETE CASCADE with ON DELETE RESTRICT on organization_id
ALTER TABLE public.billing_payments
    DROP CONSTRAINT IF EXISTS billing_payments_organization_id_fkey,
    ADD CONSTRAINT billing_payments_organization_id_fkey
        FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT;

-- 2. Expand status check to include OVERPAYMENT_REVIEW
ALTER TABLE public.billing_payments
    DROP CONSTRAINT IF EXISTS billing_payments_status_check,
    ADD CONSTRAINT billing_payments_status_check
        CHECK (status IN ('PENDING', 'SETTLED', 'FAILED', 'REFUNDED', 'OVERPAYMENT_REVIEW'));

-- 3. Create durable billing payment anomalies table
CREATE TABLE IF NOT EXISTS public.billing_payment_anomalies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider TEXT NOT NULL DEFAULT 'MAYAR',
    provider_payment_id TEXT NOT NULL,
    existing_payment_id UUID REFERENCES public.billing_payments(id) ON DELETE SET NULL,
    provider_event_id TEXT,
    conflict_type TEXT NOT NULL,
    incoming_amount NUMERIC(18, 2) NOT NULL,
    incoming_currency TEXT NOT NULL,
    incoming_checkout_reference TEXT,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billing_payment_anomalies_provider_pay
    ON public.billing_payment_anomalies(provider, provider_payment_id);

-- 4. Append-only and core-field immutability trigger for billing_payments
CREATE OR REPLACE FUNCTION public.prevent_settled_payment_mutation()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        RAISE EXCEPTION 'Settled billing payments cannot be deleted (financial audit immutable).';
    END IF;
    IF (TG_OP = 'UPDATE') THEN
        IF (OLD.amount != NEW.amount OR
            OLD.currency != NEW.currency OR
            OLD.provider_payment_id != NEW.provider_payment_id OR
            OLD.organization_id != NEW.organization_id) THEN
            RAISE EXCEPTION 'Core financial fields on billing_payments are immutable.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_billing_payments_immutability ON public.billing_payments;
CREATE TRIGGER trg_billing_payments_immutability
    BEFORE UPDATE OR DELETE ON public.billing_payments
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_settled_payment_mutation();

-- 5. Explicit table grant for authenticated tenant users under RLS
GRANT SELECT ON public.billing_payments TO authenticated;
GRANT SELECT ON public.billing_payment_anomalies TO authenticated;
