-- ============================================================================
-- ISF TRACKER
-- CANONICAL PRE-DEPLOYMENT DATABASE HARDENING MIGRATION
-- Version: 1.0.0
-- Date: 2026-08-28
--
-- IMPORTANT:
-- This migration is designed around the existing ISF Tracker schema:
--
-- patient_profiles
-- consultants
-- patient_consultants
-- consent_records
-- patches
-- patient_patches
-- hormone_readings
-- reference_ranges
-- trend_events
-- notifications
-- conversations
-- messages
-- predictive_consents
-- predictions
-- subscriptions
-- payments
-- temporary_access_tokens
-- audit_logs
--
-- It intentionally does NOT create the conflicting:
-- profiles / readings / message_usage schema.
-- ============================================================================


-- ============================================================================
-- 0. REQUIRED EXTENSIONS
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- ============================================================================
-- 1. PATIENT PROFILES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.patient_profiles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id uuid NOT NULL
        REFERENCES auth.users(id)
        ON DELETE CASCADE,

    full_name text NOT NULL,

    date_of_birth date,

    language text NOT NULL DEFAULT 'en'
        CHECK (language IN ('en', 'sw')),

    timezone text NOT NULL DEFAULT 'Africa/Nairobi',

    weight_kg numeric,

    patient_reference text UNIQUE,

    created_at timestamptz NOT NULL DEFAULT now(),

    updated_at timestamptz NOT NULL DEFAULT now()
);


CREATE UNIQUE INDEX IF NOT EXISTS
    idx_patient_profiles_user_id
ON public.patient_profiles(user_id);


-- ============================================================================
-- 2. CONSULTANTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.consultants (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id uuid
        REFERENCES auth.users(id)
        ON DELETE CASCADE,

    full_name text NOT NULL,

    professional_type text NOT NULL
        CHECK (
            professional_type IN (
                'gynecologist',
                'endocrinologist',
                'nutritionist',
                'other'
            )
        ),

    license_reference text,

    organization text,

    status text NOT NULL DEFAULT 'active'
        CHECK (
            status IN (
                'active',
                'inactive',
                'suspended'
            )
        ),

    initials text,

    color text DEFAULT '#2C4C5C',

    online boolean NOT NULL DEFAULT false,

    created_at timestamptz NOT NULL DEFAULT now(),

    updated_at timestamptz NOT NULL DEFAULT now()
);


CREATE UNIQUE INDEX IF NOT EXISTS
    idx_consultants_user_id
ON public.consultants(user_id)
WHERE user_id IS NOT NULL;


-- ============================================================================
-- 3. PATIENT / CONSULTANT RELATIONSHIPS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.patient_consultants (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    patient_user_id uuid NOT NULL
        REFERENCES auth.users(id)
        ON DELETE CASCADE,

    consultant_id uuid NOT NULL
        REFERENCES public.consultants(id)
        ON DELETE CASCADE,

    status text NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'ended')),

    started_at timestamptz NOT NULL DEFAULT now(),

    ended_at timestamptz,

    created_at timestamptz NOT NULL DEFAULT now()
);


CREATE INDEX IF NOT EXISTS
    idx_patient_consultants_patient
ON public.patient_consultants(patient_user_id);


CREATE INDEX IF NOT EXISTS
    idx_patient_consultants_consultant
ON public.patient_consultants(consultant_id);


CREATE UNIQUE INDEX IF NOT EXISTS
    idx_one_active_consultant_relationship
ON public.patient_consultants(patient_user_id, consultant_id)
WHERE status = 'active';


-- ============================================================================
-- 4. CONSENT RECORDS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.consent_records (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    patient_user_id uuid NOT NULL
        REFERENCES auth.users(id)
        ON DELETE CASCADE,

    consultant_id uuid
        REFERENCES public.consultants(id)
        ON DELETE CASCADE,

    purpose text NOT NULL
        CHECK (
            purpose IN (
                'consultant_access',
                'predictive_analysis'
            )
        ),

    scope jsonb NOT NULL DEFAULT '{}'::jsonb,

    status text NOT NULL DEFAULT 'granted'
        CHECK (
            status IN (
                'granted',
                'revoked'
            )
        ),

    consent_version text NOT NULL DEFAULT '1.0',

    granted_at timestamptz NOT NULL DEFAULT now(),

    revoked_at timestamptz,

    created_at timestamptz NOT NULL DEFAULT now()
);


