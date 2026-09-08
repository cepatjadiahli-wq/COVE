-- ==============================================================================
-- COVE — Migration 004: Extended Growth, Recovery, Feedback & Measurement Schema
-- Conformance: COVE ERD v2.1 (§23–§31) & PRD v2.2 (Addendum A)
-- Target Database: PostgreSQL / Supabase
-- Description: Adds logical data model tables for visitor sessions, consent records,
--              communication suppression, checkout projections, canonical events,
--              recovery cases & activities, marketing outbox, support internal notes,
--              feedback attachments, feature requests & canonical backlog items.
-- ==============================================================================

-- §24. Identity, Session, Consent, dan Suppression
CREATE TABLE IF NOT EXISTS visitor_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_token TEXT NOT NULL UNIQUE,
    landing_url TEXT NOT NULL,
    referrer TEXT,
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '30 days'
);

CREATE TABLE IF NOT EXISTS growth_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES visitor_sessions(id) ON DELETE SET NULL,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT,
    company_name TEXT,
    lead_source TEXT NOT NULL DEFAULT 'ORGANIC_WEB',
    status TEXT NOT NULL CHECK (status IN ('LEAD', 'CHECKOUT_ABANDONED', 'SUBSCRIBED', 'UNSUBSCRIBED', 'SUPPRESSED')) DEFAULT 'LEAD',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS consent_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id UUID REFERENCES growth_contacts(id) ON DELETE CASCADE,
    profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    consent_type TEXT NOT NULL CHECK (consent_type IN ('ANALYTICS', 'META_CAPI_ADS', 'WHATSAPP_COMMUNICATION', 'PRODUCT_RESEARCH')),
    granted BOOLEAN NOT NULL DEFAULT FALSE,
    ip_address_hash TEXT,
    user_agent TEXT,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS communication_suppressions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id UUID REFERENCES growth_contacts(id) ON DELETE CASCADE,
    channel TEXT NOT NULL CHECK (channel IN ('EMAIL', 'WHATSAPP', 'ALL')),
    reason TEXT NOT NULL CHECK (reason IN ('UNSUBSCRIBED', 'BOUNCED', 'MANUAL_REQUEST', 'COMPLAINT', 'INVALID_NUMBER')),
    suppressed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ
);

-- §25. Attribution, Checkout Projection, dan Event Canonical
CREATE TABLE IF NOT EXISTS checkout_projections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES visitor_sessions(id) ON DELETE SET NULL,
    contact_id UUID REFERENCES growth_contacts(id) ON DELETE SET NULL,
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    plan_id TEXT NOT NULL REFERENCES plans(id),
    billing_interval TEXT NOT NULL CHECK (billing_interval IN ('MONTHLY', 'ANNUAL', 'ONE_TIME')),
    attempted_amount NUMERIC(15,2) NOT NULL CHECK (attempted_amount >= 0),
    status TEXT NOT NULL CHECK (status IN ('INITIATED', 'WAITING_PAYMENT', 'SETTLED', 'EXPIRED', 'ABANDONED')) DEFAULT 'INITIATED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS canonical_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_name TEXT NOT NULL,
    event_category TEXT NOT NULL CHECK (event_category IN ('PAGE_VIEW', 'CHECKOUT', 'PAYMENT', 'ONBOARDING', 'PROJECT')),
    session_id UUID REFERENCES visitor_sessions(id) ON DELETE SET NULL,
    actor_profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    event_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- §26. Recovery Case, Template, dan Activity
CREATE TABLE IF NOT EXISTS recovery_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    channel TEXT NOT NULL CHECK (channel IN ('WHATSAPP_MANUAL', 'EMAIL_MANUAL')),
    template_text TEXT NOT NULL,
    compliance_approved BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS recovery_cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    checkout_id UUID REFERENCES checkout_projections(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES growth_contacts(id) ON DELETE CASCADE,
    assigned_admin_id UUID REFERENCES platform_admins(id) ON DELETE SET NULL,
    status TEXT NOT NULL CHECK (status IN ('OPEN', 'CONTACTED_MANUAL', 'RECOVERED', 'LOST', 'SUPPRESSED')) DEFAULT 'OPEN',
    abandon_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS recovery_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID REFERENCES recovery_cases(id) ON DELETE CASCADE,
    actor_admin_id UUID REFERENCES platform_admins(id) ON DELETE SET NULL,
    activity_type TEXT NOT NULL CHECK (activity_type IN ('TEMPLATE_CLICK_TO_CHAT', 'EMAIL_SENT', 'NOTE_ADDED', 'STATUS_CHANGED')),
    activity_notes TEXT,
    performed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- §27. Conversion Outbox, Destination, dan Atribusi (Meta Pixel & CAPI)
CREATE TABLE IF NOT EXISTS marketing_destinations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform TEXT NOT NULL CHECK (platform IN ('META_CAPI', 'GOOGLE_ENHANCED_CONVERSIONS')),
    status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'PAUSED', 'DISABLED')) DEFAULT 'ACTIVE',
    api_endpoint TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS conversion_outbox_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    destination_id UUID REFERENCES marketing_destinations(id) ON DELETE CASCADE,
    event_name TEXT NOT NULL CHECK (event_name IN ('PageView', 'ViewContent', 'InitiateCheckout', 'Purchase')),
    event_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    event_source_url TEXT NOT NULL,
    hashed_user_data JSONB NOT NULL,
    custom_data JSONB,
    status TEXT NOT NULL CHECK (status IN ('PENDING', 'SENT', 'FAILED', 'SUPPRESSED')) DEFAULT 'PENDING',
    retry_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS conversion_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    outbox_event_id UUID REFERENCES conversion_outbox_events(id) ON DELETE CASCADE,
    http_status INT,
    response_body JSONB,
    delivered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- §28. Support Ticket, Komplain, dan Lampiran
CREATE TABLE IF NOT EXISTS support_internal_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID REFERENCES support_tickets(id) ON DELETE CASCADE,
    admin_id UUID REFERENCES platform_admins(id) ON DELETE SET NULL,
    note_body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS feedback_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID REFERENCES support_tickets(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    mime_type TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- §29. Feature Request, Canonical Backlog, dan Release
CREATE TABLE IF NOT EXISTS canonical_backlog_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    module_target TEXT NOT NULL,
    priority TEXT NOT NULL CHECK (priority IN ('P1', 'P2', 'P3', 'LATER')),
    status TEXT NOT NULL CHECK (status IN ('REVIEW', 'PLANNED', 'IN_PROGRESS', 'RELEASED', 'REJECTED')) DEFAULT 'REVIEW',
    target_release_quarter TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS feature_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    creator_membership_id UUID REFERENCES organization_memberships(id) ON DELETE SET NULL,
    backlog_item_id UUID REFERENCES canonical_backlog_items(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    module TEXT NOT NULL,
    problem_description TEXT NOT NULL,
    commercial_impact TEXT,
    status TEXT NOT NULL CHECK (status IN ('DITINJAU', 'DIRENCANAKAN', 'DALAM_PENGERJAAN', 'DIRILIS', 'DITOLAK')) DEFAULT 'DITINJAU',
    admin_response TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- §30. Platform Role Grants & Notifications
CREATE TABLE IF NOT EXISTS platform_role_grants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID REFERENCES platform_admins(id) ON DELETE CASCADE,
    role_scope TEXT NOT NULL CHECK (role_scope IN ('SUPER_ADMIN', 'FINANCE_OPERATOR', 'GROWTH_OPERATOR', 'SUPPORT_AGENT')),
    granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS platform_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID REFERENCES platform_admins(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
