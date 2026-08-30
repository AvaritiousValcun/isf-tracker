-- ============================================================================
-- ISF TRACKER
-- FINAL DATABASE RECONCILIATION MIGRATION
-- Version: 1.0.0
--
-- Purpose:
--   Reconcile the existing Supabase database with the ISF Tracker backend.
--
-- IMPORTANT:
--   This migration is designed for the existing ISF Tracker database.
--   It does NOT recreate the entire database from scratch.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 0. REQUIRED EXTENSIONS
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- ============================================================================
-- 1. PROFILES
--
-- The backend authentication layer expects a canonical public.profiles table.
-- This table mirrors auth.users and stores application-level identity/role.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE,
    full_name TEXT,
    first_name TEXT,
    last_name TEXT,
    language TEXT NOT NULL DEFAULT 'en'
        CHECK (language IN ('en', 'sw')),
    role TEXT NOT NULL DEFAULT 'patient'
        CHECK (role IN ('patient', 'consultant', 'admin')),
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_role
    ON public.profiles(role);

CREATE INDEX IF NOT EXISTS idx_profiles_email
    ON public.profiles(email);


-- ============================================================================
-- 2. PROFILE AUTO-CREATION TRIGGER
--
-- Creates a profile automatically whenever a Supabase auth user is created.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN

    INSERT INTO public.profiles (
        id,
        email,
        full_name,
        first_name,
        last_name
    )
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(
            NEW.raw_user_meta_data ->> 'full_name',
            NEW.raw_user_meta_data ->> 'name',
            ''
        ),
        NEW.raw_user_meta_data ->> 'first_name',
        NEW.raw_user_meta_data ->> 'last_name'
    )
    ON CONFLICT (id) DO NOTHING;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created
ON auth.users;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();


-- ============================================================================
-- 3. BACKFILL PROFILES FOR EXISTING USERS
-- ============================================================================

INSERT INTO public.profiles (
    id,
    email,
    full_name
)
SELECT
    u.id,
    u.email,
    COALESCE(
        u.raw_user_meta_data ->> 'full_name',
        u.raw_user_meta_data ->> 'name',
        ''
    )
FROM auth.users u
ON CONFLICT (id) DO NOTHING;


-- ============================================================================
-- 4. PATIENT PROFILES
--
-- Ensure patient_profiles has the expected structure.
-- ============================================================================

ALTER TABLE public.patient_profiles
    ADD COLUMN IF NOT EXISTS date_of_birth DATE;

ALTER TABLE public.patient_profiles
    ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'en';

ALTER TABLE public.patient_profiles
    ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'Africa/Nairobi';

ALTER TABLE public.patient_profiles
    ADD COLUMN IF NOT EXISTS weight_kg NUMERIC;

ALTER TABLE public.patient_profiles
    ADD COLUMN IF NOT EXISTS patient_reference TEXT;

ALTER TABLE public.patient_profiles
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE public.patient_profiles
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS idx_patient_profiles_reference
    ON public.patient_profiles(patient_reference)
    WHERE patient_reference IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_patient_profiles_user
    ON public.patient_profiles(user_id);


-- ============================================================================
-- 5. CONSULTANTS
-- ============================================================================

ALTER TABLE public.consultants
    ADD COLUMN IF NOT EXISTS user_id UUID;

ALTER TABLE public.consultants
    ADD COLUMN IF NOT EXISTS full_name TEXT;

ALTER TABLE public.consultants
    ADD COLUMN IF NOT EXISTS professional_type TEXT;

ALTER TABLE public.consultants
    ADD COLUMN IF NOT EXISTS license_reference TEXT;

ALTER TABLE public.consultants
    ADD COLUMN IF NOT EXISTS organization TEXT;

ALTER TABLE public.consultants
    ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

ALTER TABLE public.consultants
    ADD COLUMN IF NOT EXISTS initials TEXT;

ALTER TABLE public.consultants
    ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#2C4C5C';

ALTER TABLE public.consultants
    ADD COLUMN IF NOT EXISTS online BOOLEAN DEFAULT false;

ALTER TABLE public.consultants
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE public.consultants
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_consultants_user
    ON public.consultants(user_id);

CREATE INDEX IF NOT EXISTS idx_consultants_status
    ON public.consultants(status);


-- ============================================================================
-- 6. PATIENT-CONSULTANT RELATIONSHIPS
-- ============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS uq_patient_consultant
    ON public.patient_consultants(patient_user_id, consultant_id)
    WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_patient_consultants_patient
    ON public.patient_consultants(patient_user_id);

CREATE INDEX IF NOT EXISTS idx_patient_consultants_consultant
    ON public.patient_consultants(consultant_id);