CREATE INDEX IF NOT EXISTS
    idx_consent_records_patient
ON public.consent_records(patient_user_id);


CREATE INDEX IF NOT EXISTS
    idx_consent_records_consultant
ON public.consent_records(consultant_id);


-- ============================================================================
-- 5. PATCH REGISTRY
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.patches (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    serial_number text UNIQUE NOT NULL,

    model text NOT NULL DEFAULT 'ISF-MN-001',

    firmware_version text DEFAULT '1.0.0',

    status text NOT NULL DEFAULT 'registered'
        CHECK (
            status IN (
                'registered',
                'active',
                'deactivated',
                'replaced'
            )
        ),

    created_at timestamptz NOT NULL DEFAULT now()
);


-- ============================================================================
-- 6. PATIENT PATCHES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.patient_patches (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    patient_user_id uuid NOT NULL
        REFERENCES auth.users(id)
        ON DELETE CASCADE,

    patch_id uuid NOT NULL
        REFERENCES public.patches(id)
        ON DELETE CASCADE,

    wear_started_at timestamptz DEFAULT now(),

    replacement_due_at timestamptz,

    replacement_window_start_at timestamptz,

    replacement_window_end_at timestamptz,

    status text NOT NULL DEFAULT 'active'
        CHECK (
            status IN (
                'active',
                'replaced',
                'expired'
            )
        ),

    battery_percent integer DEFAULT 100
        CHECK (
            battery_percent >= 0
            AND battery_percent <= 100
        ),

    connected boolean NOT NULL DEFAULT true,

    last_synced_at timestamptz,

    created_at timestamptz NOT NULL DEFAULT now()
);


CREATE INDEX IF NOT EXISTS
    idx_patient_patches_patient
ON public.patient_patches(patient_user_id);


CREATE INDEX IF NOT EXISTS
    idx_patient_patches_patch
ON public.patient_patches(patch_id);


-- ============================================================================
-- 7. HORMONE READINGS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.hormone_readings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    patient_user_id uuid NOT NULL
        REFERENCES auth.users(id)
        ON DELETE CASCADE,

    patch_id uuid
        REFERENCES public.patches(id)
        ON DELETE SET NULL,

    recorded_at timestamptz NOT NULL,

    received_at timestamptz NOT NULL DEFAULT now(),

    androgen_value numeric NOT NULL,

    androgen_unit text NOT NULL DEFAULT 'nmol/L',

    progesterone_value numeric NOT NULL,

    progesterone_unit text NOT NULL DEFAULT 'nmol/L',

    quality_status text NOT NULL DEFAULT 'valid'
        CHECK (
            quality_status IN (
                'valid',
                'invalid',
                'calibrating',
                'missing'
            )
        ),

    sequence_number integer,

    firmware_version text,

    battery_percent integer,

    created_at timestamptz NOT NULL DEFAULT now()
);


CREATE INDEX IF NOT EXISTS
    idx_hormone_readings_patient_time
ON public.hormone_readings(
    patient_user_id,
    recorded_at DESC
);


CREATE INDEX IF NOT EXISTS
    idx_hormone_readings_patch_time
ON public.hormone_readings(
    patch_id,
    recorded_at DESC
);


-- ============================================================================
-- 8. REFERENCE RANGES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.reference_ranges (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    hormone text NOT NULL
        CHECK (
            hormone IN (
                'androgen',
                'progesterone'
            )
        ),

    population_context text DEFAULT 'adult_female',

    lower_normal numeric NOT NULL,

    upper_normal numeric NOT NULL,

    unit text NOT NULL DEFAULT 'nmol/L',

    effective_from timestamptz NOT NULL DEFAULT now(),

    effective_to timestamptz,

    version text NOT NULL DEFAULT '1.0',

    created_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT reference_ranges_valid_bounds
        CHECK (upper_normal >= lower_normal)
);


CREATE INDEX IF NOT EXISTS
    idx_reference_ranges_hormone
