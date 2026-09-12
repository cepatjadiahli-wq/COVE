-- ============================================================================
-- COVE — Mayar Webhook Intake Hardening & Durability (Gate P0-C.1)
-- Acuan: COVE_PRD_v2.0_Product_End_State.md, COVE_ERD_v2.0_Logical_Data_Model.md §2, §9
-- Hardens webhook_events table:
-- 1. Adds payload_hash column (SHA-256) for deterministic payload verification
-- 2. Ensures unique constraint on (provider, event_id)
-- 3. Adds lookup index on processed_at DESC for admin auditing
-- ============================================================================

-- 1. Add payload_hash column if it doesn't exist
ALTER TABLE public.webhook_events ADD COLUMN IF NOT EXISTS payload_hash TEXT;

-- 2. Add compound uniqueness constraint on (provider, event_id) if not present
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_webhook_events_provider_event_id'
    ) THEN
        ALTER TABLE public.webhook_events ADD CONSTRAINT uq_webhook_events_provider_event_id UNIQUE (provider, event_id);
    END IF;
END $$;

-- 3. Add index for audit ordering
CREATE INDEX IF NOT EXISTS idx_webhook_events_processed_at ON public.webhook_events(processed_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_events_provider ON public.webhook_events(provider);