-- ============================================================================
-- 7. CONSENT RECORDS
--
-- Add an immutable numeric version used for concurrency-safe allocation.
-- Existing consent_version is retained for application compatibility.
-- ============================================================================

ALTER TABLE public.consent_records
    ADD COLUMN IF NOT EXISTS version INTEGER;

UPDATE public.consent_records
SET version = CASE
    WHEN consent_version ~ '^[0-9]+$'
        THEN consent_version::INTEGER
    ELSE 1
END
WHERE version IS NULL;

ALTER TABLE public.consent_records
    ALTER COLUMN version SET DEFAULT 1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_consent_patient_consultant_version
    ON public.consent_records(
        patient_user_id,
        consultant_id,
        version
    );


CREATE INDEX IF NOT EXISTS idx_consents_patient
    ON public.consent_records(patient_user_id);

CREATE INDEX IF NOT EXISTS idx_consents_consultant
    ON public.consent_records(consultant_id);


-- ============================================================================
-- 8. PATCHES
-- ============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS uq_patches_serial
    ON public.patches(serial_number);

CREATE INDEX IF NOT EXISTS idx_patches_status
    ON public.patches(status);


-- ============================================================================
-- 9. PATIENT PATCHES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_patient_patches_patient
    ON public.patient_patches(patient_user_id);

CREATE INDEX IF NOT EXISTS idx_patient_patches_patch
    ON public.patient_patches(patch_id);

CREATE INDEX IF NOT EXISTS idx_patient_patches_status
    ON public.patient_patches(patient_user_id, status);


-- ============================================================================
-- 10. HORMONE READINGS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_hormone_readings_patient_time
    ON public.hormone_readings(
        patient_user_id,
        recorded_at DESC
    );

CREATE INDEX IF NOT EXISTS idx_hormone_readings_patch
    ON public.hormone_readings(patch_id);

CREATE INDEX IF NOT EXISTS idx_hormone_readings_quality
    ON public.hormone_readings(
        patient_user_id,
        quality_status
    );


-- ============================================================================
-- 11. REFERENCE RANGES
--
-- Required by generate_predictions().
-- ============================================================================

ALTER TABLE public.reference_ranges
    ADD COLUMN IF NOT EXISTS effective_from TIMESTAMPTZ DEFAULT now();

ALTER TABLE public.reference_ranges
    ADD COLUMN IF NOT EXISTS effective_to TIMESTAMPTZ;

ALTER TABLE public.reference_ranges
    ADD COLUMN IF NOT EXISTS version TEXT DEFAULT '1.0';

CREATE INDEX IF NOT EXISTS idx_reference_ranges_hormone_effective
    ON public.reference_ranges(
        hormone,
        effective_from DESC
    );


-- ============================================================================
-- 12. TREND EVENTS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_trend_events_patient_status
    ON public.trend_events(
        patient_user_id,
        status
    );

CREATE INDEX IF NOT EXISTS idx_trend_events_patient_time
    ON public.trend_events(
        patient_user_id,
        created_at DESC
    );


-- ============================================================================
-- 13. NOTIFICATIONS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_notifications_patient
    ON public.notifications(
        patient_user_id,
        created_at DESC
    );

CREATE INDEX IF NOT EXISTS idx_notifications_consultant
    ON public.notifications(
        consultant_id,
        created_at DESC
    );


-- ============================================================================
-- 14. CONVERSATIONS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_conversations_patient
    ON public.conversations(patient_user_id);

CREATE INDEX IF NOT EXISTS idx_conversations_consultant
    ON public.conversations(consultant_id);

CREATE INDEX IF NOT EXISTS idx_conversations_updated
    ON public.conversations(updated_at DESC);


-- ============================================================================
-- 15. MESSAGES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_messages_conversation_time
    ON public.messages(
        conversation_id,
        created_at
    );


-- ============================================================================
-- 16. PREDICTIVE CONSENTS
-- ============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS uq_predictive_consent_patient_version
    ON public.predictive_consents(
        patient_user_id,
        consent_version
    );

CREATE INDEX IF NOT EXISTS idx_predictive_consents_patient
    ON public.predictive_consents(
        patient_user_id,
        granted_at DESC
    );


-- ============================================================================
-- 17. PREDICTIONS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_predictions_patient_condition
    ON public.predictions(
        patient_user_id,
        condition
    );

CREATE INDEX IF NOT EXISTS idx_predictions_patient_calculated
    ON public.predictions(
        patient_user_id,
        calculated_at DESC
    );


-- ============================================================================
-- 18. SUBSCRIPTIONS
-- ============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS uq_subscription_patient
    ON public.subscriptions(patient_user_id);