ON public.reference_ranges(
    hormone,
    effective_from DESC
);


-- ============================================================================
-- 9. TREND EVENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.trend_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    patient_user_id uuid NOT NULL
        REFERENCES auth.users(id)
        ON DELETE CASCADE,

    hormone text NOT NULL
        CHECK (
            hormone IN (
                'androgen',
                'progesterone'
            )
        ),

    event_type text NOT NULL
        CHECK (
            event_type IN (
                'high',
                'low',
                'increasing',
                'decreasing',
                'sustained_abnormal'
            )
        ),

    severity text NOT NULL DEFAULT 'mild'
        CHECK (
            severity IN (
                'mild',
                'moderate',
                'severe'
            )
        ),

    started_at timestamptz DEFAULT now(),

    ended_at timestamptz,

    peak_value numeric,

    baseline_value numeric,

    status text NOT NULL DEFAULT 'active'
        CHECK (
            status IN (
                'active',
                'resolved',
                'acknowledged'
            )
        ),

    deduplication_key text,

    created_at timestamptz NOT NULL DEFAULT now()
);


CREATE INDEX IF NOT EXISTS
    idx_trend_events_patient
ON public.trend_events(
    patient_user_id,
    status
);


-- ============================================================================
-- 10. NOTIFICATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.notifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    patient_user_id uuid NOT NULL
        REFERENCES auth.users(id)
        ON DELETE CASCADE,

    consultant_id uuid
        REFERENCES public.consultants(id)
        ON DELETE CASCADE,

    type text NOT NULL,

    channel text NOT NULL DEFAULT 'in_app'
        CHECK (
            channel IN (
                'in_app',
                'push',
                'email',
                'sms'
            )
        ),

    status text NOT NULL DEFAULT 'pending'
        CHECK (
            status IN (
                'pending',
                'sent',
                'read',
                'failed'
            )
        ),

    body text,

    sent_at timestamptz,

    read_at timestamptz,

    created_at timestamptz NOT NULL DEFAULT now()
);


CREATE INDEX IF NOT EXISTS
    idx_notifications_patient
ON public.notifications(
    patient_user_id,
    created_at DESC
);


-- ============================================================================
-- 11. CONVERSATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.conversations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    patient_user_id uuid NOT NULL
        REFERENCES auth.users(id)
        ON DELETE CASCADE,

    consultant_id uuid NOT NULL
        REFERENCES public.consultants(id)
        ON DELETE CASCADE,

    status text NOT NULL DEFAULT 'active'
        CHECK (
            status IN (
                'active',
                'closed'
            )
        ),

    created_at timestamptz NOT NULL DEFAULT now(),

    updated_at timestamptz NOT NULL DEFAULT now()
);


CREATE INDEX IF NOT EXISTS
    idx_conversations_patient
ON public.conversations(patient_user_id);


CREATE INDEX IF NOT EXISTS
    idx_conversations_consultant
ON public.conversations(consultant_id);


-- ============================================================================
-- 12. MESSAGES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    conversation_id uuid NOT NULL
        REFERENCES public.conversations(id)
        ON DELETE CASCADE,

    sender_type text NOT NULL
        CHECK (
            sender_type IN (
                'patient',
                'consultant',
                'system',
                'automated_alert'
            )
        ),

    sender_id uuid,

    message_type text NOT NULL DEFAULT 'text'
        CHECK (
            message_type IN (
                'text',
                'trend_alert',
                'consent_notice'
            )
        ),

    body text NOT NULL,

    metadata jsonb DEFAULT '{}'::jsonb,

    created_at timestamptz NOT NULL DEFAULT now(),

    read_at timestamptz
);


CREATE INDEX IF NOT EXISTS
    idx_messages_conversation
ON public.messages(
    conversation_id,
    created_at
);


-- ============================================================================
-- 13. PREDICTIVE CONSENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.predictive_consents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    patient_user_id uuid NOT NULL
        REFERENCES auth.users(id)
        ON DELETE CASCADE,

    status text NOT NULL DEFAULT 'granted'
        CHECK (
            status IN (
                'granted',
                'revoked'
            )
        ),

    consent_version text NOT NULL DEFAULT '1.0',

    granted_at timestamptz NOT NULL DEFAULT now(),

    revoked_at timestamptz,

    created_at timestamptz NOT NULL DEFAULT now()
);


