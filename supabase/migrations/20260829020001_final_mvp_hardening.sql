BEGIN;

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

INSERT INTO public.application_settings (
    key,
    value
)
VALUES (
    'premium_monthly_price_kes',
    '250'
)
ON CONFLICT (key)
DO NOTHING;

INSERT INTO public.application_settings (
    key,
    value
)
VALUES (
    'free_message_limit',
    '50'
)
ON CONFLICT (key)
DO NOTHING;

CREATE UNIQUE INDEX IF NOT EXISTS
    idx_one_granted_predictive_consent_per_patient
ON public.predictive_consents(patient_user_id)
WHERE status = 'granted';

ALTER TABLE public.predictive_consents
DROP CONSTRAINT IF EXISTS predictive_consents_version_not_empty;

ALTER TABLE public.predictive_consents
ADD CONSTRAINT predictive_consents_version_not_empty
CHECK (
    length(trim(consent_version)) > 0
);

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

CREATE UNIQUE INDEX IF NOT EXISTS
    idx_trend_events_unique_deduplication_key
ON public.trend_events(
    patient_user_id,
    deduplication_key
)
WHERE deduplication_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS
    idx_one_active_conversation_patient_consultant
ON public.conversations(
    patient_user_id,
    consultant_id
)
WHERE status = 'active';

CREATE UNIQUE INDEX IF NOT EXISTS
    idx_unique_trend_alert_message_key
ON public.messages(
    (metadata ->> 'trend_alert_key')
)
WHERE message_type = 'trend_alert'
AND metadata ->> 'trend_alert_key' IS NOT NULL;

ALTER TABLE public.predictions
ADD COLUMN IF NOT EXISTS provider_id text
    NOT NULL DEFAULT 'demo-prediction-provider';

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

UPDATE public.predictions
SET condition = 'pmos_pcos'
WHERE condition = 'pcos';

UPDATE public.predictions
SET provider_id = COALESCE(
    provider_id,
    'demo-prediction-provider'
)
WHERE provider_id IS NULL;

UPDATE public.predictions
SET provider_environment = COALESCE(
    provider_environment,
    'demo'
)
WHERE provider_environment IS NULL;

UPDATE public.payments
SET amount = 250
WHERE provider = 'demo_gateway'
AND provider_reference LIKE 'DEMO-PAY-V2-%';

CREATE INDEX IF NOT EXISTS
    idx_audit_logs_patient_created
ON public.audit_logs(
    patient_user_id,
    created_at DESC
);

CREATE OR REPLACE FUNCTION public.get_patient_message_usage(
    p_patient_user_id uuid
)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT COUNT(*)::integer
    FROM public.messages m
    INNER JOIN public.conversations c
        ON c.id = m.conversation_id
    WHERE c.patient_user_id = p_patient_user_id
      AND m.sender_type = 'patient';
$$;

REVOKE ALL
ON FUNCTION public.get_patient_message_usage(uuid)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.get_patient_message_usage(uuid)
TO authenticated;

CREATE OR REPLACE FUNCTION public.get_patient_message_limit()
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT COALESCE(
        (
            SELECT value::integer
            FROM public.application_settings
            WHERE key = 'free_message_limit'
        ),
        50
    );
$$;

REVOKE ALL
ON FUNCTION public.get_patient_message_limit()
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.get_patient_message_limit()
TO authenticated;

COMMENT ON FUNCTION public.get_patient_message_usage(uuid)
IS
    'Returns the number of patient-authored consultant chat messages.';

COMMENT ON FUNCTION public.get_patient_message_limit()
IS
    'Returns the canonical Free-plan consultant message limit.';

COMMENT ON TABLE public.application_settings
IS
    'Canonical ISF Tracker application configuration.';

NOTIFY pgrst, 'reload schema';

COMMIT;