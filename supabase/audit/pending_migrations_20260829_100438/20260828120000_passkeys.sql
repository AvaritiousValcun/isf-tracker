```sql
-- ============================================================================
-- ISF TRACKER
-- PASSKEY / WEBAUTHN STORAGE
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- 1. PASSKEYS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.passkeys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES auth.users(id)
        ON DELETE CASCADE,

    credential_id TEXT NOT NULL UNIQUE,

    public_key TEXT NOT NULL,

    counter BIGINT NOT NULL DEFAULT 0,

    transports TEXT[] NOT NULL DEFAULT '{}',

    device_name TEXT
        DEFAULT 'Biometric Authenticator',

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    last_used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_passkeys_user_id
    ON public.passkeys(user_id);

CREATE INDEX IF NOT EXISTS idx_passkeys_credential_id
    ON public.passkeys(credential_id);

ALTER TABLE public.passkeys
    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS passkeys_select_own
ON public.passkeys;

CREATE POLICY passkeys_select_own
ON public.passkeys
FOR SELECT
TO authenticated
USING (
    user_id = auth.uid()
);

DROP POLICY IF EXISTS passkeys_insert_own
ON public.passkeys;

CREATE POLICY passkeys_insert_own
ON public.passkeys
FOR INSERT
TO authenticated
WITH CHECK (
    user_id = auth.uid()
);

DROP POLICY IF EXISTS passkeys_delete_own
ON public.passkeys;

CREATE POLICY passkeys_delete_own
ON public.passkeys
FOR DELETE
TO authenticated
USING (
    user_id = auth.uid()
);

-- ============================================================================
-- 2. PASSKEY CHALLENGES
--
-- Challenges are short-lived and are consumed after successful verification.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.passkey_challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID
        REFERENCES auth.users(id)
        ON DELETE CASCADE,

    challenge TEXT NOT NULL,

    type TEXT NOT NULL
        CHECK (
            type IN (
                'registration',
                'authentication'
            )
        ),

    expires_at TIMESTAMPTZ NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_passkey_challenges_lookup
ON public.passkey_challenges(
    challenge,
    type,
    expires_at
);

ALTER TABLE public.passkey_challenges
    ENABLE ROW LEVEL SECURITY;

-- No client-side authenticated user should be able to read,
-- insert, modify, or delete challenges directly.
--
-- The backend uses the Supabase service role.
-- Therefore no authenticated policies are intentionally created.

-- ============================================================================
-- 3. CLEAN EXPIRED CHALLENGES
-- ============================================================================

CREATE OR REPLACE FUNCTION public.cleanup_expired_passkey_challenges()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    DELETE FROM public.passkey_challenges
    WHERE expires_at <= now();
$$;
```