CREATE INDEX IF NOT EXISTS idx_subscriptions_status
    ON public.subscriptions(status);


-- ============================================================================
-- 19. PAYMENTS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_payments_subscription
    ON public.payments(subscription_id);

CREATE INDEX IF NOT EXISTS idx_payments_provider_reference
    ON public.payments(provider, provider_reference);


-- ============================================================================
-- 20. TEMPORARY ACCESS TOKENS
-- ============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS uq_temp_access_token_hash
    ON public.temporary_access_tokens(token_hash);

CREATE INDEX IF NOT EXISTS idx_temp_access_patient
    ON public.temporary_access_tokens(patient_user_id);

CREATE INDEX IF NOT EXISTS idx_temp_access_expiry
    ON public.temporary_access_tokens(expires_at);


-- ============================================================================
-- 21. AUDIT LOGS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_audit_logs_patient_time
    ON public.audit_logs(
        patient_user_id,
        created_at DESC
    );

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_time
    ON public.audit_logs(
        actor_user_id,
        created_at DESC
    );


-- ============================================================================
-- 22. ENABLE RLS
-- ============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_consultants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consent_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_patches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hormone_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reference_ranges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trend_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.predictive_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.temporary_access_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;


-- ============================================================================
-- 23. PROFILES RLS
-- ============================================================================

DROP POLICY IF EXISTS profiles_select_own
ON public.profiles;

CREATE POLICY profiles_select_own
ON public.profiles
FOR SELECT
TO authenticated
USING (
    id = auth.uid()
);

DROP POLICY IF EXISTS profiles_update_own
ON public.profiles;

CREATE POLICY profiles_update_own
ON public.profiles
FOR UPDATE
TO authenticated
USING (
    id = auth.uid()
)
WITH CHECK (
    id = auth.uid()
);


-- ============================================================================
-- 24. PATIENT PROFILE RLS
-- ============================================================================

DROP POLICY IF EXISTS patient_profiles_select_own
ON public.patient_profiles;

CREATE POLICY patient_profiles_select_own
ON public.patient_profiles
FOR SELECT
TO authenticated
USING (
    user_id = auth.uid()
);

DROP POLICY IF EXISTS patient_profiles_insert_own
ON public.patient_profiles;

CREATE POLICY patient_profiles_insert_own
ON public.patient_profiles
FOR INSERT
TO authenticated
WITH CHECK (
    user_id = auth.uid()
);

DROP POLICY IF EXISTS patient_profiles_update_own
ON public.patient_profiles;

CREATE POLICY patient_profiles_update_own
ON public.patient_profiles
FOR UPDATE
TO authenticated
USING (
    user_id = auth.uid()
)
WITH CHECK (
    user_id = auth.uid()
);


-- ============================================================================
-- 25. CONSULTANT RLS
-- ============================================================================

DROP POLICY IF EXISTS consultants_select_allowed
ON public.consultants;

CREATE POLICY consultants_select_allowed
ON public.consultants
FOR SELECT
TO authenticated
USING (
    user_id = auth.uid()
    OR EXISTS (
        SELECT 1
        FROM public.patient_consultants pc
        WHERE pc.consultant_id = consultants.id
          AND pc.patient_user_id = auth.uid()
          AND pc.status = 'active'
    )
);


-- ============================================================================
-- 26. PATIENT-CONSULTANT RLS
-- ============================================================================

DROP POLICY IF EXISTS patient_consultants_select_allowed
ON public.patient_consultants;

CREATE POLICY patient_consultants_select_allowed
ON public.patient_consultants
FOR SELECT
TO authenticated
USING (
    patient_user_id = auth.uid()
    OR EXISTS (
        SELECT 1
        FROM public.consultants c
        WHERE c.id = patient_consultants.consultant_id
          AND c.user_id = auth.uid()
    )
);

DROP POLICY IF EXISTS patient_consultants_insert_own
ON public.patient_consultants;

CREATE POLICY patient_consultants_insert_own
ON public.patient_consultants
FOR INSERT
TO authenticated
WITH CHECK (
    patient_user_id = auth.uid()
);

DROP POLICY IF EXISTS patient_consultants_update_own
ON public.patient_consultants;

CREATE POLICY patient_consultants_update_own
ON public.patient_consultants
FOR UPDATE
TO authenticated
USING (
    patient_user_id = auth.uid()
)
WITH CHECK (
    patient_user_id = auth.uid()
);


-- ============================================================================
-- 27. CONSENT RLS
-- ============================================================================

DROP POLICY IF EXISTS consent_records_select_own
ON public.consent_records;

