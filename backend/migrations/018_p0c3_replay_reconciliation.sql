-- ============================================================================
-- COVE — Replay, Reconciliation & Out-of-Order Recovery (Gate P0-C.3)
-- Acuan: COVE_PRD_v2.0_Product_End_State.md §7, COVE_ERD_v2.0_Logical_Data_Model.md §2, §9
-- 1. Adds processing lifecycle columns to webhook_events
-- 2. Creates webhook_replay_attempts for immutable replay audit trail
-- 3. Creates billing_reconciliation_items for operator review queue
-- 4. Locks down access: both new tables deny-by-default for tenant roles
-- ============================================================================

-- ============================================================================
-- 1. Add processing lifecycle columns to public.webhook_events
--    DEFAULT 'PROCESSED' is correct: all existing rows completed processing
--    before this migration and should not be re-driven by the replay system.
-- ============================================================================

ALTER TABLE public.webhook_events
    ADD COLUMN IF NOT EXISTS processing_status TEXT NOT NULL DEFAULT 'PROCESSED'
        CHECK (processing_status IN (
            'RECEIVED',
            'PROCESSING',
            'PROCESSED',
            'RETRYABLE',
            'REVIEW_REQUIRED',
            'FAILED_FINAL'
        )),
    ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS last_error_code TEXT,
    ADD COLUMN IF NOT EXISTS last_error_message TEXT;

-- Indexes for reconciliation queries
CREATE INDEX IF NOT EXISTS idx_webhook_events_processing_status
    ON public.webhook_events(processing_status);

CREATE INDEX IF NOT EXISTS idx_webhook_events_processing_started_at
    ON public.webhook_events(processing_started_at);

-- ============================================================================
-- 2. Immutable replay audit trail
--    Records every admin-initiated replay attempt regardless of outcome.
--    No UPDATE or DELETE allowed — append-only financial audit evidence.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.webhook_replay_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    webhook_event_id UUID NOT NULL REFERENCES public.webhook_events(id) ON DELETE RESTRICT,
    initiated_by_admin_id UUID,  -- platform_admins.id (nullable for system recovery)
    attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    result_status TEXT NOT NULL CHECK (result_status IN (
        'REPLAYED',
        'ALREADY_PROCESSED',
        'REVIEW_REQUIRED',
        'FAILED',
        'CONCURRENCY_BLOCKED'
    )),
    error_code TEXT,
    error_message TEXT,
    duration_ms INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_replay_attempts_event
    ON public.webhook_replay_attempts(webhook_event_id);

CREATE INDEX IF NOT EXISTS idx_webhook_replay_attempts_admin
    ON public.webhook_replay_attempts(initiated_by_admin_id);

-- Immutability: no UPDATE or DELETE on replay attempts
CREATE OR REPLACE FUNCTION public.prevent_replay_attempt_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'webhook_replay_attempts is append-only. Mutations are forbidden (financial audit trail).';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_replay_attempts_immutability ON public.webhook_replay_attempts;
CREATE TRIGGER trg_replay_attempts_immutability
    BEFORE UPDATE OR DELETE ON public.webhook_replay_attempts
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_replay_attempt_mutation();

-- Access control: deny-by-default for tenant roles
REVOKE ALL PRIVILEGES ON public.webhook_replay_attempts FROM authenticated;
REVOKE ALL PRIVILEGES ON public.webhook_replay_attempts FROM anon;
REVOKE ALL PRIVILEGES ON public.webhook_replay_attempts FROM public;

ALTER TABLE public.webhook_replay_attempts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        GRANT ALL ON public.webhook_replay_attempts TO service_role;
    END IF;
END $$;

-- ============================================================================
-- 3. Operator review queue for billing reconciliation
--    Items are created when anomalies are detected during replay/reconciliation.
--    Status transitions: OPEN → RESOLVED or OPEN → IGNORED_WITH_REASON.
--    Original records are never modified — only status + resolution metadata.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.billing_reconciliation_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_type TEXT NOT NULL CHECK (item_type IN (
        'UNRESOLVED_WEBHOOK',
        'OVERPAYMENT_REVIEW',
        'PAYMENT_CONFLICT',
        'CHECKOUT_WITHOUT_PAYMENT',
        'PAYMENT_WITHOUT_SUBSCRIPTION'
    )),
    status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN (
        'OPEN',
        'RESOLVED',
        'IGNORED_WITH_REASON'
    )),
    -- Optional FK references (nullable — not all item types have all references)
    webhook_event_id UUID REFERENCES public.webhook_events(id) ON DELETE SET NULL,
    billing_payment_id UUID REFERENCES public.billing_payments(id) ON DELETE SET NULL,
    checkout_session_id UUID REFERENCES public.checkout_sessions(id) ON DELETE SET NULL,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
    anomaly_id UUID REFERENCES public.billing_payment_anomalies(id) ON DELETE SET NULL,
    -- Structured evidence (no PII raw payload)
    details JSONB DEFAULT '{}'::jsonb,
    -- Resolution tracking
    resolution_reason TEXT,
    resolved_by_admin_id UUID,  -- platform_admins.id
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billing_reconciliation_items_status
    ON public.billing_reconciliation_items(status);

CREATE INDEX IF NOT EXISTS idx_billing_reconciliation_items_type
    ON public.billing_reconciliation_items(item_type);

CREATE INDEX IF NOT EXISTS idx_billing_reconciliation_items_org
    ON public.billing_reconciliation_items(organization_id);

CREATE INDEX IF NOT EXISTS idx_billing_reconciliation_items_webhook
    ON public.billing_reconciliation_items(webhook_event_id);

-- Access control: deny-by-default for tenant roles
REVOKE ALL PRIVILEGES ON public.billing_reconciliation_items FROM authenticated;
REVOKE ALL PRIVILEGES ON public.billing_reconciliation_items FROM anon;
REVOKE ALL PRIVILEGES ON public.billing_reconciliation_items FROM public;

ALTER TABLE public.billing_reconciliation_items ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        GRANT ALL ON public.billing_reconciliation_items TO service_role;
    END IF;
END $$;