CREATE INDEX IF NOT EXISTS
    idx_predictive_consents_patient
ON public.predictive_consents(
    patient_user_id,
    granted_at DESC
);


-- ============================================================================
-- 14. PREDICTIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.predictions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    patient_user_id uuid NOT NULL
        REFERENCES auth.users(id)
        ON DELETE CASCADE,

    condition text NOT NULL
        CHECK (
            condition IN (
                'pcos',
                'type_2_diabetes',
                'insulin_resistance',
                'high_blood_pressure',
                'endometrial_cancer'
            )
        ),

    risk_category text NOT NULL
        CHECK (
            risk_category IN (
                'low',
                'moderate',
                'elevated',
                'high'
            )
        ),

    risk_percentage numeric,

    model_id text NOT NULL DEFAULT 'isf-prototype-v1',

    model_version text NOT NULL DEFAULT '1.0',

    feature_version text NOT NULL DEFAULT '1.0',

    calculated_at timestamptz NOT NULL DEFAULT now(),

    expires_at timestamptz,

    explanation jsonb DEFAULT '{}'::jsonb,

    trend text,

    created_at timestamptz NOT NULL DEFAULT now()
);


CREATE INDEX IF NOT EXISTS
    idx_predictions_patient
ON public.predictions(
    patient_user_id,
    condition
);


-- ============================================================================
-- 15. SUBSCRIPTIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.subscriptions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    patient_user_id uuid NOT NULL
        REFERENCES auth.users(id)
        ON DELETE CASCADE,

    plan text NOT NULL DEFAULT 'free'
        CHECK (
            plan IN (
                'free',
                'premium'
            )
        ),

    status text NOT NULL DEFAULT 'free'
        CHECK (
            status IN (
                'free',
                'trial',
                'active',
                'past_due',
                'payment_failed',
                'cancelled',
                'expired'
            )
        ),

    provider text,

    provider_customer_id text,

    provider_subscription_id text,

    started_at timestamptz NOT NULL DEFAULT now(),

    renewal_at timestamptz,

    cancelled_at timestamptz,

    created_at timestamptz NOT NULL DEFAULT now(),

    updated_at timestamptz NOT NULL DEFAULT now()
);


CREATE INDEX IF NOT EXISTS
    idx_subscriptions_patient
ON public.subscriptions(patient_user_id);


-- ============================================================================
-- 16. PAYMENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.payments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    subscription_id uuid NOT NULL
        REFERENCES public.subscriptions(id)
        ON DELETE CASCADE,

    provider text NOT NULL,

    provider_reference text,

    amount numeric NOT NULL,

    currency text NOT NULL DEFAULT 'KES',

    status text NOT NULL DEFAULT 'pending'
        CHECK (
            status IN (
                'pending',
                'completed',
                'failed',
                'refunded'
            )
        ),

    paid_at timestamptz,

    raw_reference_hash text,

    created_at timestamptz NOT NULL DEFAULT now()
);


CREATE INDEX IF NOT EXISTS
    idx_payments_subscription
ON public.payments(subscription_id);


-- ============================================================================
-- 17. TEMPORARY ACCESS TOKENS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.temporary_access_tokens (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    patient_user_id uuid NOT NULL
        REFERENCES auth.users(id)
        ON DELETE CASCADE,

    token_hash text NOT NULL UNIQUE,

    scope jsonb NOT NULL DEFAULT
        '{"readings": true, "patch_status": true}'::jsonb,

    expires_at timestamptz NOT NULL,

    revoked_at timestamptz,

    created_at timestamptz NOT NULL DEFAULT now(),

    last_used_at timestamptz
);


CREATE INDEX IF NOT EXISTS
    idx_temp_access_patient
ON public.temporary_access_tokens(patient_user_id);