CREATE POLICY consent_records_select_own
ON public.consent_records
FOR SELECT
TO authenticated
USING (
    patient_user_id = auth.uid()
    OR EXISTS (
        SELECT 1
        FROM public.consultants c
        JOIN public.patient_consultants pc
          ON pc.consultant_id = c.id
        WHERE c.user_id = auth.uid()
          AND pc.patient_user_id = consent_records.patient_user_id
          AND pc.status = 'active'
          AND consent_records.consultant_id = c.id
    )
);

DROP POLICY IF EXISTS consent_records_insert_own
ON public.consent_records;

CREATE POLICY consent_records_insert_own
ON public.consent_records
FOR INSERT
TO authenticated
WITH CHECK (
    patient_user_id = auth.uid()
);


-- ============================================================================
-- 28. PATCH RLS
-- ============================================================================

DROP POLICY IF EXISTS patches_select_own
ON public.patches;

CREATE POLICY patches_select_own
ON public.patches
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.patient_patches pp
        WHERE pp.patch_id = patches.id
          AND pp.patient_user_id = auth.uid()
    )
);


-- ============================================================================
-- 29. PATIENT PATCH RLS
-- ============================================================================

DROP POLICY IF EXISTS patient_patches_select_own
ON public.patient_patches;

CREATE POLICY patient_patches_select_own
ON public.patient_patches
FOR SELECT
TO authenticated
USING (
    patient_user_id = auth.uid()
);

DROP POLICY IF EXISTS patient_patches_insert_own
ON public.patient_patches;

CREATE POLICY patient_patches_insert_own
ON public.patient_patches
FOR INSERT
TO authenticated
WITH CHECK (
    patient_user_id = auth.uid()
);

DROP POLICY IF EXISTS patient_patches_update_own
ON public.patient_patches;

CREATE POLICY patient_patches_update_own
ON public.patient_patches
FOR UPDATE
TO authenticated
USING (
    patient_user_id = auth.uid()
)
WITH CHECK (
    patient_user_id = auth.uid()
);


-- ============================================================================
-- 30. HORMONE READINGS RLS
-- ============================================================================

DROP POLICY IF EXISTS hormone_readings_select_own
ON public.hormone_readings;

CREATE POLICY hormone_readings_select_own
ON public.hormone_readings
FOR SELECT
TO authenticated
USING (
    patient_user_id = auth.uid()
);

DROP POLICY IF EXISTS hormone_readings_insert_own
ON public.hormone_readings;

CREATE POLICY hormone_readings_insert_own
ON public.hormone_readings
FOR INSERT
TO authenticated
WITH CHECK (
    patient_user_id = auth.uid()
);


-- ============================================================================
-- 31. REFERENCE RANGE RLS
-- ============================================================================

DROP POLICY IF EXISTS reference_ranges_select_authenticated
ON public.reference_ranges;

CREATE POLICY reference_ranges_select_authenticated
ON public.reference_ranges
FOR SELECT
TO authenticated
USING (true);


-- ============================================================================
-- 32. TREND EVENT RLS
-- ============================================================================

DROP POLICY IF EXISTS trend_events_select_own
ON public.trend_events;

CREATE POLICY trend_events_select_own
ON public.trend_events
FOR SELECT
TO authenticated
USING (
    patient_user_id = auth.uid()
);

DROP POLICY IF EXISTS trend_events_insert_own
ON public.trend_events;

CREATE POLICY trend_events_insert_own
ON public.trend_events
FOR INSERT
TO authenticated
WITH CHECK (
    patient_user_id = auth.uid()
);


-- ============================================================================
-- 33. NOTIFICATIONS RLS
-- ============================================================================

DROP POLICY IF EXISTS notifications_select_own
ON public.notifications;

CREATE POLICY notifications_select_own
ON public.notifications
FOR SELECT
TO authenticated
USING (
    patient_user_id = auth.uid()
    OR EXISTS (
        SELECT 1
        FROM public.consultants c
        WHERE c.id = notifications.consultant_id
          AND c.user_id = auth.uid()
    )
);


-- ============================================================================
-- 34. CONVERSATION RLS
-- ============================================================================

DROP POLICY IF EXISTS conversations_select_allowed
ON public.conversations;

CREATE POLICY conversations_select_allowed
ON public.conversations
FOR SELECT
TO authenticated
USING (
    patient_user_id = auth.uid()
    OR EXISTS (
        SELECT 1
        FROM public.consultants c
        WHERE c.id = conversations.consultant_id
          AND c.user_id = auth.uid()
    )
);

DROP POLICY IF EXISTS conversations_insert_patient
ON public.conversations;

