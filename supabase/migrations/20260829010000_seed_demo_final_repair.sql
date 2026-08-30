BEGIN;

-- ============================================================================
-- ISF TRACKER
-- FINAL DEMO SEED RPC REPAIR
-- Migration: 20260829010000_seed_demo_final_repair.sql
-- ============================================================================
--
-- Purpose:
--   Ensure the application-facing seed_demo_data() RPC delegates exclusively
--   to the comprehensive synthetic demonstration dataset.
--
-- The application already calls:
--
--   public.seed_demo_data()
--
-- The comprehensive seed implementation is:
--
--   public.seed_comprehensive_demo_data()
--
-- This migration preserves that application API contract.
-- ============================================================================


-- ============================================================================
-- 1. REPLACE APPLICATION-FACING DEMO SEED RPC
-- ============================================================================

CREATE OR REPLACE FUNCTION public.seed_demo_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN

    PERFORM public.seed_comprehensive_demo_data();

END;
$$;


-- ============================================================================
-- 2. FUNCTION SECURITY
-- ============================================================================

REVOKE ALL
ON FUNCTION public.seed_demo_data()
FROM PUBLIC;


GRANT EXECUTE
ON FUNCTION public.seed_demo_data()
TO authenticated;


-- ============================================================================
-- 3. ENSURE COMPREHENSIVE SEED FUNCTION IS NOT PUBLIC
-- ============================================================================

REVOKE ALL
ON FUNCTION public.seed_comprehensive_demo_data()
FROM PUBLIC;


GRANT EXECUTE
ON FUNCTION public.seed_comprehensive_demo_data()
TO authenticated;


-- ============================================================================
-- 4. REFRESH POSTGREST SCHEMA CACHE
-- ============================================================================

NOTIFY pgrst, 'reload schema';


COMMIT;