/*
===============================================================================
ISF TRACKER — TREND PROCESSING SCHEMA REPAIR
Migration: 20260829020000_add_trend_processing_columns.sql

Purpose:
  Add the durable trend-processing state columns required by
  server/services/trendProcessingService.ts.

This migration is intentionally additive.
It does NOT modify or remove existing hormone readings.

Required by TrendProcessingService:
  - trend_processing_status
  - trend_processing_attempts
  - trend_processing_last_attempt_at
  - trend_processing_error
  - trend_processing_processed_at
===============================================================================
*/

BEGIN;


/* ============================================================================
   1. ADD TREND PROCESSING STATUS
   ========================================================================== */

ALTER TABLE public.hormone_readings
ADD COLUMN IF NOT EXISTS trend_processing_status text;


/* ============================================================================
   2. ADD RETRY ATTEMPT COUNTER
   ========================================================================== */

ALTER TABLE public.hormone_readings
ADD COLUMN IF NOT EXISTS trend_processing_attempts integer;


/* ============================================================================
   3. ADD LAST ATTEMPT TIMESTAMP
   ========================================================================== */

ALTER TABLE public.hormone_readings
ADD COLUMN IF NOT EXISTS trend_processing_last_attempt_at timestamptz;


/* ============================================================================
   4. ADD PROCESSING ERROR
   ========================================================================== */

ALTER TABLE public.hormone_readings
ADD COLUMN IF NOT EXISTS trend_processing_error text;


/* ============================================================================
   5. ADD SUCCESSFUL PROCESSING TIMESTAMP
   ========================================================================== */

ALTER TABLE public.hormone_readings
ADD COLUMN IF NOT EXISTS trend_processing_processed_at timestamptz;


/* ============================================================================
   6. INITIALIZE EXISTING READINGS
   ========================================================================== */

UPDATE public.hormone_readings
SET
    trend_processing_status = COALESCE(
        trend_processing_status,
        'pending'
    ),
    trend_processing_attempts = COALESCE(
        trend_processing_attempts,
        0
    )
WHERE
    trend_processing_status IS NULL
    OR trend_processing_attempts IS NULL;


/* ============================================================================
   7. SET SAFE DEFAULTS FOR FUTURE READINGS
   ========================================================================== */

ALTER TABLE public.hormone_readings
ALTER COLUMN trend_processing_status
SET DEFAULT 'pending';


ALTER TABLE public.hormone_readings
ALTER COLUMN trend_processing_attempts
SET DEFAULT 0;


/* ============================================================================
   8. ENFORCE REQUIRED VALUES
   ========================================================================== */

ALTER TABLE public.hormone_readings
ALTER COLUMN trend_processing_status
SET NOT NULL;


ALTER TABLE public.hormone_readings
ALTER COLUMN trend_processing_attempts
SET NOT NULL;


/* ============================================================================
   9. VALID STATUS VALUES
   ========================================================================== */

ALTER TABLE public.hormone_readings
DROP CONSTRAINT IF EXISTS hormone_readings_trend_processing_status_check;


ALTER TABLE public.hormone_readings
ADD CONSTRAINT hormone_readings_trend_processing_status_check
CHECK (
    trend_processing_status IN (
        'pending',
        'processing',
        'processed',
        'failed'
    )
);


/* ============================================================================
   10. SAFE ATTEMPT COUNTER
   ========================================================================== */

ALTER TABLE public.hormone_readings
DROP CONSTRAINT IF EXISTS hormone_readings_trend_processing_attempts_check;


ALTER TABLE public.hormone_readings
ADD CONSTRAINT hormone_readings_trend_processing_attempts_check
CHECK (
    trend_processing_attempts >= 0
);


/* ============================================================================
   11. INDEX FOR BACKGROUND PROCESSING
   ========================================================================== */

CREATE INDEX IF NOT EXISTS idx_hormone_readings_trend_processing
ON public.hormone_readings (
    trend_processing_status,
    trend_processing_attempts
);


/* ============================================================================
   12. INDEX FOR PROCESSING TIMELINES
   ========================================================================== */

CREATE INDEX IF NOT EXISTS idx_hormone_readings_trend_processing_last_attempt
ON public.hormone_readings (
    trend_processing_last_attempt_at
);


/* ============================================================================
   13. REFRESH POSTGREST SCHEMA CACHE
   ========================================================================== */

NOTIFY pgrst, 'reload schema';


COMMIT;