CREATE POLICY conversations_insert_patient
ON public.conversations
FOR INSERT
TO authenticated
WITH CHECK (
    patient_user_id = auth.uid()
);


-- ============================================================================
-- 35. MESSAGE RLS
-- ============================================================================

DROP POLICY IF EXISTS messages_select_allowed
ON public.messages;

CREATE POLICY messages_select_allowed
ON public.messages
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.conversations c
        WHERE c.id = messages.conversation_id
          AND (
              c.patient_user_id = auth.uid()
              OR EXISTS (
                  SELECT 1
                  FROM public.consultants co
                  WHERE co.id = c.consultant_id
                    AND co.user_id = auth.uid()
              )
          )
    )
);

DROP POLICY IF EXISTS messages_insert_patient
ON public.messages;

CREATE POLICY messages_insert_patient
ON public.messages
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.conversations c
        WHERE c.id = messages.conversation_id
          AND c.patient_user_id = auth.uid()
    )
);


-- ============================================================================
-- 36. PREDICTIVE CONSENT RLS
-- ============================================================================

DROP POLICY IF EXISTS predictive_consents_select_own
ON public.predictive_consents;

CREATE POLICY predictive_consents_select_own
ON public.predictive_consents
FOR SELECT
TO authenticated
USING (
    patient_user_id = auth.uid()
);

DROP POLICY IF EXISTS predictive_consents_insert_own
ON public.predictive_consents;

CREATE POLICY predictive_consents_insert_own
ON public.predictive_consents
FOR INSERT
TO authenticated
WITH CHECK (
    patient_user_id = auth.uid()
);


-- ============================================================================
-- 37. PREDICTIONS RLS
-- ============================================================================

DROP POLICY IF EXISTS predictions_select_own
ON public.predictions;

CREATE POLICY predictions_select_own
ON public.predictions
FOR SELECT
TO authenticated
USING (
    patient_user_id = auth.uid()
);


-- ============================================================================
-- 38. SUBSCRIPTIONS RLS
-- ============================================================================

DROP POLICY IF EXISTS subscriptions_select_own
ON public.subscriptions;

CREATE POLICY subscriptions_select_own
ON public.subscriptions
FOR SELECT
TO authenticated
USING (
    patient_user_id = auth.uid()
);


-- ============================================================================
-- 39. PAYMENTS RLS
-- ============================================================================

DROP POLICY IF EXISTS payments_select_own
ON public.payments;

CREATE POLICY payments_select_own
ON public.payments
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.subscriptions s
        WHERE s.id = payments.subscription_id
          AND s.patient_user_id = auth.uid()
    )
);


-- ============================================================================
-- 40. TEMPORARY ACCESS TOKENS
-- ============================================================================

DROP POLICY IF EXISTS temp_access_select_own
ON public.temporary_access_tokens;

CREATE POLICY temp_access_select_own
ON public.temporary_access_tokens
FOR SELECT
TO authenticated
USING (
    patient_user_id = auth.uid()
);

DROP POLICY IF EXISTS temp_access_insert_own
ON public.temporary_access_tokens;

CREATE POLICY temp_access_insert_own
ON public.temporary_access_tokens
FOR INSERT
TO authenticated
WITH CHECK (
    patient_user_id = auth.uid()
);


-- ============================================================================
-- 41. AUDIT LOG RLS
-- ============================================================================

DROP POLICY IF EXISTS audit_logs_select_own
ON public.audit_logs;

CREATE POLICY audit_logs_select_own
ON public.audit_logs
FOR SELECT
TO authenticated
USING (
    patient_user_id = auth.uid()
    OR actor_user_id = auth.uid()
);


-- ============================================================================
-- 42. IMMUTABLE AUDIT LOGS
--
-- Audit records must never be modified or deleted.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.prevent_audit_log_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'Audit logs are immutable.';
END;
$$;

DROP TRIGGER IF EXISTS audit_logs_immutable_update
ON public.audit_logs;

CREATE TRIGGER audit_logs_immutable_update
BEFORE UPDATE ON public.audit_logs
FOR EACH ROW
EXECUTE FUNCTION public.prevent_audit_log_mutation();

DROP TRIGGER IF EXISTS audit_logs_immutable_delete
ON public.audit_logs;

CREATE TRIGGER audit_logs_immutable_delete
BEFORE DELETE ON public.audit_logs
FOR EACH ROW
EXECUTE FUNCTION public.prevent_audit_log_mutation();


