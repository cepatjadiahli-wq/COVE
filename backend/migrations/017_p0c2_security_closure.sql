-- ============================================================================
-- COVE — Billing Anomaly Access Isolation & Hardening (Gate P0-C.2.2)
-- Acuan: COVE_PRD_v2.0_Product_End_State.md §7, COVE_ERD_v2.0_Logical_Data_Model.md §2, §9
-- 1. Revoke all privileges on billing_payment_anomalies from authenticated and public
-- 2. Enable Row Level Security (RLS) on billing_payment_anomalies (deny-by-default for non-privileged roles)
-- 3. Add deterministic conflict_fingerprint column and unique constraint for anomaly flood prevention
-- ============================================================================

-- 1. Revoke tenant and public access from billing_payment_anomalies (Internal / Operator Only)
REVOKE ALL PRIVILEGES ON public.billing_payment_anomalies FROM authenticated;
REVOKE ALL PRIVILEGES ON public.billing_payment_anomalies FROM anon;
REVOKE ALL PRIVILEGES ON public.billing_payment_anomalies FROM public;

-- 2. Enable Row Level Security as defense-in-depth
ALTER TABLE public.billing_payment_anomalies ENABLE ROW LEVEL SECURITY;

-- Ensure service_role has access if the role exists
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        GRANT ALL ON public.billing_payment_anomalies TO service_role;
    END IF;
END $$;

-- 3. Add deterministic conflict_fingerprint and unique index to prevent unbounded anomaly replay
ALTER TABLE public.billing_payment_anomalies
    ADD COLUMN IF NOT EXISTS conflict_fingerprint TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_billing_payment_anomalies_fingerprint
    ON public.billing_payment_anomalies(conflict_fingerprint);