-- ============================================================================
-- 18. AUDIT LOGS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    actor_user_id uuid
        REFERENCES auth.users(id)
        ON DELETE SET NULL,

    patient_user_id uuid
        REFERENCES auth.users(id)
        ON DELETE SET NULL,

    action text NOT NULL,

    resource_type text,

    resource_id text,

    metadata jsonb DEFAULT '{}'::jsonb,

    created_at timestamptz NOT NULL DEFAULT now()
);


CREATE INDEX IF NOT EXISTS
    idx_audit_patient
ON public.audit_logs(
    patient_user_id,
    created_at DESC
);


-- ============================================================================
-- 19. ENABLE RLS
-- ============================================================================

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
-- 20. PATIENT PROFILES POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "isf_patient_profiles_select" ON public.patient_profiles;
DROP POLICY IF EXISTS "isf_patient_profiles_insert" ON public.patient_profiles;
DROP POLICY IF EXISTS "isf_patient_profiles_update" ON public.patient_profiles;

CREATE POLICY "isf_patient_profiles_select"
ON public.patient_profiles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "isf_patient_profiles_insert"
ON public.patient_profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "isf_patient_profiles_update"
ON public.patient_profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);


-- ============================================================================
-- 21. CONSULTANT POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "isf_consultants_select" ON public.consultants;

CREATE POLICY "isf_consultants_select"
ON public.consultants
FOR SELECT
TO authenticated
USING (
    consultants.user_id = auth.uid()
    OR EXISTS (
        SELECT 1
        FROM public.patient_consultants pc
        WHERE pc.consultant_id = consultants.id
          AND pc.patient_user_id = auth.uid()
          AND pc.status = 'active'
    )
);


-- ============================================================================
-- 22. PATIENT-CONSULTANT POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "isf_patient_consultants_select"
ON public.patient_consultants;

DROP POLICY IF EXISTS "isf_patient_consultants_insert"
ON public.patient_consultants;

DROP POLICY IF EXISTS "isf_patient_consultants_update"
ON public.patient_consultants;

CREATE POLICY "isf_patient_consultants_select"
ON public.patient_consultants
FOR SELECT
TO authenticated
USING (
    auth.uid() = patient_user_id
    OR EXISTS (
        SELECT 1
        FROM public.consultants c
        WHERE c.id = patient_consultants.consultant_id
          AND c.user_id = auth.uid()
    )
);

CREATE POLICY "isf_patient_consultants_insert"
ON public.patient_consultants
FOR INSERT
TO authenticated
WITH CHECK (
    auth.uid() = patient_user_id
);

CREATE POLICY "isf_patient_consultants_update"
ON public.patient_consultants
FOR UPDATE
TO authenticated
USING (
    auth.uid() = patient_user_id
)
WITH CHECK (
    auth.uid() = patient_user_id
);


-- ============================================================================
-- 23. CONSENT POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "isf_consent_select"
ON public.consent_records;

DROP POLICY IF EXISTS "isf_consent_insert"
ON public.consent_records;

CREATE POLICY "isf_consent_select"
ON public.consent_records
FOR SELECT
TO authenticated
USING (
    auth.uid() = patient_user_id
);

CREATE POLICY "isf_consent_insert"
ON public.consent_records
FOR INSERT
TO authenticated
WITH CHECK (
    auth.uid() = patient_user_id
);


-- ============================================================================
-- 24. PATCH POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "isf_patches_select"
ON public.patches;

CREATE POLICY "isf_patches_select"
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
-- 25. PATIENT PATCH POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "isf_patient_patches_select"
ON public.patient_patches;

DROP POLICY IF EXISTS "isf_patient_patches_insert"
ON public.patient_patches;

DROP POLICY IF EXISTS "isf_patient_patches_update"
ON public.patient_patches;

CREATE POLICY "isf_patient_patches_select"
ON public.patient_patches
FOR SELECT
TO authenticated
USING (
    auth.uid() = patient_user_id
);

CREATE POLICY "isf_patient_patches_insert"
ON public.patient_patches
FOR INSERT
TO authenticated
WITH CHECK (
    auth.uid() = patient_user_id
);

CREATE POLICY "isf_patient_patches_update"
ON public.patient_patches
FOR UPDATE
TO authenticated
USING (
    auth.uid() = patient_user_id
)
WITH CHECK (
    auth.uid() = patient_user_id
);