-- ============================================================================
-- 43. PREDICTIONS FUNCTION
--
-- Recreate the prediction function against the actual canonical tables.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.generate_predictions()
RETURNS SETOF public.predictions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_uid UUID;

    v_reading_count INTEGER;
    v_avg_androgen NUMERIC;
    v_avg_progesterone NUMERIC;

    v_androgen_abnormal NUMERIC DEFAULT 0;
    v_progesterone_abnormal NUMERIC DEFAULT 0;

    v_pcos_score NUMERIC;
    v_diabetes_score NUMERIC;
    v_insulin_score NUMERIC;
    v_bp_score NUMERIC;
    v_endometrial_score NUMERIC;

    v_score NUMERIC;
    v_category TEXT;
    v_explanation JSONB;
BEGIN

    v_uid := auth.uid();

    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: caller must be authenticated.';
    END IF;

    -- Require active predictive consent.
    IF NOT EXISTS (
        SELECT 1
        FROM public.predictive_consents
        WHERE patient_user_id = v_uid
          AND status = 'granted'
        ORDER BY granted_at DESC
        LIMIT 1
    ) THEN
        RAISE EXCEPTION
            'Predictive analysis requires active consent.';
    END IF;

    -- Read latest valid readings.
    SELECT
        COUNT(*),
        AVG(androgen_value),
        AVG(progesterone_value)
    INTO
        v_reading_count,
        v_avg_androgen,
        v_avg_progesterone
    FROM (
        SELECT
            androgen_value,
            progesterone_value
        FROM public.hormone_readings
        WHERE patient_user_id = v_uid
          AND quality_status = 'valid'
        ORDER BY recorded_at DESC
        LIMIT 30
    ) recent;

    IF v_reading_count < 3 THEN
        RAISE EXCEPTION
            'At least 3 valid hormone readings are required for predictive analysis.';
    END IF;

    -- Androgen reference range.
    SELECT
        CASE
            WHEN v_avg_androgen < rr.lower_normal THEN
                LEAST(
                    100,
                    ((rr.lower_normal - v_avg_androgen)
                    / NULLIF(rr.lower_normal, 0)) * 100
                )
            WHEN v_avg_androgen > rr.upper_normal THEN
                LEAST(
                    100,
                    ((v_avg_androgen - rr.upper_normal)
                    / NULLIF(rr.upper_normal, 0)) * 100
                )
            ELSE 0
        END
    INTO v_androgen_abnormal
    FROM public.reference_ranges rr
    WHERE rr.hormone = 'androgen'
      AND rr.effective_from <= now()
      AND (
          rr.effective_to IS NULL
          OR rr.effective_to > now()
      )
    ORDER BY rr.effective_from DESC
    LIMIT 1;

    -- Progesterone reference range.
    SELECT
        CASE
            WHEN v_avg_progesterone < rr.lower_normal THEN
                LEAST(
                    100,
                    ((rr.lower_normal - v_avg_progesterone)
                    / NULLIF(rr.lower_normal, 0)) * 100
                )
            WHEN v_avg_progesterone > rr.upper_normal THEN
                LEAST(
                    100,
                    ((v_avg_progesterone - rr.upper_normal)
                    / NULLIF(rr.upper_normal, 0)) * 100
                )
            ELSE 0
        END
    INTO v_progesterone_abnormal
    FROM public.reference_ranges rr
    WHERE rr.hormone = 'progesterone'
      AND rr.effective_from <= now()
      AND (
          rr.effective_to IS NULL
          OR rr.effective_to > now()
      )
    ORDER BY rr.effective_from DESC
    LIMIT 1;

    v_androgen_abnormal :=
        COALESCE(v_androgen_abnormal, 0);

    v_progesterone_abnormal :=
        COALESCE(v_progesterone_abnormal, 0);

    -- Prototype heuristic scores.
    v_pcos_score :=
        LEAST(
            100,
            20
            + (v_androgen_abnormal * 0.65)
            + (v_progesterone_abnormal * 0.15)
        );

    v_diabetes_score :=
        LEAST(
            100,
            15
            + (v_androgen_abnormal * 0.25)
            + (v_progesterone_abnormal * 0.25)
        );

    v_insulin_score :=
        LEAST(
            100,
            15
            + (v_androgen_abnormal * 0.35)
            + (v_progesterone_abnormal * 0.20)
        );

    v_bp_score :=
        LEAST(
            100,
            10
            + (v_androgen_abnormal * 0.15)
            + (v_progesterone_abnormal * 0.15)
        );

    v_endometrial_score :=
        LEAST(
            100,
            10
            + (v_androgen_abnormal * 0.20)
            + (v_progesterone_abnormal * 0.45)
        );

    /*
     * Remove previous predictions for this patient.
     * These are prototype predictions, not historical clinical records.
     */
    DELETE FROM public.predictions
    WHERE patient_user_id = v_uid;

    v_explanation := jsonb_build_object(
        'type', 'prototype_heuristic',
        'not_clinically_validated', true,
        'reading_count', v_reading_count,
        'average_androgen', ROUND(v_avg_androgen, 2),
        'average_progesterone', ROUND(v_avg_progesterone, 2),
        'androgen_abnormality', ROUND(v_androgen_abnormal, 2),
        'progesterone_abnormality',
            ROUND(v_progesterone_abnormal, 2)
    );

    -- PCOS
    v_score := ROUND(v_pcos_score, 1);

    v_category :=
        CASE
            WHEN v_score < 25 THEN 'low'
            WHEN v_score < 50 THEN 'moderate'
            WHEN v_score < 75 THEN 'elevated'
            ELSE 'high'
        END;

    INSERT INTO public.predictions (
        patient_user_id,
        condition,
        risk_category,
        risk_percentage,
        model_id,
        model_version,
        feature_version,
        calculated_at,
        expires_at,
        explanation,
        trend
    )
    VALUES (
        v_uid,
        'pcos',
        v_category,
        v_score,
        'isf-prototype-v1',
        '1.0',
        '1.0',
        now(),
        now() + interval '7 days',
        v_explanation,
        CASE
            WHEN v_androgen_abnormal > 25
                THEN 'increasing'
            ELSE 'stable'
        END
    );

    -- Type 2 diabetes
    v_score := ROUND(v_diabetes_score, 1);

    v_category :=
        CASE
            WHEN v_score < 25 THEN 'low'
            WHEN v_score < 50 THEN 'moderate'
            WHEN v_score < 75 THEN 'elevated'
            ELSE 'high'
        END;

    INSERT INTO public.predictions (
        patient_user_id,
        condition,
        risk_category,
        risk_percentage,
        model_id,
        model_version,
        feature_version,
        calculated_at,
        expires_at,
        explanation,
        trend
    )
    VALUES (
        v_uid,
        'type_2_diabetes',
        v_category,
        v_score,
        'isf-prototype-v1',
        '1.0',
        '1.0',
        now(),
        now() + interval '7 days',
        v_explanation,
        'stable'
    );

    -- Insulin resistance
    v_score := ROUND(v_insulin_score, 1);

    v_category :=
        CASE
            WHEN v_score < 25 THEN 'low'
            WHEN v_score < 50 THEN 'moderate'
            WHEN v_score < 75 THEN 'elevated'
            ELSE 'high'
        END;

    INSERT INTO public.predictions (
        patient_user_id,
        condition,
        risk_category,
        risk_percentage,
        model_id,
        model_version,
        feature_version,
        calculated_at,
        expires_at,
        explanation,
        trend
    )
    VALUES (
        v_uid,
        'insulin_resistance',
        v_category,
        v_score,
        'isf-prototype-v1',
        '1.0',
        '1.0',
        now(),
        now() + interval '7 days',
        v_explanation,
        'stable'
    );

    -- High blood pressure
    v_score := ROUND(v_bp_score, 1);

    v_category :=
        CASE
            WHEN v_score < 25 THEN 'low'
            WHEN v_score < 50 THEN 'moderate'
            WHEN v_score < 75 THEN 'elevated'
            ELSE 'high'
        END;

    INSERT INTO public.predictions (
        patient_user_id,
        condition,
        risk_category,
        risk_percentage,
        model_id,
        model_version,
        feature_version,
        calculated_at,
        expires_at,
        explanation,
        trend
    )
    VALUES (
        v_uid,
        'high_blood_pressure',
        v_category,
        v_score,
        'isf-prototype-v1',
        '1.0',
        '1.0',
        now(),
        now() + interval '7 days',
        v_explanation,
        'stable'
    );

    -- Endometrial cancer
    v_score := ROUND(v_endometrial_score, 1);

    v_category :=
        CASE
            WHEN v_score < 25 THEN 'low'
            WHEN v_score < 50 THEN 'moderate'
            WHEN v_score < 75 THEN 'elevated'
            ELSE 'high'
        END;

    INSERT INTO public.predictions (
        patient_user_id,
        condition,
        risk_category,
        risk_percentage,
        model_id,
        model_version,
        feature_version,
        calculated_at,
        expires_at,
        explanation,
        trend
    )
    VALUES (
        v_uid,
        'endometrial_cancer',
        v_category,
        v_score,
        'isf-prototype-v1',
        '1.0',
        '1.0',
        now(),
        now() + interval '7 days',
        v_explanation,
        'stable'
    );

    RETURN QUERY
    SELECT *
    FROM public.predictions
    WHERE patient_user_id = v_uid
    ORDER BY calculated_at DESC;

