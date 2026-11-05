-- ============================================================================
-- ISF TRACKER
-- FIX PAYMENTS SCHEMA & POSTGREST SCHEMA CACHE RELOAD
-- Migration: 20261105010000_fix_payments_schema.sql
-- ============================================================================

-- Ensure payments table exists
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
    provider TEXT NOT NULL DEFAULT 'mpesa',
    provider_reference TEXT,
    amount NUMERIC NOT NULL CHECK (amount >= 0),
    currency TEXT NOT NULL DEFAULT 'KES',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
    paid_at TIMESTAMPTZ,
    raw_reference_hash TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure the 'provider' column exists if table was created previously without it
ALTER TABLE IF EXISTS public.payments 
ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'mpesa';

-- Ensure provider_reference index exists
CREATE INDEX IF NOT EXISTS idx_payments_provider_reference
ON public.payments(provider_reference);

CREATE INDEX IF NOT EXISTS idx_payments_subscription_id
ON public.payments(subscription_id);

-- Reload PostgREST schema cache to make column immediately visible
NOTIFY pgrst, 'reload schema';
