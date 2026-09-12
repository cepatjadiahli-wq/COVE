-- ============================================================================
-- COVE — Webhook Conflict Hardening & Audit Evidence (Gate P0-C.1.1)
-- Acuan: COVE_PRD_v2.0_Product_End_State.md, COVE_ERD_v2.0_Logical_Data_Model.md §2, §9
-- Adds conflict tracking columns to public.webhook_events:
-- 1. conflict_count INTEGER NOT NULL DEFAULT 0
-- 2. last_conflict_hash TEXT
-- 3. last_conflict_at TIMESTAMPTZ
-- ============================================================================

ALTER TABLE public.webhook_events 
    ADD COLUMN IF NOT EXISTS conflict_count INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_conflict_hash TEXT,
    ADD COLUMN IF NOT EXISTS last_conflict_at TIMESTAMPTZ;
