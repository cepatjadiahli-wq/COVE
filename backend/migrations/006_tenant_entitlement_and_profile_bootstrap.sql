-- ============================================================================
-- COVE — Tenant Entitlement, Checkout Sessions & Profile Bootstrap v2.3 (Gate P0-A.3)
-- Acuan: COVE_PRD_v2.0_Product_End_State.md §7, COVE_ERD_v2.0_Logical_Data_Model.md §2, §30
-- Target Engine: PostgreSQL 15+ / Supabase
-- ============================================================================

-- ============================================================================
-- 1. Fresh User Profile Bootstrap & Safe Backfill (Supabase Trigger)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    extracted_name TEXT;
    user_phone TEXT := NULL;
BEGIN
    -- Derives full_name safely from raw_user_meta_data or email
    BEGIN
        extracted_name := COALESCE(
            NEW.raw_user_meta_data->>'full_name',
            NEW.raw_user_meta_data->>'name',
            split_part(NEW.email, '@', 1)
        );
    EXCEPTION WHEN OTHERS THEN
        extracted_name := split_part(NEW.email, '@', 1);
    END;

    IF extracted_name IS NULL OR trim(extracted_name) = '' THEN
        extracted_name := 'Pengguna COVE';
    END IF;

    BEGIN
        user_phone := NEW.phone;
    EXCEPTION WHEN OTHERS THEN
        user_phone := NULL;
    END;

    INSERT INTO public.profiles (id, auth_user_id, full_name, phone, status)
    VALUES (
        gen_random_uuid(),
        NEW.id,
        extracted_name,
        user_phone,
        'ACTIVE'
    )
    ON CONFLICT (auth_user_id) DO NOTHING;

    RETURN NEW;
END;
$$;

-- Trigger registration & safe backfill if auth.users exists
DO $$
DECLARE
    has_meta BOOLEAN := FALSE;
    has_phone BOOLEAN := FALSE;
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'auth' AND table_name = 'users'
    ) THEN
        DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
        CREATE TRIGGER on_auth_user_created
            AFTER INSERT ON auth.users
            FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

        SELECT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'raw_user_meta_data'
        ) INTO has_meta;

        SELECT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'phone'
        ) INTO has_phone;

        IF has_meta AND has_phone THEN
            EXECUTE '
            INSERT INTO public.profiles (id, auth_user_id, full_name, phone, status)
            SELECT 
                gen_random_uuid(),
                u.id,
                COALESCE(
                    u.raw_user_meta_data->>''full_name'',
                    u.raw_user_meta_data->>''name'',
                    split_part(u.email, ''@'', 1),
                    ''Pengguna COVE''
                ),
                u.phone,
                ''ACTIVE''
            FROM auth.users u
            WHERE NOT EXISTS (
                SELECT 1 FROM public.profiles p WHERE p.auth_user_id = u.id
            )
            ON CONFLICT (auth_user_id) DO NOTHING';
        ELSIF has_meta THEN
            EXECUTE '
            INSERT INTO public.profiles (id, auth_user_id, full_name, status)
            SELECT 
                gen_random_uuid(),
                u.id,
                COALESCE(
                    u.raw_user_meta_data->>''full_name'',
                    u.raw_user_meta_data->>''name'',
                    split_part(u.email, ''@'', 1),
                    ''Pengguna COVE''
                ),
                ''ACTIVE''
            FROM auth.users u
            WHERE NOT EXISTS (
                SELECT 1 FROM public.profiles p WHERE p.auth_user_id = u.id
            )
            ON CONFLICT (auth_user_id) DO NOTHING';
        ELSE
            EXECUTE '
            INSERT INTO public.profiles (id, auth_user_id, full_name, status)
            SELECT 
                gen_random_uuid(),
                u.id,
                COALESCE(split_part(u.email, ''@'', 1), ''Pengguna COVE''),
                ''ACTIVE''
            FROM auth.users u
            WHERE NOT EXISTS (
                SELECT 1 FROM public.profiles p WHERE p.auth_user_id = u.id
            )
            ON CONFLICT (auth_user_id) DO NOTHING';
        END IF;
    END IF;
END $$;

-- ============================================================================
-- 2. Hardened Subscriptions Table & Inactive Default
-- ============================================================================

-- Add updated_at column to subscriptions if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'subscriptions' AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE public.subscriptions ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    END IF;
END $$;

-- Alter default status to INACTIVE for newly created tenant subscriptions
ALTER TABLE public.subscriptions ALTER COLUMN status SET DEFAULT 'INACTIVE';

-- Update check constraint on subscriptions status to include INACTIVE and PENDING
DO $$
BEGIN
    ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_status_check;
    ALTER TABLE public.subscriptions 
        ADD CONSTRAINT subscriptions_status_check 
        CHECK (status IN ('INACTIVE', 'PENDING', 'ACTIVE', 'PAST_DUE', 'CANCELLED', 'CANCELED', 'EXPIRED'));
END $$;

-- Ensure unique constraint per organization for canonical tenant subscription
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_schema = 'public' AND table_name = 'subscriptions' AND constraint_name = 'uq_org_subscription'
    ) THEN
        ALTER TABLE public.subscriptions ADD CONSTRAINT uq_org_subscription UNIQUE (org_id);
    END IF;
END $$;

-- ============================================================================
-- 3. Canonical Checkout Sessions Table (Tenant-Bound Billing Authority)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.checkout_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    provider TEXT NOT NULL DEFAULT 'MAYAR',
    provider_reference TEXT NOT NULL UNIQUE,
    provider_checkout_id TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PAID', 'FAILED', 'EXPIRED', 'CANCELLED')),
    plan TEXT NOT NULL,
    amount NUMERIC(18, 2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'IDR',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_checkout_sessions_org ON public.checkout_sessions(organization_id);
CREATE INDEX IF NOT EXISTS idx_checkout_sessions_ref ON public.checkout_sessions(provider_reference);

-- Enable RLS on checkout_sessions
ALTER TABLE public.checkout_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS checkout_sessions_tenant_isolation ON public.checkout_sessions;
CREATE POLICY checkout_sessions_tenant_isolation ON public.checkout_sessions
    FOR ALL
    TO authenticated
    USING (organization_id IN (SELECT public.current_user_org_ids()));
