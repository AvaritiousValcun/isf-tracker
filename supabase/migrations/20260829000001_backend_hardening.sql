
-- ============================================================================
-- ISF TRACKER
-- BACKEND HARDENING / RECONCILIATION MIGRATION
-- Version: 1.1.0
-- Date: 2026-08-29
--
-- Purpose:
--   1. Canonical predictive consent handling
--   2. Predictive consent version enforcement
--   3. Reference-range boundary consistency
--   4. Durable trend-processing state
--   5. Database-enforced trend-event idempotency
--   6. Database-enforced active conversation uniqueness
--   7. Prediction-provider metadata / safety hardening
--
-- This migration is intentionally additive and defensive.
-- ============================================================================


-- ============================================================================
-- 0. PREDICTIVE CONSENT HARDENING
-- ============================================================================

-- The application currently uses version 1.0.
-- Keeping this value in the database gives the API one canonical version.
CREATE TABLE IF NOT EXISTS public.application_settings (
    key text PRIMARY KEY,
    value text NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.application_settings (
    key,
    value
)
VALUES (
    'predictive_consent_version',
    '1.0'
)
ON CONFLICT (key)
DO NOTHING;


-- Prevent more than one currently-granted predictive consent
-- from existing for the same patient.
CREATE UNIQUE INDEX IF NOT EXISTS
    idx_one_granted_predictive_consent_per_patient
ON public.predictive_consents(patient_user_id)
WHERE status = 'granted';


-- Make sure the consent version is never empty.
ALTER TABLE public.predictive_consents
DROP CONSTRAINT IF EXISTS predictive_consents_version_not_empty;

ALTER TABLE public.predictive_consents
ADD CONSTRAINT predictive_consents_version_not_empty
CHECK (
    length(trim(consent_version)) > 0
);


-- ============================================================================
-- 1. REFERENCE RANGE HARDENING
-- ============================================================================

-- The application uses a half-open validity interval:
--
--   effective_from <= now
--   AND
--   (effective_to IS NULL OR effective_to > now)
--
-- This means a range expires exactly at effective_to.
--
-- Existing rows are not rewritten here. The application is responsible
-- for consistently using the same boundary rule.


ALTER TABLE public.reference_ranges
DROP CONSTRAINT IF EXISTS reference_ranges_valid_dates;

ALTER TABLE public.reference_ranges
ADD CONSTRAINT reference_ranges_valid_dates
CHECK (
    effective_to IS NULL
    OR effective_to > effective_from
);


-- ============================================================================
-- 2. TREND PROCESSING DURABILITY
-- ============================================================================

-- A reading must be able to record whether trend processing has succeeded,
-- failed, or is waiting for a retry.
--
-- Existing applications can continue creating readings without explicitly
-- supplying these values because defaults are provided.

ALTER TABLE public.hormone_readings
ADD COLUMN IF NOT EXISTS trend_processing_status text
    NOT NULL DEFAULT 'pending';

ALTER TABLE public.hormone_readings
ADD COLUMN IF NOT EXISTS trend_processing_attempts integer
    NOT NULL DEFAULT 0;

ALTER TABLE public.hormone_readings
ADD COLUMN IF NOT EXISTS trend_processing_last_attempt_at timestamptz;

ALTER TABLE public.hormone_readings
ADD COLUMN IF NOT EXISTS trend_processing_processed_at timestamptz;

ALTER TABLE public.hormone_readings
ADD COLUMN IF NOT EXISTS trend_processing_error text;


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


ALTER TABLE public.hormone_readings
DROP CONSTRAINT IF EXISTS hormone_readings_trend_processing_attempts_check;

ALTER TABLE public.hormone_readings
ADD CONSTRAINT hormone_readings_trend_processing_attempts_check
CHECK (
    trend_processing_attempts >= 0
);


CREATE INDEX IF NOT EXISTS
    idx_hormone_readings_trend_processing
ON public.hormone_readings(
    trend_processing_status,
    received_at
);


-- ============================================================================
-- 3. TREND EVENT IDEMPOTENCY
-- ============================================================================

-- Existing data may contain duplicate NULL values, so the unique index
-- deliberately applies only where a deduplication key exists.

CREATE UNIQUE INDEX IF NOT EXISTS
    idx_trend_events_unique_deduplication_key
ON public.trend_events(
    patient_user_id,
    deduplication_key
)
WHERE deduplication_key IS NOT NULL;


-- ============================================================================
-- 4. ACTIVE CONVERSATION CONCURRENCY
-- ============================================================================

-- The application should have at most one active conversation between
-- a patient and consultant.
--
-- This database constraint is the final authority and protects against
-- two simultaneous requests both seeing "no conversation" and creating
-- duplicates.

CREATE UNIQUE INDEX IF NOT EXISTS
    idx_one_active_conversation_patient_consultant
ON public.conversations(
    patient_user_id,
    consultant_id
)
WHERE status = 'active';


-- ============================================================================
-- 5. PREDICTION PROVIDER METADATA
-- ============================================================================

-- These columns make the provider/model identity explicit in stored
-- prediction records.

ALTER TABLE public.predictions
ADD COLUMN IF NOT EXISTS provider_id text
    NOT NULL DEFAULT 'demo';

ALTER TABLE public.predictions
ADD COLUMN IF NOT EXISTS provider_environment text
    NOT NULL DEFAULT 'demo';


ALTER TABLE public.predictions
DROP CONSTRAINT IF EXISTS predictions_provider_environment_check;

ALTER TABLE public.predictions
ADD CONSTRAINT predictions_provider_environment_check
CHECK (
    provider_environment IN (
        'demo',
        'production'
    )
);


-- ============================================================================
-- 6. AUDIT INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS
    idx_audit_logs_patient_created
ON public.audit_logs(
    patient_user_id,
    created_at DESC
);


-- ============================================================================
-- 7. COMPLETE
-- ============================================================================

COMMENT ON TABLE public.application_settings IS
    'Canonical application-level configuration values.';

COMMENT ON COLUMN public.hormone_readings.trend_processing_status IS
    'Durable state of asynchronous trend processing.';

COMMENT ON COLUMN public.predictions.provider_id IS
    'Identifier of the prediction provider that generated the record.';

COMMENT ON COLUMN public.predictions.provider_environment IS
    'Execution environment of the prediction provider: demo or production.';