END;
$$;


REVOKE ALL
ON FUNCTION public.generate_predictions()
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.generate_predictions()
TO authenticated;


-- ============================================================================
-- 44. DEMO SEED FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.seed_demo_data()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_uid UUID;
    v_patch_id UUID;
    v_consultant RECORD;
    v_now TIMESTAMPTZ := now();
    v_wear_start TIMESTAMPTZ;
    v_replacement_due TIMESTAMPTZ;
    v_androgen NUMERIC := 42.0;
    v_progesterone NUMERIC := 28.0;
    v_existing_subscription BOOLEAN;
    i INTEGER;
BEGIN

    v_uid := auth.uid();

    IF v_uid IS NULL THEN
        RAISE EXCEPTION
            'Unauthorized: caller must be authenticated.';
    END IF;

    SELECT EXISTS (
        SELECT 1
        FROM public.subscriptions
        WHERE patient_user_id = v_uid
    )
    INTO v_existing_subscription;

    IF v_existing_subscription THEN
        RETURN;
    END IF;

    INSERT INTO public.patches (
        serial_number,
        model,
        firmware_version,
        status
    )
    VALUES (
        'ISF-DEMO-' ||
        upper(substr(
            md5(v_uid::text || random()::text),
            1,
            8
        )),
        'ISF-MN-001',
        '1.0.0',
        'active'
    )
    RETURNING id INTO v_patch_id;

    v_wear_start :=
        v_now - interval '6 days';

    v_replacement_due :=
        v_wear_start + interval '14 days';

    INSERT INTO public.patient_patches (
        patient_user_id,
        patch_id,
        wear_started_at,
        replacement_due_at,
        replacement_window_start_at,
        replacement_window_end_at,
        status,
        battery_percent,
        connected,
        last_synced_at
    )
    VALUES (
        v_uid,
        v_patch_id,
        v_wear_start,
        v_replacement_due,
        v_replacement_due - interval '2 days',
        v_replacement_due + interval '2 days',
        'active',
        78,
        true,
        v_now
    );

    FOR i IN REVERSE 13..0 LOOP

        v_androgen :=
            greatest(
                20.0,
                least(
                    85.0,
                    v_androgen
                    + (random() - 0.45) * 8.0
                )
            );

        v_progesterone :=
            greatest(
                5.0,
                least(
                    60.0,
                    v_progesterone
                    + (random() - 0.5) * 6.0
                )
            );

        INSERT INTO public.hormone_readings (
            patient_user_id,
            patch_id,
            recorded_at,
            androgen_value,
            progesterone_value,
            quality_status,
            battery_percent
        )
        VALUES (
            v_uid,
            v_patch_id,
            v_now - (i * interval '12 hours'),
            round(v_androgen, 1),
            round(v_progesterone, 1),
            'valid',
            78
        );

    END LOOP;

    FOR v_consultant IN
        SELECT id
        FROM public.consultants
        WHERE status = 'active'
        ORDER BY created_at ASC
        LIMIT 2
    LOOP

        INSERT INTO public.patient_consultants (
            patient_user_id,
            consultant_id,
            status
        )
        VALUES (
            v_uid,
            v_consultant.id,
            'active'
        )
        ON CONFLICT DO NOTHING;

    END LOOP;

    INSERT INTO public.subscriptions (
        patient_user_id,
        plan,
        status
    )
    VALUES (
        v_uid,
        'free',
        'free'
    )
    ON CONFLICT DO NOTHING;

END;
$$;

REVOKE ALL
ON FUNCTION public.seed_demo_data()
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.seed_demo_data()
TO authenticated;


-- ============================================================================
-- 45. UPDATED_AT TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_updated_at
ON public.profiles;

CREATE TRIGGER profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS patient_profiles_updated_at
ON public.patient_profiles;

CREATE TRIGGER patient_profiles_updated_at
BEFORE UPDATE ON public.patient_profiles
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS consultants_updated_at
ON public.consultants;

CREATE TRIGGER consultants_updated_at
BEFORE UPDATE ON public.consultants
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS subscriptions_updated_at
ON public.subscriptions;

CREATE TRIGGER subscriptions_updated_at
BEFORE UPDATE ON public.subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();


-- ============================================================================
-- 46. SECURITY DEFINER FUNCTION PRIVILEGES
-- ============================================================================

REVOKE ALL
ON FUNCTION public.handle_new_user()
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.handle_new_user()
TO postgres;

COMMIT;

-- ============================================================================
-- END OF ISF TRACKER FINAL RECONCILIATION
-- ============================================================================