-- ============================================================================
-- 26. HORMONE READING POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "isf_readings_select"
ON public.hormone_readings;

DROP POLICY IF EXISTS "isf_readings_insert"
ON public.hormone_readings;

CREATE POLICY "isf_readings_select"
ON public.hormone_readings
FOR SELECT
TO authenticated
USING (
    auth.uid() = patient_user_id
);

CREATE POLICY "isf_readings_insert"
ON public.hormone_readings
FOR INSERT
TO authenticated
WITH CHECK (
    auth.uid() = patient_user_id
);


-- ============================================================================
-- 27. REFERENCE RANGE POLICY
-- ============================================================================

DROP POLICY IF EXISTS "isf_reference_ranges_select"
ON public.reference_ranges;

CREATE POLICY "isf_reference_ranges_select"
ON public.reference_ranges
FOR SELECT
TO authenticated
USING (true);


-- ============================================================================
-- 28. TREND EVENT POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "isf_trends_select"
ON public.trend_events;

DROP POLICY IF EXISTS "isf_trends_insert"
ON public.trend_events;

DROP POLICY IF EXISTS "isf_trends_update"
ON public.trend_events;

CREATE POLICY "isf_trends_select"
ON public.trend_events
FOR SELECT
TO authenticated
USING (
    auth.uid() = patient_user_id
);

CREATE POLICY "isf_trends_insert"
ON public.trend_events
FOR INSERT
TO authenticated
WITH CHECK (
    auth.uid() = patient_user_id
);

CREATE POLICY "isf_trends_update"
ON public.trend_events
FOR UPDATE
TO authenticated
USING (
    auth.uid() = patient_user_id
)
WITH CHECK (
    auth.uid() = patient_user_id
);


-- ============================================================================
-- 29. NOTIFICATION POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "isf_notifications_select"
ON public.notifications;

DROP POLICY IF EXISTS "isf_notifications_update"
ON public.notifications;

CREATE POLICY "isf_notifications_select"
ON public.notifications
FOR SELECT
TO authenticated
USING (
    auth.uid() = patient_user_id
);

CREATE POLICY "isf_notifications_update"
ON public.notifications
FOR UPDATE
TO authenticated
USING (
    auth.uid() = patient_user_id
)
WITH CHECK (
    auth.uid() = patient_user_id
);


-- ============================================================================
-- 30. CONVERSATION POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "isf_conversations_select"
ON public.conversations;

DROP POLICY IF EXISTS "isf_conversations_insert"
ON public.conversations;

CREATE POLICY "isf_conversations_select"
ON public.conversations
FOR SELECT
TO authenticated
USING (
    auth.uid() = patient_user_id
    OR EXISTS (
        SELECT 1
        FROM public.consultants c
        WHERE c.id = conversations.consultant_id
          AND c.user_id = auth.uid()
    )
);

CREATE POLICY "isf_conversations_insert"
ON public.conversations
FOR INSERT
TO authenticated
WITH CHECK (
    auth.uid() = patient_user_id
);


-- ============================================================================
-- 31. MESSAGE POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "isf_messages_select"
ON public.messages;

DROP POLICY IF EXISTS "isf_messages_insert"
ON public.messages;

CREATE POLICY "isf_messages_select"
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

