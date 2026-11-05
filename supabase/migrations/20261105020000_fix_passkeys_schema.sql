-- ============================================================================
-- ISF TRACKER
-- COMPREHENSIVE FIX FOR PASSKEYS SCHEMA & POSTGREST SCHEMA CACHE RELOAD
-- Migration: 20261105020000_fix_passkeys_schema.sql
-- ============================================================================

-- 1. Ensure the passkeys table exists
CREATE TABLE IF NOT EXISTS public.passkeys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    credential_id TEXT NOT NULL UNIQUE,
    public_key TEXT NOT NULL,
    counter BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Safely add all columns if they don't already exist on public.passkeys
ALTER TABLE public.passkeys 
ADD COLUMN IF NOT EXISTS device_name TEXT DEFAULT 'Biometric Authenticator';

ALTER TABLE public.passkeys 
ADD COLUMN IF NOT EXISTS transports TEXT[] DEFAULT '{}';

ALTER TABLE public.passkeys 
ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ;

-- 3. Create indexes
CREATE INDEX IF NOT EXISTS idx_passkeys_user_id ON public.passkeys(user_id);
CREATE INDEX IF NOT EXISTS idx_passkeys_credential_id ON public.passkeys(credential_id);

-- 4. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
