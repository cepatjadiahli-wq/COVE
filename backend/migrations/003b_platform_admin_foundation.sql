-- ============================================================================
-- COVE — Platform Admin & Audit Foundation v2.1 (Gate P0-A)
-- Acuan: COVE_ERD_v2.0_Logical_Data_Model.md §26, §28, §30
-- Target Engine: PostgreSQL 15+ / Supabase
-- Dependency Order: Runs before 004_extended_growth_feedback_schema.sql
-- ============================================================================

-- §30. Platform Admins Table (Canonical Identity)
CREATE TABLE IF NOT EXISTS platform_admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID UNIQUE NOT NULL,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast lookup by auth_user_id from JWT claims
CREATE INDEX IF NOT EXISTS idx_platform_admins_auth_user ON platform_admins(auth_user_id);

-- §31. Admin Audit Logs Foundation (Canonical Immutable Log)
CREATE TABLE IF NOT EXISTS admin_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_admin_id UUID REFERENCES platform_admins(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    resource TEXT NOT NULL,
    before_state JSONB,
    after_state JSONB,
    reason TEXT,
    correlation_id TEXT,
    request_source TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_actor ON admin_audit_logs(actor_admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at ON admin_audit_logs(created_at DESC);

-- Enable RLS on platform tables
ALTER TABLE platform_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audit_logs ENABLE ROW LEVEL SECURITY;