CREATE POLICY "isf_messages_insert"
ON public.messages
FOR INSERT
TO authenticated
WITH CHECK (
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


-- ============================================================================
-- 32. PREDICTIVE CONSENT POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "isf_predictive_consent_select"
ON public.predictive_consents;

DROP POLICY IF EXISTS "isf_predictive_consent_insert"
ON public.predictive_consents;

CREATE POLICY "isf_predictive_consent_select"
ON public.predictive_consents
FOR SELECT
TO authenticated
USING (
    auth.uid() = patient_user_id
);

CREATE POLICY "isf_predictive_consent_insert"
ON public.predictive_consents
FOR INSERT
TO authenticated
WITH CHECK (
    auth.uid() = patient_user_id
);


-- ============================================================================
-- 33. PREDICTION POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "isf_predictions_select"
ON public.predictions;

CREATE POLICY "isf_predictions_select"
ON public.predictions
FOR SELECT
TO authenticated
USING (
    auth.uid() = patient_user_id
);


-- ============================================================================
-- 34. SUBSCRIPTION POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "isf_subscription_select"
ON public.subscriptions;

CREATE POLICY "isf_subscription_select"
ON public.subscriptions
FOR SELECT
TO authenticated
USING (
    auth.uid() = patient_user_id
);


-- ============================================================================
-- 35. PAYMENT POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "isf_payments_select"
ON public.payments;

CREATE POLICY "isf_payments_select"
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
-- 36. TEMPORARY ACCESS TOKEN POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "isf_temp_tokens_select"
ON public.temporary_access_tokens;

DROP POLICY IF EXISTS "isf_temp_tokens_insert"
ON public.temporary_access_tokens;

DROP POLICY IF EXISTS "isf_temp_tokens_update"
ON public.temporary_access_tokens;

CREATE POLICY "isf_temp_tokens_select"
ON public.temporary_access_tokens
FOR SELECT
TO authenticated
USING (
    auth.uid() = patient_user_id
);

CREATE POLICY "isf_temp_tokens_insert"
ON public.temporary_access_tokens
FOR INSERT
TO authenticated
WITH CHECK (
    auth.uid() = patient_user_id
);

CREATE POLICY "isf_temp_tokens_update"
ON public.temporary_access_tokens
FOR UPDATE
TO authenticated
USING (
    auth.uid() = patient_user_id
)
WITH CHECK (
    auth.uid() = patient_user_id
);


-- ============================================================================
-- 37. AUDIT LOG POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "isf_audit_select"
ON public.audit_logs;

CREATE POLICY "isf_audit_select"
ON public.audit_logs
FOR SELECT
TO authenticated
USING (
    auth.uid() = patient_user_id
    OR auth.uid() = actor_user_id
);


-- ============================================================================
-- 38. AUTOMATIC UPDATED_AT FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.isf_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


DROP TRIGGER IF EXISTS trg_patient_profiles_updated_at
ON public.patient_profiles;

CREATE TRIGGER trg_patient_profiles_updated_at
BEFORE UPDATE ON public.patient_profiles
FOR EACH ROW
EXECUTE FUNCTION public.isf_set_updated_at();


DROP TRIGGER IF EXISTS trg_consultants_updated_at
ON public.consultants;

CREATE TRIGGER trg_consultants_updated_at
BEFORE UPDATE ON public.consultants
FOR EACH ROW
EXECUTE FUNCTION public.isf_set_updated_at();


DROP TRIGGER IF EXISTS trg_conversations_updated_at
ON public.conversations;

CREATE TRIGGER trg_conversations_updated_at
BEFORE UPDATE ON public.conversations
FOR EACH ROW
EXECUTE FUNCTION public.isf_set_updated_at();


DROP TRIGGER IF EXISTS trg_subscriptions_updated_at
ON public.subscriptions;

CREATE TRIGGER trg_subscriptions_updated_at
BEFORE UPDATE ON public.subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.isf_set_updated_at();


-- ============================================================================
-- 39. PREDICTIVE ANALYSIS FUNCTION
--
-- Prototype only.
-- NOT a clinically validated diagnostic model.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.generate_predictions()
RETURNS SETOF public.predictions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_uid uuid;

    v_reading_count integer;

    v_avg_androgen numeric;
    v_avg_progesterone numeric;

    v_androgen_abnormal numeric := 0;
    v_progesterone_abnormal numeric := 0;

    v_pcos_score numeric;
    v_diabetes_score numeric;
    v_insulin_score numeric;
    v_bp_score numeric;
    v_endometrial_score numeric;

    v_score numeric;
    v_category text;

    v_explanation jsonb;

BEGIN

    -- Authenticate caller
    v_uid := auth.uid();

    IF v_uid IS NULL THEN
        RAISE EXCEPTION
            'Unauthorized: caller must be authenticated.';
    END IF;


    -- Require active predictive consent
    IF NOT EXISTS (
        SELECT 1
        FROM public.predictive_consents
        WHERE patient_user_id = v_uid
          AND status = 'granted'
          AND revoked_at IS NULL
        ORDER BY granted_at DESC
        LIMIT 1
    ) THEN

        RAISE EXCEPTION
            'Predictive analysis requires active consent.';

    END IF;


    -- Read latest valid readings
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


    -- Androgen abnormality
    SELECT
        CASE

            WHEN v_avg_androgen < rr.lower_normal THEN
                LEAST(
                    100,
                    (
                        (rr.lower_normal - v_avg_androgen)
                        / NULLIF(rr.lower_normal, 0)
                    ) * 100
                )

            WHEN v_avg_androgen > rr.upper_normal THEN
                LEAST(
                    100,
                    (
                        (v_avg_androgen - rr.upper_normal)
                        / NULLIF(rr.upper_normal, 0)
                    ) * 100
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


    -- Progesterone abnormality
    SELECT
        CASE

            WHEN v_avg_progesterone < rr.lower_normal THEN
                LEAST(
                    100,
                    (
                        (rr.lower_normal - v_avg_progesterone)
                        / NULLIF(rr.lower_normal, 0)
                    ) * 100
                )

            WHEN v_avg_progesterone > rr.upper_normal THEN
                LEAST(
                    100,
                    (
                        (v_avg_progesterone - rr.upper_normal)
                        / NULLIF(rr.upper_normal, 0)
                    ) * 100
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


    -- Prototype heuristic scores
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


    -- Remove previous prototype predictions for this patient.
    DELETE FROM public.predictions
    WHERE patient_user_id = v_uid;


    -- Shared explanation
    v_explanation :=
        jsonb_build_object(
            'type', 'prototype_heuristic',
            'clinically_validated', false,
            'reading_count', v_reading_count,
            'average_androgen', ROUND(v_avg_androgen, 2),
            'average_progesterone', ROUND(v_avg_progesterone, 2),
            'androgen_abnormality',
                ROUND(v_androgen_abnormal, 2),
            'progesterone_abnormality',
                ROUND(v_progesterone_abnormal, 2)
        );


    -- ================================================================
    -- PCOS
    -- ================================================================

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


    -- ================================================================
    -- TYPE 2 DIABETES
    -- ================================================================

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


    -- ================================================================
    -- INSULIN RESISTANCE
    -- ================================================================

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


    -- ================================================================
    -- HIGH BLOOD PRESSURE
    -- ================================================================

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


    -- ================================================================
    -- ENDOMETRIAL CANCER
    -- ================================================================

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
-- 40. SECURE DEMO INITIALIZATION FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.seed_demo_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE

    v_uid uuid;

    v_patch_id uuid;

    v_consultant record;

    v_now timestamptz := now();

    v_wear_start timestamptz;

    v_replacement_due timestamptz;

    v_androgen numeric := 42.0;

    v_progesterone numeric := 28.0;

    v_existing_subscription boolean;

    i integer;

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


    -- Create demo patch
    INSERT INTO public.patches (
        serial_number,
        model,
        firmware_version,
        status
    )
    VALUES (
        'ISF-DEMO-' ||
        upper(
            substr(
                md5(
                    v_uid::text ||
                    random()::text
                ),
                1,
                8
            )
        ),
        'ISF-MN-001',
        '1.0.0',
        'active'
    )
    RETURNING id INTO v_patch_id;


    -- Attach patch
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


    -- Generate 14 demo readings
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


    -- Assign up to two active consultants
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


    -- Create free subscription
    INSERT INTO public.subscriptions (
        patient_user_id,
        plan,
        status
    )
    VALUES (
        v_uid,
        'free',
        'free'
    );

END;
$$;


REVOKE ALL
ON FUNCTION public.seed_demo_data()
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.seed_demo_data()
TO authenticated;


-- ============================================================================
-- 41. FINAL SECURITY HARDENING
-- ============================================================================

-- Prevent anonymous users from executing application functions.
REVOKE ALL
ON FUNCTION public.generate_predictions()
FROM anon;

REVOKE ALL
ON FUNCTION public.seed_demo_data()
FROM anon;


-- ============================================================================
-- END OF ISF TRACKER CANONICAL MIGRATION
-- ============================================================================