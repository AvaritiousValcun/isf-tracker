-- ============================================================================
-- ISF TRACKER
-- FIX PASSKEY CHALLENGES SCHEMA & POSTGREST SCHEMA CACHE RELOAD
-- Migration: 20261105000000_fix_passkey_challenges_schema.sql
-- ============================================================================

-- Ensure the passkey_challenges table exists
CREATE TABLE IF NOT EXISTS public.passkey_challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    challenge TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'authentication' CHECK (type IN ('registration', 'authentication')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL
);

-- Ensure the 'type' column is explicitly added if table already existed without it
ALTER TABLE IF EXISTS public.passkey_challenges 
ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'authentication'
CHECK (type IN ('registration', 'authentication'));

-- Ensure index exists on challenge and type
CREATE INDEX IF NOT EXISTS idx_passkey_challenges_lookup
ON public.passkey_challenges (challenge, type, expires_at);

-- Reload PostgREST schema cache to ensure PostgREST recognizes the updated schema
NOTIFY pgrst, 'reload schema';
