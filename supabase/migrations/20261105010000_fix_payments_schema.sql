-- ============================================================================
-- ISF TRACKER
-- COMPREHENSIVE FIX FOR PAYMENTS SCHEMA & POSTGREST SCHEMA CACHE RELOAD
-- Migration: 20261105010000_fix_payments_schema.sql
-- ============================================================================

-- 1. Ensure the payments table exists with primary key
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Safely add all required columns if they don't already exist on public.payments
ALTER TABLE public.payments 
ADD COLUMN IF NOT EXISTS subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE CASCADE;

ALTER TABLE public.payments 
ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'mpesa';

ALTER TABLE public.payments 
ADD COLUMN IF NOT EXISTS provider_reference TEXT;

ALTER TABLE public.payments 
ADD COLUMN IF NOT EXISTS amount NUMERIC NOT NULL DEFAULT 0;

ALTER TABLE public.payments 
ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'KES';

ALTER TABLE public.payments 
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';

ALTER TABLE public.payments 
ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

ALTER TABLE public.payments 
ADD COLUMN IF NOT EXISTS raw_reference_hash TEXT;

-- 3. Now create indexes safely (since provider_reference and subscription_id are guaranteed to exist above)
CREATE INDEX IF NOT EXISTS idx_payments_provider_reference
ON public.payments(provider_reference);

CREATE INDEX IF NOT EXISTS idx_payments_subscription_id
ON public.payments(subscription_id);

-- 4. Reload PostgREST schema cache to make updated columns and tables immediately available
NOTIFY pgrst, 'reload schema';
