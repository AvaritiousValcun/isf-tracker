

-- ============================================================================
-- MIGRATION: 20260827161010_001_core_tables.sql
-- ============================================================================


/*
===============================================================================
ISF TRACKER — CANONICAL CORE DATABASE SCHEMA
Migration: 20260827161010
===============================================================================

Purpose:
- Creates the foundational ISF Tracker tables.
- NO RLS policies are defined here.
- NO seed/demo functions are defined here.
- Uses patient_profiles as the canonical patient profile table.
- Prediction terminology uses "pcos" consistently.

This migration must execute BEFORE the RLS and seed migrations.
===============================================================================
*/

-- Required extension for UUID generation.
CREATE EXTENSION IF NOT EXISTS pgcrypto;


/*
===============================================================================
1. PATIENT PROFILES
===============================================================================
*/

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

    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT patient_profiles_user_id_unique
        UNIQUE (user_id)
);


/*
===============================================================================
2. CONSULTANTS
===============================================================================
*/

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


/*
===============================================================================
3. PATIENT / CONSULTANT RELATIONSHIPS
===============================================================================
*/

CREATE TABLE IF NOT EXISTS public.patient_consultants (
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
                'ended'
            )
        ),

    started_at timestamptz NOT NULL DEFAULT now(),

    ended_at timestamptz,

    created_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT patient_consultants_unique_relationship
        UNIQUE (
            patient_user_id,
            consultant_id
        )
);


/*
===============================================================================
4. CONSENT RECORDS
===============================================================================
*/

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


/*
===============================================================================
5. PATCHES
===============================================================================
*/

CREATE TABLE IF NOT EXISTS public.patches (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    serial_number text UNIQUE NOT NULL,

    model text NOT NULL DEFAULT 'ISF-MN-001',

    firmware_version text NOT NULL DEFAULT '1.0.0',

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


/*
===============================================================================
6. PATIENT PATCHES
===============================================================================
*/

CREATE TABLE IF NOT EXISTS public.patient_patches (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    patient_user_id uuid NOT NULL
        REFERENCES auth.users(id)
        ON DELETE CASCADE,

    patch_id uuid NOT NULL
        REFERENCES public.patches(id)
        ON DELETE CASCADE,

    wear_started_at timestamptz NOT NULL DEFAULT now(),

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

    battery_percent integer
        CHECK (
            battery_percent >= 0
            AND battery_percent <= 100
        ),

    connected boolean NOT NULL DEFAULT true,

    last_synced_at timestamptz,

    created_at timestamptz NOT NULL DEFAULT now()
);


/*
===============================================================================
7. HORMONE READINGS
===============================================================================
*/

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

    battery_percent integer
        CHECK (
            battery_percent IS NULL
            OR (
                battery_percent >= 0
                AND battery_percent <= 100
            )
        ),

    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hormone_readings_patient_time
    ON public.hormone_readings (
        patient_user_id,
        recorded_at DESC
    );


/*
===============================================================================
8. REFERENCE RANGES
===============================================================================
*/

CREATE TABLE IF NOT EXISTS public.reference_ranges (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    hormone text NOT NULL
        CHECK (
            hormone IN (
                'androgen',
                'progesterone'
            )
        ),

    population_context text NOT NULL DEFAULT 'adult_female',

    lower_normal numeric NOT NULL,

    upper_normal numeric NOT NULL,

    unit text NOT NULL DEFAULT 'nmol/L',

    effective_from timestamptz NOT NULL DEFAULT now(),

    effective_to timestamptz,

    version text NOT NULL DEFAULT '1.0',

    created_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT reference_ranges_valid_bounds
        CHECK (lower_normal <= upper_normal)
);


/*
===============================================================================
9. TREND EVENTS
===============================================================================
*/

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

    started_at timestamptz NOT NULL DEFAULT now(),

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

CREATE INDEX IF NOT EXISTS idx_trend_events_patient_status
    ON public.trend_events (
        patient_user_id,
        status
    );


/*
===============================================================================
10. NOTIFICATIONS
===============================================================================
*/

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


/*
===============================================================================
11. CONVERSATIONS
===============================================================================
*/

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

CREATE INDEX IF NOT EXISTS idx_conversations_patient
    ON public.conversations (
        patient_user_id,
        updated_at DESC
    );


/*
===============================================================================
12. MESSAGES
===============================================================================
*/

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

    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

    created_at timestamptz NOT NULL DEFAULT now(),

    read_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation
    ON public.messages (
        conversation_id,
        created_at
    );


/*
===============================================================================
13. PREDICTIVE CONSENTS
===============================================================================
*/

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


/*
===============================================================================
14. PREDICTIONS
===============================================================================
*/

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

    risk_percentage numeric
        CHECK (
            risk_percentage IS NULL
            OR (
                risk_percentage >= 0
                AND risk_percentage <= 100
            )
        ),

    model_id text NOT NULL DEFAULT 'isf-prototype-v1',

    model_version text NOT NULL DEFAULT '1.0',

    feature_version text NOT NULL DEFAULT '1.0',

    calculated_at timestamptz NOT NULL DEFAULT now(),

    expires_at timestamptz,

    explanation jsonb NOT NULL DEFAULT '{}'::jsonb,

    trend text,

    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_predictions_patient_condition
    ON public.predictions (
        patient_user_id,
        condition,
        calculated_at DESC
    );


/*
===============================================================================
15. SUBSCRIPTIONS
===============================================================================
*/

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

    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT subscriptions_one_per_patient
        UNIQUE (patient_user_id)
);


/*
===============================================================================
16. PAYMENTS
===============================================================================
*/

CREATE TABLE IF NOT EXISTS public.payments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    subscription_id uuid NOT NULL
        REFERENCES public.subscriptions(id)
        ON DELETE CASCADE,

    provider text NOT NULL,

    provider_reference text,

    amount numeric NOT NULL
        CHECK (amount >= 0),

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


/*
===============================================================================
17. TEMPORARY ACCESS TOKENS
===============================================================================
*/

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


/*
===============================================================================
18. AUDIT LOGS
===============================================================================
*/

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

    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_patient
    ON public.audit_logs (
        patient_user_id,
        created_at DESC
    );


/*
===============================================================================
END OF CANONICAL CORE SCHEMA
===============================================================================
*/



-- ============================================================================
-- MIGRATION: 20260827161039_002_rls_policies.sql
-- ============================================================================


/*
===============================================================================
ISF TRACKER — ROW LEVEL SECURITY
Migration: 20260827161039
===============================================================================

This migration contains ONLY:
- RLS enablement
- RLS policies

No tables are created here.
No seed functions are created here.
===============================================================================
*/


/*
===============================================================================
1. PATIENT PROFILES
===============================================================================
*/

ALTER TABLE public.patient_profiles
    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "patient_profiles_select_own"
    ON public.patient_profiles;

CREATE POLICY "patient_profiles_select_own"
ON public.patient_profiles
FOR SELECT
TO authenticated
USING (
    auth.uid() = user_id
);


DROP POLICY IF EXISTS "patient_profiles_insert_own"
    ON public.patient_profiles;

CREATE POLICY "patient_profiles_insert_own"
ON public.patient_profiles
FOR INSERT
TO authenticated
WITH CHECK (
    auth.uid() = user_id
);


DROP POLICY IF EXISTS "patient_profiles_update_own"
    ON public.patient_profiles;

CREATE POLICY "patient_profiles_update_own"
ON public.patient_profiles
FOR UPDATE
TO authenticated
USING (
    auth.uid() = user_id
)
WITH CHECK (
    auth.uid() = user_id
);


/*
===============================================================================
2. CONSULTANTS
===============================================================================
*/

ALTER TABLE public.consultants
    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "consultants_select_related"
    ON public.consultants;

CREATE POLICY "consultants_select_related"
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


/*
===============================================================================
3. PATIENT CONSULTANTS
===============================================================================
*/

ALTER TABLE public.patient_consultants
    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "patient_consultants_select_own"
    ON public.patient_consultants;

CREATE POLICY "patient_consultants_select_own"
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


DROP POLICY IF EXISTS "patient_consultants_insert_own"
    ON public.patient_consultants;

CREATE POLICY "patient_consultants_insert_own"
ON public.patient_consultants
FOR INSERT
TO authenticated
WITH CHECK (
    patient_user_id = auth.uid()
);


DROP POLICY IF EXISTS "patient_consultants_update_own"
    ON public.patient_consultants;

CREATE POLICY "patient_consultants_update_own"
ON public.patient_consultants
FOR UPDATE
TO authenticated
USING (
    patient_user_id = auth.uid()
)
WITH CHECK (
    patient_user_id = auth.uid()
);


/*
===============================================================================
4. CONSENT RECORDS
===============================================================================
*/

ALTER TABLE public.consent_records
    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "consent_records_select_own"
    ON public.consent_records;

CREATE POLICY "consent_records_select_own"
ON public.consent_records
FOR SELECT
TO authenticated
USING (
    patient_user_id = auth.uid()
);


DROP POLICY IF EXISTS "consent_records_insert_own"
    ON public.consent_records;

CREATE POLICY "consent_records_insert_own"
ON public.consent_records
FOR INSERT
TO authenticated
WITH CHECK (
    patient_user_id = auth.uid()
);


DROP POLICY IF EXISTS "consent_records_update_own"
    ON public.consent_records;

CREATE POLICY "consent_records_update_own"
ON public.consent_records
FOR UPDATE
TO authenticated
USING (
    patient_user_id = auth.uid()
)
WITH CHECK (
    patient_user_id = auth.uid()
);


/*
===============================================================================
5. PATCHES
===============================================================================
*/

ALTER TABLE public.patches
    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "patches_select_own"
    ON public.patches;

CREATE POLICY "patches_select_own"
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


/*
===============================================================================
6. PATIENT PATCHES
===============================================================================
*/

ALTER TABLE public.patient_patches
    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "patient_patches_select_own"
    ON public.patient_patches;

CREATE POLICY "patient_patches_select_own"
ON public.patient_patches
FOR SELECT
TO authenticated
USING (
    patient_user_id = auth.uid()
);


DROP POLICY IF EXISTS "patient_patches_insert_own"
    ON public.patient_patches;

CREATE POLICY "patient_patches_insert_own"
ON public.patient_patches
FOR INSERT
TO authenticated
WITH CHECK (
    patient_user_id = auth.uid()
);


DROP POLICY IF EXISTS "patient_patches_update_own"
    ON public.patient_patches;

CREATE POLICY "patient_patches_update_own"
ON public.patient_patches
FOR UPDATE
TO authenticated
USING (
    patient_user_id = auth.uid()
)
WITH CHECK (
    patient_user_id = auth.uid()
);


/*
===============================================================================
7. HORMONE READINGS
===============================================================================
*/

ALTER TABLE public.hormone_readings
    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "hormone_readings_select_own"
    ON public.hormone_readings;

CREATE POLICY "hormone_readings_select_own"
ON public.hormone_readings
FOR SELECT
TO authenticated
USING (
    patient_user_id = auth.uid()
);


DROP POLICY IF EXISTS "hormone_readings_insert_own"
    ON public.hormone_readings;

CREATE POLICY "hormone_readings_insert_own"
ON public.hormone_readings
FOR INSERT
TO authenticated
WITH CHECK (
    patient_user_id = auth.uid()
);


/*
===============================================================================
8. REFERENCE RANGES
===============================================================================
*/

ALTER TABLE public.reference_ranges
    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reference_ranges_select_authenticated"
    ON public.reference_ranges;

CREATE POLICY "reference_ranges_select_authenticated"
ON public.reference_ranges
FOR SELECT
TO authenticated
USING (
    true
);


/*
===============================================================================
9. TREND EVENTS
===============================================================================
*/

ALTER TABLE public.trend_events
    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "trend_events_select_own"
    ON public.trend_events;

CREATE POLICY "trend_events_select_own"
ON public.trend_events
FOR SELECT
TO authenticated
USING (
    patient_user_id = auth.uid()
);


DROP POLICY IF EXISTS "trend_events_insert_own"
    ON public.trend_events;

CREATE POLICY "trend_events_insert_own"
ON public.trend_events
FOR INSERT
TO authenticated
WITH CHECK (
    patient_user_id = auth.uid()
);


DROP POLICY IF EXISTS "trend_events_update_own"
    ON public.trend_events;

CREATE POLICY "trend_events_update_own"
ON public.trend_events
FOR UPDATE
TO authenticated
USING (
    patient_user_id = auth.uid()
)
WITH CHECK (
    patient_user_id = auth.uid()
);


/*
===============================================================================
10. NOTIFICATIONS
===============================================================================
*/

ALTER TABLE public.notifications
    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_select_own"
    ON public.notifications;

CREATE POLICY "notifications_select_own"
ON public.notifications
FOR SELECT
TO authenticated
USING (
    patient_user_id = auth.uid()
);


DROP POLICY IF EXISTS "notifications_insert_own"
    ON public.notifications;

CREATE POLICY "notifications_insert_own"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (
    patient_user_id = auth.uid()
);


DROP POLICY IF EXISTS "notifications_update_own"
    ON public.notifications;

CREATE POLICY "notifications_update_own"
ON public.notifications
FOR UPDATE
TO authenticated
USING (
    patient_user_id = auth.uid()
)
WITH CHECK (
    patient_user_id = auth.uid()
);


/*
===============================================================================
11. CONVERSATIONS
===============================================================================
*/

ALTER TABLE public.conversations
    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "conversations_select_participant"
    ON public.conversations;

CREATE POLICY "conversations_select_participant"
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


DROP POLICY IF EXISTS "conversations_insert_patient"
    ON public.conversations;

CREATE POLICY "conversations_insert_patient"
ON public.conversations
FOR INSERT
TO authenticated
WITH CHECK (
    patient_user_id = auth.uid()
);


DROP POLICY IF EXISTS "conversations_update_patient"
    ON public.conversations;

CREATE POLICY "conversations_update_patient"
ON public.conversations
FOR UPDATE
TO authenticated
USING (
    patient_user_id = auth.uid()
)
WITH CHECK (
    patient_user_id = auth.uid()
);


/*
===============================================================================
12. MESSAGES
===============================================================================
*/

ALTER TABLE public.messages
    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "messages_select_participant"
    ON public.messages;

CREATE POLICY "messages_select_participant"
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


DROP POLICY IF EXISTS "messages_insert_patient"
    ON public.messages;

CREATE POLICY "messages_insert_patient"
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


DROP POLICY IF EXISTS "messages_update_patient"
    ON public.messages;

CREATE POLICY "messages_update_patient"
ON public.messages
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.conversations c
        WHERE c.id = messages.conversation_id
          AND c.patient_user_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.conversations c
        WHERE c.id = messages.conversation_id
          AND c.patient_user_id = auth.uid()
    )
);


/*
===============================================================================
13. PREDICTIVE CONSENTS
===============================================================================
*/

ALTER TABLE public.predictive_consents
    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "predictive_consents_select_own"
    ON public.predictive_consents;

CREATE POLICY "predictive_consents_select_own"
ON public.predictive_consents
FOR SELECT
TO authenticated
USING (
    patient_user_id = auth.uid()
);


DROP POLICY IF EXISTS "predictive_consents_insert_own"
    ON public.predictive_consents;

CREATE POLICY "predictive_consents_insert_own"
ON public.predictive_consents
FOR INSERT
TO authenticated
WITH CHECK (
    patient_user_id = auth.uid()
);


DROP POLICY IF EXISTS "predictive_consents_update_own"
    ON public.predictive_consents;

CREATE POLICY "predictive_consents_update_own"
ON public.predictive_consents
FOR UPDATE
TO authenticated
USING (
    patient_user_id = auth.uid()
)
WITH CHECK (
    patient_user_id = auth.uid()
);


/*
===============================================================================
14. PREDICTIONS
===============================================================================
*/

ALTER TABLE public.predictions
    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "predictions_select_own"
    ON public.predictions;

CREATE POLICY "predictions_select_own"
ON public.predictions
FOR SELECT
TO authenticated
USING (
    patient_user_id = auth.uid()
);


DROP POLICY IF EXISTS "predictions_insert_own"
    ON public.predictions;

CREATE POLICY "predictions_insert_own"
ON public.predictions
FOR INSERT
TO authenticated
WITH CHECK (
    patient_user_id = auth.uid()
);


/*
===============================================================================
15. SUBSCRIPTIONS
===============================================================================
*/

ALTER TABLE public.subscriptions
    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "subscriptions_select_own"
    ON public.subscriptions;

CREATE POLICY "subscriptions_select_own"
ON public.subscriptions
FOR SELECT
TO authenticated
USING (
    patient_user_id = auth.uid()
);


DROP POLICY IF EXISTS "subscriptions_insert_own"
    ON public.subscriptions;

CREATE POLICY "subscriptions_insert_own"
ON public.subscriptions
FOR INSERT
TO authenticated
WITH CHECK (
    patient_user_id = auth.uid()
);


DROP POLICY IF EXISTS "subscriptions_update_own"
    ON public.subscriptions;

CREATE POLICY "subscriptions_update_own"
ON public.subscriptions
FOR UPDATE
TO authenticated
USING (
    patient_user_id = auth.uid()
)
WITH CHECK (
    patient_user_id = auth.uid()
);


/*
===============================================================================
16. PAYMENTS
===============================================================================
*/

ALTER TABLE public.payments
    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payments_select_own"
    ON public.payments;

CREATE POLICY "payments_select_own"
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


/*
===============================================================================
17. TEMPORARY ACCESS TOKENS
===============================================================================
*/

ALTER TABLE public.temporary_access_tokens
    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "temporary_access_tokens_select_own"
    ON public.temporary_access_tokens;

CREATE POLICY "temporary_access_tokens_select_own"
ON public.temporary_access_tokens
FOR SELECT
TO authenticated
USING (
    patient_user_id = auth.uid()
);


DROP POLICY IF EXISTS "temporary_access_tokens_insert_own"
    ON public.temporary_access_tokens;

CREATE POLICY "temporary_access_tokens_insert_own"
ON public.temporary_access_tokens
FOR INSERT
TO authenticated
WITH CHECK (
    patient_user_id = auth.uid()
);


DROP POLICY IF EXISTS "temporary_access_tokens_update_own"
    ON public.temporary_access_tokens;

CREATE POLICY "temporary_access_tokens_update_own"
ON public.temporary_access_tokens
FOR UPDATE
TO authenticated
USING (
    patient_user_id = auth.uid()
)
WITH CHECK (
    patient_user_id = auth.uid()
);


/*
===============================================================================
18. AUDIT LOGS
===============================================================================
*/

ALTER TABLE public.audit_logs
    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_logs_select_own"
    ON public.audit_logs;

CREATE POLICY "audit_logs_select_own"
ON public.audit_logs
FOR SELECT
TO authenticated
USING (
    patient_user_id = auth.uid()
    OR actor_user_id = auth.uid()
);


DROP POLICY IF EXISTS "audit_logs_insert_own"
    ON public.audit_logs;

CREATE POLICY "audit_logs_insert_own"
ON public.audit_logs
FOR INSERT
TO authenticated
WITH CHECK (
    actor_user_id = auth.uid()
    OR patient_user_id = auth.uid()
);


/*
===============================================================================
END RLS MIGRATION
===============================================================================
*/



-- ============================================================================
-- MIGRATION: 20260827161050_003_demo_rpc.sql
-- ============================================================================


/*
===============================================================================
ISF TRACKER — COMPREHENSIVE DEMO SEED
===============================================================================

Purpose:
    Creates deterministic synthetic development/demo data for the authenticated
    patient.

Important:
    - This function NEVER accepts a patient/user ID from the client.
    - The patient is always derived from auth.uid().
    - All generated medical data is explicitly synthetic.
    - This function is intended for development/demo environments only.
    - The public application API remains seed_demo_data().
    - There is ONE canonical seed_demo_data() function.

Architecture:
    seed_demo_data()
        |
        +-- creates synthetic patch data
        +-- creates synthetic hormone readings
        +-- creates synthetic trend events
        +-- creates synthetic notifications
        +-- creates synthetic consultant relationships
        +-- creates synthetic conversation/messages
        +-- creates synthetic predictions
        +-- creates synthetic payment test states
        +-- creates audit records

===============================================================================
*/


/*
===============================================================================
1. COMPREHENSIVE DEMO SEED FUNCTION
===============================================================================
*/

CREATE OR REPLACE FUNCTION public.seed_comprehensive_demo_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$

DECLARE

    v_uid uuid;

    v_now timestamptz := now();

    v_patch_id uuid;

    v_demo_patch_serial text;

    v_consultant_id uuid;

    v_subscription_id uuid;

    v_conversation_id uuid;

    v_start timestamptz;

    v_existing_count integer := 0;

    v_inserted_readings integer := 0;

    v_inserted_events integer := 0;

    v_inserted_notifications integer := 0;

    v_inserted_messages integer := 0;

    v_inserted_predictions integer := 0;

    v_inserted_payments integer := 0;

    v_consultant_count integer := 0;

    i integer;

BEGIN

    /*
    ===========================================================================
    AUTHENTICATION
    ===========================================================================
    */

    v_uid := auth.uid();

    IF v_uid IS NULL THEN

        RAISE EXCEPTION
            'Unauthorized: caller must be authenticated.';

    END IF;


    /*
    ===========================================================================
    DEMO WINDOW

    90 readings covering approximately 30 days.
    ===========================================================================
    */

    v_start :=
        v_now - interval '30 days';


    /*
    ===========================================================================
    1. DEMO PATCH
    ===========================================================================
    */

    /*
    Remove only this patient's previous V2 demo patch.

    We identify demo patches by their DEMO-V2 prefix.
    */

    DELETE FROM public.patient_patches

    WHERE patient_user_id = v_uid

      AND patch_id IN (

          SELECT id

          FROM public.patches

          WHERE serial_number LIKE 'ISF-DEMO-V2-%'

      );


    DELETE FROM public.patches

    WHERE serial_number LIKE 'ISF-DEMO-V2-%';


    v_demo_patch_serial :=
        'ISF-DEMO-V2-' ||
        upper(
            substr(
                md5(v_uid::text),
                1,
                8
            )
        );


    INSERT INTO public.patches (
        serial_number,
        model,
        firmware_version,
        status
    )

    VALUES (
        v_demo_patch_serial,
        'ISF-MN-001',
        '2.0.0-demo',
        'active'
    )

    RETURNING id
    INTO v_patch_id;


    /*
    ===========================================================================
    2. PATIENT PATCH
    ===========================================================================
    */

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
        v_start,
        v_start + interval '14 days',
        v_start + interval '12 days',
        v_start + interval '16 days',
        'active',
        78,
        true,
        v_now
    );


    /*
    ===========================================================================
    3. HORMONE READINGS
    ===========================================================================

    Generate 90 synthetic readings.

    One reading every 8 hours across approximately 30 days.
    */

    DELETE FROM public.hormone_readings

    WHERE patient_user_id = v_uid

      AND patch_id = v_patch_id;


    FOR i IN 0..89 LOOP

        INSERT INTO public.hormone_readings (
            patient_user_id,
            patch_id,
            recorded_at,
            androgen_value,
            androgen_unit,
            progesterone_value,
            progesterone_unit,
            quality_status,
            sequence_number,
            firmware_version,
            battery_percent
        )

        VALUES (

            v_uid,

            v_patch_id,

            v_start +
                (i * interval '8 hours'),

            /*
            Synthetic androgen pattern.
            */

            round(
                (
                    42.0
                    +
                    sin(i / 8.0) * 7.0
                    +
                    ((i % 7) - 3) * 0.8
                )::numeric,
                1
            ),

            'nmol/L',

            /*
            Synthetic progesterone pattern.
            */

            round(
                (
                    28.0
                    +
                    cos(i / 9.0) * 6.0
                    +
                    ((i % 5) - 2) * 0.6
                )::numeric,
                1
            ),

            'nmol/L',

            'valid',

            i + 1,

            '2.0.0-demo',

            greatest(
                35,
                98 - floor(i * 0.7)::integer
            )

        );

        v_inserted_readings :=
            v_inserted_readings + 1;

    END LOOP;


    /*
    ===========================================================================
    4. TREND EVENT
    ===========================================================================
    */

    DELETE FROM public.trend_events

    WHERE patient_user_id = v_uid

      AND deduplication_key LIKE
          'demo-v2-%';


    INSERT INTO public.trend_events (
        patient_user_id,
        hormone,
        event_type,
        severity,
        started_at,
        ended_at,
        peak_value,
        baseline_value,
        status,
        deduplication_key
    )

    VALUES

    (
        v_uid,
        'androgen',
        'increasing',
        'moderate',
        v_now - interval '8 days',
        v_now - interval '6 days',
        58.4,
        42.0,
        'resolved',
        'demo-v2-androgen-increasing'
    ),

    (
        v_uid,
        'progesterone',
        'decreasing',
        'mild',
        v_now - interval '5 days',
        v_now - interval '3 days',
        34.2,
        28.0,
        'resolved',
        'demo-v2-progesterone-decreasing'
    ),

    (
        v_uid,
        'androgen',
        'high',
        'moderate',
        v_now - interval '2 days',
        NULL,
        61.7,
        42.0,
        'active',
        'demo-v2-androgen-high'
    );


    GET DIAGNOSTICS
        v_inserted_events = ROW_COUNT;


    /*
    ===========================================================================
    5. NOTIFICATIONS
    ===========================================================================
    */

    DELETE FROM public.notifications

    WHERE patient_user_id = v_uid

      AND type LIKE
          'demo_v2_%';


    INSERT INTO public.notifications (
        patient_user_id,
        consultant_id,
        type,
        channel,
        status,
        body,
        created_at,
        read_at
    )

    VALUES

    (
        v_uid,
        NULL,
        'demo_v2_trend_alert',
        'in_app',
        'pending',
        'Synthetic demo alert: an androgen trend has been detected.',
        v_now - interval '2 days',
        NULL
    ),

    (
        v_uid,
        NULL,
        'demo_v2_demo_notice',
        'in_app',
        'read',
        'Synthetic development data is being displayed for demonstration purposes.',
        v_now - interval '3 days',
        v_now - interval '2 days 20 hours'
    );


    GET DIAGNOSTICS
        v_inserted_notifications = ROW_COUNT;


    /*
    ===========================================================================
    6. CONSULTANT RELATIONSHIPS
    ===========================================================================
    */

    /*
    Remove only previous V2 demo relationships.
    */

    DELETE FROM public.patient_consultants

    WHERE patient_user_id = v_uid;


    /*
    Assign up to 8 existing active consultants.

    We DO NOT manufacture auth.users records here.
    */

    FOR v_consultant_id IN

        SELECT c.id

        FROM public.consultants c

        WHERE c.status = 'active'

        ORDER BY c.created_at ASC

        LIMIT 8

    LOOP

        INSERT INTO public.patient_consultants (
            patient_user_id,
            consultant_id,
            status,
            started_at
        )

        VALUES (
            v_uid,
            v_consultant_id,
            'active',
            v_now - interval '10 days'
        );

        v_consultant_count :=
            v_consultant_count + 1;

    END LOOP;


    /*
    ===========================================================================
    7. CONSULTANT ACCESS CONSENT
    ===========================================================================
    */

    DELETE FROM public.consent_records

    WHERE patient_user_id = v_uid

      AND purpose = 'consultant_access';


    INSERT INTO public.consent_records (
        patient_user_id,
        consultant_id,
        purpose,
        scope,
        status,
        consent_version,
        granted_at
    )

    SELECT

        v_uid,

        pc.consultant_id,

        'consultant_access',

        jsonb_build_object(
            'readings', true,
            'trend_events', true,
            'notifications', true,
            'conversations', true,
            'demo', true
        ),

        'granted',

        '2.0-demo',

        v_now - interval '10 days'

    FROM public.patient_consultants pc

    WHERE pc.patient_user_id = v_uid

      AND pc.status = 'active';


    /*
    ===========================================================================
    8. PREDICTIVE CONSENT
    ===========================================================================
    */

    DELETE FROM public.predictive_consents

    WHERE patient_user_id = v_uid;


    INSERT INTO public.predictive_consents (
        patient_user_id,
        status,
        consent_version,
        granted_at
    )

    VALUES (
        v_uid,
        'granted',
        '2.0-demo',
        v_now - interval '10 days'
    );


    /*
    ===========================================================================
    9. CONVERSATION
    ===========================================================================
    */

    DELETE FROM public.messages

    WHERE conversation_id IN (

        SELECT id

        FROM public.conversations

        WHERE patient_user_id = v_uid

    );


    DELETE FROM public.conversations

    WHERE patient_user_id = v_uid;


    /*
    Use the first active demo consultant.

    If there are no consultants, conversation creation is skipped.
    */

    SELECT pc.consultant_id

    INTO v_consultant_id

    FROM public.patient_consultants pc

    WHERE pc.patient_user_id = v_uid

      AND pc.status = 'active'

    ORDER BY pc.started_at ASC

    LIMIT 1;


    IF v_consultant_id IS NOT NULL THEN

        INSERT INTO public.conversations (
            patient_user_id,
            consultant_id,
            status,
            created_at,
            updated_at
        )

        VALUES (
            v_uid,
            v_consultant_id,
            'active',
            v_now - interval '4 days',
            v_now - interval '1 hour'
        )

        RETURNING id
        INTO v_conversation_id;


        /*
        SYSTEM MESSAGE
        */

        INSERT INTO public.messages (
            conversation_id,
            sender_type,
            sender_id,
            message_type,
            body,
            metadata,
            created_at,
            read_at
        )

        VALUES (
            v_conversation_id,
            'system',
            NULL,
            'consent_notice',
            '[DEMO-COMPREHENSIVE-V2] Conversation initialized for synthetic development data.',
            jsonb_build_object(
                'demo', true,
                'seed_version', '2.0'
            ),
            v_now - interval '4 days',
            v_now - interval '4 days'
        );

        v_inserted_messages :=
            v_inserted_messages + 1;


        /*
        PATIENT MESSAGE
        */

        INSERT INTO public.messages (
            conversation_id,
            sender_type,
            sender_id,
            message_type,
            body,
            metadata,
            created_at,
            read_at
        )

        VALUES (
            v_conversation_id,
            'patient',
            v_uid,
            'text',
            '[DEMO-COMPREHENSIVE-V2] Patient: I have been checking my synthetic trend dashboard and noticed the recent change.',
            jsonb_build_object(
                'demo', true
            ),
            v_now - interval '3 days 6 hours',
            v_now - interval '3 days'
        );

        v_inserted_messages :=
            v_inserted_messages + 1;


        /*
        CONSULTANT MESSAGE
        */

        INSERT INTO public.messages (
            conversation_id,
            sender_type,
            sender_id,
            message_type,
            body,
            metadata,
            created_at,
            read_at
        )

        VALUES (
            v_conversation_id,
            'consultant',
            v_consultant_id,
            'text',
            '[DEMO-COMPREHENSIVE-V2] Consultant: Thanks for checking in. The displayed trend is synthetic demo data; use it to test the dashboard workflow rather than for clinical decisions.',
            jsonb_build_object(
                'demo', true
            ),
            v_now - interval '3 days',
            v_now - interval '2 days 20 hours'
        );

        v_inserted_messages :=
            v_inserted_messages + 1;


        /*
        AUTOMATED TREND ALERT
        */

        INSERT INTO public.messages (
            conversation_id,
            sender_type,
            sender_id,
            message_type,
            body,
            metadata,
            created_at,
            read_at
        )

        VALUES (
            v_conversation_id,
            'automated_alert',
            NULL,
            'trend_alert',
            '[DEMO-COMPREHENSIVE-V2] Automated alert: a synthetic trend event has been added to the patient timeline.',
            jsonb_build_object(
                'demo', true,
                'event_type', 'trend_alert'
            ),
            v_now - interval '2 days 12 hours',
            NULL
        );

        v_inserted_messages :=
            v_inserted_messages + 1;


        /*
        CONSENT NOTICE
        */

        INSERT INTO public.messages (
            conversation_id,
            sender_type,
            sender_id,
            message_type,
            body,
            metadata,
            created_at,
            read_at
        )

        VALUES (
            v_conversation_id,
            'system',
            NULL,
            'consent_notice',
            '[DEMO-COMPREHENSIVE-V2] Consent notice: consultant access is enabled for this synthetic development account.',
            jsonb_build_object(
                'demo', true,
                'consent', 'consultant_access'
            ),
            v_now - interval '2 days',
            v_now - interval '1 day 23 hours'
        );

        v_inserted_messages :=
            v_inserted_messages + 1;


        UPDATE public.conversations

        SET updated_at = v_now

        WHERE id = v_conversation_id;

    END IF;


    /*
    ===========================================================================
    10. PREDICTIONS
    ===========================================================================

    IMPORTANT:

    Conditions use the canonical schema terminology.

        pcos
        type_2_diabetes
        insulin_resistance
        high_blood_pressure
        endometrial_cancer

    There is NO pmos_pcos value.
    */

    DELETE FROM public.predictions

    WHERE patient_user_id = v_uid

      AND model_id = 'isf-demo-v2';


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

    SELECT

        v_uid,

        x.condition,

        x.risk_category,

        x.risk_percentage,

        'isf-demo-v2',

        '2.0-demo',

        'demo-features-2.0',

        v_now,

        v_now + interval '7 days',

        jsonb_build_object(
            'type', 'synthetic_prototype',
            'demo', true,
            'disclaimer',
                'Synthetic development prediction. Not a medical diagnosis.',
            'source_reading_count', 90,
            'source_window_start', v_start,
            'source_window_end', v_now,
            'reference_context', 'demo_prototype'
        ),

        x.trend

    FROM (

        VALUES

        (
            'pcos',
            'elevated',
            58.0::numeric,
            'increasing'
        ),

        (
            'type_2_diabetes',
            'moderate',
            34.0::numeric,
            'stable'
        ),

        (
            'insulin_resistance',
            'elevated',
            51.0::numeric,
            'increasing'
        ),

        (
            'high_blood_pressure',
            'low',
            18.0::numeric,
            'stable'
        ),

        (
            'endometrial_cancer',
            'moderate',
            31.0::numeric,
            'stable'
        )

    ) AS x(
        condition,
        risk_category,
        risk_percentage,
        trend
    );


    GET DIAGNOSTICS
        v_inserted_predictions = ROW_COUNT;


    /*
    ===========================================================================
    11. SUBSCRIPTION
    ===========================================================================

    Preserve one subscription per patient.

    The demo patient remains FREE.
    */

    SELECT s.id

    INTO v_subscription_id

    FROM public.subscriptions s

    WHERE s.patient_user_id = v_uid

    ORDER BY s.created_at ASC

    LIMIT 1;


    IF v_subscription_id IS NULL THEN

        INSERT INTO public.subscriptions (
            patient_user_id,
            plan,
            status,
            provider,
            started_at,
            renewal_at
        )

        VALUES (
            v_uid,
            'free',
            'free',
            'demo',
            v_now - interval '30 days',
            NULL
        )

        RETURNING id
        INTO v_subscription_id;

    END IF;


    /*
    ===========================================================================
    12. PAYMENT TEST DATA
    ===========================================================================
    */

    DELETE FROM public.payments

    WHERE subscription_id = v_subscription_id

      AND provider_reference LIKE
          'DEMO-PAY-V2-%';


    INSERT INTO public.payments (
        subscription_id,
        provider,
        provider_reference,
        amount,
        currency,
        status,
        paid_at,
        raw_reference_hash
    )

    VALUES

    (
        v_subscription_id,
        'demo_gateway',
        'DEMO-PAY-V2-PENDING',
        2499,
        'KES',
        'pending',
        NULL,
        md5('DEMO-PAY-V2-PENDING')
    ),

    (
        v_subscription_id,
        'demo_gateway',
        'DEMO-PAY-V2-COMPLETED',
        2499,
        'KES',
        'completed',
        v_now - interval '8 days',
        md5('DEMO-PAY-V2-COMPLETED')
    ),

    (
        v_subscription_id,
        'demo_gateway',
        'DEMO-PAY-V2-FAILED',
        2499,
        'KES',
        'failed',
        NULL,
        md5('DEMO-PAY-V2-FAILED')
    );


    v_inserted_payments := 3;


    /*
    ===========================================================================
    13. AUDIT LOG
    ===========================================================================
    */

    DELETE FROM public.audit_logs

    WHERE patient_user_id = v_uid

      AND metadata ->> 'seed_version'
          =
          'comprehensive-demo-v2';


    INSERT INTO public.audit_logs (
        actor_user_id,
        patient_user_id,
        action,
        resource_type,
        resource_id,
        metadata,
        created_at
    )

    VALUES

    (
        v_uid,
        v_uid,
        'demo_seeded',
        'demo_dataset',
        v_demo_patch_serial,
        jsonb_build_object(
            'seed_version', 'comprehensive-demo-v2',
            'synthetic', true
        ),
        v_now
    ),

    (
        v_uid,
        v_uid,
        'demo_readings_generated',
        'hormone_readings',
        NULL,
        jsonb_build_object(
            'seed_version', 'comprehensive-demo-v2',
            'count', v_inserted_readings,
            'synthetic', true
        ),
        v_now
    ),

    (
        v_uid,
        v_uid,
        'demo_consultants_assigned',
        'patient_consultants',
        NULL,
        jsonb_build_object(
            'seed_version', 'comprehensive-demo-v2',
            'count', v_consultant_count,
            'synthetic', true
        ),
        v_now
    ),

    (
        v_uid,
        v_uid,
        'demo_predictions_generated',
        'predictions',
        NULL,
        jsonb_build_object(
            'seed_version', 'comprehensive-demo-v2',
            'count', v_inserted_predictions,
            'synthetic', true
        ),
        v_now
    ),

    (
        v_uid,
        v_uid,
        'demo_payment_states_generated',
        'payments',
        NULL,
        jsonb_build_object(
            'seed_version', 'comprehensive-demo-v2',
            'count', v_inserted_payments,
            'synthetic', true
        ),
        v_now
    );


    /*
    ===========================================================================
    14. FINAL COUNT
    ===========================================================================
    */

    SELECT COUNT(*)

    INTO v_existing_count

    FROM public.hormone_readings

    WHERE patient_user_id = v_uid;


    /*
    ===========================================================================
    15. RETURN RESULT
    ===========================================================================
    */

    RETURN jsonb_build_object(

        'success',
        true,

        'synthetic_demo_data',
        true,

        'seed_version',
        'comprehensive-demo-v2',

        'patient_user_id',
        v_uid,

        'readings_generated',
        v_inserted_readings,

        'total_patient_readings',
        v_existing_count,

        'consultants_assigned',
        v_consultant_count,

        'patches',
        1,

        'trend_events_generated',
        v_inserted_events,

        'notifications_generated',
        v_inserted_notifications,

        'messages_generated',
        v_inserted_messages,

        'predictions_generated',
        v_inserted_predictions,

        'payments_generated',
        v_inserted_payments,

        'subscription_plan',
        (
            SELECT plan

            FROM public.subscriptions

            WHERE id = v_subscription_id
        ),

        'warning',
        'All medical data is synthetic development/demo data and is not clinically validated.'

    );

END;

$$;


/*
===============================================================================
2. APPLICATION-COMPATIBLE WRAPPER
===============================================================================

The frontend already calls:

    seed_demo_data()

Therefore this function remains the public application contract.

It delegates to the comprehensive implementation.

IMPORTANT:
This is the ONLY seed_demo_data() definition in this migration.
===============================================================================
*/

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


/*
===============================================================================
3. FUNCTION SECURITY
===============================================================================
*/

REVOKE ALL
ON FUNCTION public.seed_comprehensive_demo_data()
FROM PUBLIC;


REVOKE ALL
ON FUNCTION public.seed_demo_data()
FROM PUBLIC;


GRANT EXECUTE
ON FUNCTION public.seed_comprehensive_demo_data()
TO authenticated;


GRANT EXECUTE
ON FUNCTION public.seed_demo_data()
TO authenticated;


/*
===============================================================================
4. POSTGREST SCHEMA CACHE
===============================================================================
*/

NOTIFY pgrst, 'reload schema';



-- ============================================================================
-- MIGRATION: 20260828000001_canonical_schema.sql
-- ============================================================================

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

-- ============================================================================
-- MIGRATION: 20260828000002_isf_final_reconciliation.sql
-- ============================================================================

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

-- ============================================================================
-- MIGRATION: 20260828100000_predictive_analysis.sql
-- ============================================================================

/*
# ISF Tracker — Predictive Analysis Engine
#
# Prototype/demo prediction engine.
# NOT a clinically validated diagnostic model.
#
# The function:
# 1. Gets the authenticated patient from auth.uid()
# 2. Requires active predictive consent
# 3. Reads recent valid hormone readings
# 4. Calculates prototype risk scores
# 5. Stores five prediction records
# 6. Returns the generated predictions
*/

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

    v_androgen_abnormal numeric;
    v_progesterone_abnormal numeric;

    v_pcos_score numeric;
    v_diabetes_score numeric;
    v_insulin_score numeric;
    v_bp_score numeric;
    v_endometrial_score numeric;

    v_condition text;
    v_score numeric;
    v_category text;
    v_explanation jsonb;
    v_trend text;
BEGIN
    /*
     * 1. Identify authenticated patient.
     */
    v_uid := auth.uid();

    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: caller must be authenticated.';
    END IF;

    /*
     * 2. Require predictive consent.
     */
    IF NOT EXISTS (
        SELECT 1
        FROM public.predictive_consents
        WHERE patient_user_id = v_uid
          AND status = 'granted'
        ORDER BY granted_at DESC
        LIMIT 1
    ) THEN
        RAISE EXCEPTION 'Predictive analysis requires active consent.';
    END IF;

    /*
     * 3. Read the patient's recent valid readings.
     */
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

    /*
     * 4. Require enough data.
     */
    IF v_reading_count < 3 THEN
        RAISE EXCEPTION
            'At least 3 valid hormone readings are required for predictive analysis.';
    END IF;

    /*
     * 5. Estimate abnormality using configured reference ranges.
     *
     * If reference ranges are unavailable, conservative prototype
     * defaults are used.
     */

    SELECT
        CASE
            WHEN rr.lower_normal IS NULL OR rr.upper_normal IS NULL THEN 0
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
      AND (rr.effective_to IS NULL OR rr.effective_to > now())
    ORDER BY rr.effective_from DESC
    LIMIT 1;

    SELECT
        CASE
            WHEN rr.lower_normal IS NULL OR rr.upper_normal IS NULL THEN 0
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
      AND (rr.effective_to IS NULL OR rr.effective_to > now())
    ORDER BY rr.effective_from DESC
    LIMIT 1;

    v_androgen_abnormal := COALESCE(v_androgen_abnormal, 0);
    v_progesterone_abnormal := COALESCE(v_progesterone_abnormal, 0);

    /*
     * 6. Prototype risk calculations.
     *
     * These are intentionally transparent heuristic scores.
     * They are NOT medical diagnoses.
     */

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
     * Helper-style calculation for each condition.
     * Existing predictions are replaced by the latest calculation.
     */

    DELETE FROM public.predictions
    WHERE patient_user_id = v_uid;

    /*
     * PCOS
     */
    v_score := ROUND(v_pcos_score, 1);

    v_category :=
        CASE
            WHEN v_score < 25 THEN 'low'
            WHEN v_score < 50 THEN 'moderate'
            WHEN v_score < 75 THEN 'elevated'
            ELSE 'high'
        END;

    v_trend :=
        CASE
            WHEN v_androgen_abnormal > 25 THEN 'increasing'
            ELSE 'stable'
        END;

    v_explanation := jsonb_build_object(
        'type', 'prototype_heuristic',
        'reading_count', v_reading_count,
        'average_androgen', ROUND(v_avg_androgen, 2),
        'average_progesterone', ROUND(v_avg_progesterone, 2),
        'androgen_abnormality', ROUND(v_androgen_abnormal, 2),
        'progesterone_abnormality', ROUND(v_progesterone_abnormal, 2)
    );

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
        v_trend
    );

    /*
     * Type 2 diabetes
     */
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

    /*
     * Insulin resistance
     */
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

    /*
     * High blood pressure
     */
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

    /*
     * Endometrial cancer
     */
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

    /*
     * 7. Return the newly generated predictions.
     */
    RETURN QUERY
    SELECT *
    FROM public.predictions
    WHERE patient_user_id = v_uid
    ORDER BY calculated_at DESC;

END;
$$;

REVOKE ALL ON FUNCTION public.generate_predictions() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.generate_predictions() TO authenticated;

-- ============================================================================
-- MIGRATION: 20260828120000_passkeys.sql
-- ============================================================================

-- ============================================================================
-- ISF TRACKER
-- PASSKEY / WEBAUTHN STORAGE
-- Migration: 20260828120000_passkeys.sql
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- 1. PASSKEYS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.passkeys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES auth.users(id)
        ON DELETE CASCADE,

    credential_id TEXT NOT NULL UNIQUE,

    public_key TEXT NOT NULL,

    counter BIGINT NOT NULL DEFAULT 0,

    transports TEXT[] NOT NULL DEFAULT '{}',

    device_name TEXT
        DEFAULT 'Biometric Authenticator',

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    last_used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_passkeys_user_id
    ON public.passkeys(user_id);

CREATE INDEX IF NOT EXISTS idx_passkeys_credential_id
    ON public.passkeys(credential_id);

ALTER TABLE public.passkeys
    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS passkeys_select_own
ON public.passkeys;

CREATE POLICY passkeys_select_own
ON public.passkeys
FOR SELECT
TO authenticated
USING (
    user_id = auth.uid()
);

DROP POLICY IF EXISTS passkeys_insert_own
ON public.passkeys;

CREATE POLICY passkeys_insert_own
ON public.passkeys
FOR INSERT
TO authenticated
WITH CHECK (
    user_id = auth.uid()
);

DROP POLICY IF EXISTS passkeys_delete_own
ON public.passkeys;

CREATE POLICY passkeys_delete_own
ON public.passkeys
FOR DELETE
TO authenticated
USING (
    user_id = auth.uid()
);

-- ============================================================================
-- 2. PASSKEY CHALLENGES
--
-- Challenges are short-lived and are consumed after successful verification.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.passkey_challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID
        REFERENCES auth.users(id)
        ON DELETE CASCADE,

    challenge TEXT NOT NULL,

    type TEXT NOT NULL
        CHECK (
            type IN (
                'registration',
                'authentication'
            )
        ),

    expires_at TIMESTAMPTZ NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_passkey_challenges_lookup
ON public.passkey_challenges(
    challenge,
    type,
    expires_at
);

ALTER TABLE public.passkey_challenges
    ENABLE ROW LEVEL SECURITY;

-- No client-side authenticated user should be able to read,
-- insert, modify, or delete challenges directly.
--
-- The backend uses the Supabase service role.
-- Therefore no authenticated policies are intentionally created.

-- ============================================================================
-- 3. CLEAN EXPIRED CHALLENGES
-- ============================================================================

CREATE OR REPLACE FUNCTION public.cleanup_expired_passkey_challenges()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    DELETE FROM public.passkey_challenges
    WHERE expires_at <= now();
$$;

-- ============================================================================
-- MIGRATION: 20260828130000_fix_conversation_rls.sql
-- ============================================================================

BEGIN;

-- ============================================================================
-- ISF TRACKER
-- CONVERSATION RLS REPAIR
-- Migration: 20260828130000_fix_conversation_rls.sql
-- ============================================================================
--
-- Purpose:
--   Remove recursive RLS dependencies from conversations and messages.
--
-- Patient-side access is restricted to records directly owned by auth.uid().
--
-- Consultant authorization is handled by the backend/API layer.
--
-- ============================================================================


-- ============================================================================
-- 1. CONVERSATIONS
-- ============================================================================

DROP POLICY IF EXISTS conversations_select_allowed
ON public.conversations;

DROP POLICY IF EXISTS conversations_insert_patient
ON public.conversations;

DROP POLICY IF EXISTS conversations_update_patient
ON public.conversations;

DROP POLICY IF EXISTS conversations_delete_patient
ON public.conversations;

DROP POLICY IF EXISTS conversations_select_patient
ON public.conversations;

DROP POLICY IF EXISTS conversations_update_patient
ON public.conversations;

DROP POLICY IF EXISTS conversations_delete_patient
ON public.conversations;


CREATE POLICY conversations_select_patient
ON public.conversations
FOR SELECT
TO authenticated
USING (
    patient_user_id = auth.uid()
);


CREATE POLICY conversations_insert_patient
ON public.conversations
FOR INSERT
TO authenticated
WITH CHECK (
    patient_user_id = auth.uid()
);


CREATE POLICY conversations_update_patient
ON public.conversations
FOR UPDATE
TO authenticated
USING (
    patient_user_id = auth.uid()
)
WITH CHECK (
    patient_user_id = auth.uid()
);


CREATE POLICY conversations_delete_patient
ON public.conversations
FOR DELETE
TO authenticated
USING (
    patient_user_id = auth.uid()
);


-- ============================================================================
-- 2. MESSAGES
-- ============================================================================

DROP POLICY IF EXISTS messages_select_allowed
ON public.messages;

DROP POLICY IF EXISTS messages_insert_patient
ON public.messages;

DROP POLICY IF EXISTS messages_update_patient
ON public.messages;

DROP POLICY IF EXISTS messages_delete_patient
ON public.messages;

DROP POLICY IF EXISTS messages_select_patient
ON public.messages;

DROP POLICY IF EXISTS messages_update_patient
ON public.messages;

DROP POLICY IF EXISTS messages_delete_patient
ON public.messages;


CREATE POLICY messages_select_patient
ON public.messages
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.conversations c
        WHERE c.id = messages.conversation_id
          AND c.patient_user_id = auth.uid()
    )
);


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


CREATE POLICY messages_update_patient
ON public.messages
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.conversations c
        WHERE c.id = messages.conversation_id
          AND c.patient_user_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.conversations c
        WHERE c.id = messages.conversation_id
          AND c.patient_user_id = auth.uid()
    )
);


CREATE POLICY messages_delete_patient
ON public.messages
FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.conversations c
        WHERE c.id = messages.conversation_id
          AND c.patient_user_id = auth.uid()
    )
);


COMMIT;

-- ============================================================================
-- MIGRATION: 20260828140000_backend_repair.sql
-- ============================================================================

/*
ISF TRACKER — BACKEND REPAIR

Fixes:
1. Remove profiles-table dependency.
2. Fix consultant/RLS recursion.
3. Create demo consultants.
4. Create prototype reference ranges.
5. Create predictive consent.
6. Create demo patient data.
7. Fix/refresh generate_predictions RPC visibility.
8. Reload PostgREST schema cache.
*/

-- ============================================================
-- 1. CONSULTANT LOOKUP HELPER
-- ============================================================

CREATE OR REPLACE FUNCTION public.current_consultant_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT c.id
    FROM public.consultants c
    WHERE c.user_id = auth.uid()
    LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.current_consultant_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_consultant_id() TO authenticated;


-- ============================================================
-- 2. REMOVE CIRCULAR CONSULTANT POLICIES
-- ============================================================

DROP POLICY IF EXISTS "select_consultants"
ON public.consultants;

DROP POLICY IF EXISTS "isf_consultants_select"
ON public.consultants;

DROP POLICY IF EXISTS "select_own_relationships"
ON public.patient_consultants;

DROP POLICY IF EXISTS "insert_own_relationships"
ON public.patient_consultants;

DROP POLICY IF EXISTS "update_own_relationships"
ON public.patient_consultants;

DROP POLICY IF EXISTS "isf_patient_consultants_select"
ON public.patient_consultants;

DROP POLICY IF EXISTS "isf_patient_consultants_insert"
ON public.patient_consultants;

DROP POLICY IF EXISTS "isf_patient_consultants_update"
ON public.patient_consultants;


-- ============================================================
-- 3. SIMPLE CONSULTANT DIRECTORY POLICY
-- ============================================================

CREATE POLICY "isf_consultants_select_v2"
ON public.consultants
FOR SELECT
TO authenticated
USING (true);


-- ============================================================
-- 4. PATIENT-CONSULTANT RELATIONSHIPS
-- ============================================================

CREATE POLICY "isf_patient_consultants_select_v2"
ON public.patient_consultants
FOR SELECT
TO authenticated
USING (
    patient_user_id = auth.uid()
    OR consultant_id = public.current_consultant_id()
);

CREATE POLICY "isf_patient_consultants_insert_v2"
ON public.patient_consultants
FOR INSERT
TO authenticated
WITH CHECK (
    patient_user_id = auth.uid()
);

CREATE POLICY "isf_patient_consultants_update_v2"
ON public.patient_consultants
FOR UPDATE
TO authenticated
USING (
    patient_user_id = auth.uid()
)
WITH CHECK (
    patient_user_id = auth.uid()
);


-- ============================================================
-- 5. REMOVE CIRCULAR CONVERSATION POLICIES
-- ============================================================

DROP POLICY IF EXISTS "select_own_conversations"
ON public.conversations;

DROP POLICY IF EXISTS "insert_own_conversations"
ON public.conversations;

DROP POLICY IF EXISTS "update_own_conversations"
ON public.conversations;

DROP POLICY IF EXISTS "isf_conversations_select"
ON public.conversations;

DROP POLICY IF EXISTS "isf_conversations_insert"
ON public.conversations;

DROP POLICY IF EXISTS "isf_conversations_update"
ON public.conversations;


CREATE POLICY "isf_conversations_select_v2"
ON public.conversations
FOR SELECT
TO authenticated
USING (
    patient_user_id = auth.uid()
    OR consultant_id = public.current_consultant_id()
);

CREATE POLICY "isf_conversations_insert_v2"
ON public.conversations
FOR INSERT
TO authenticated
WITH CHECK (
    patient_user_id = auth.uid()
);

CREATE POLICY "isf_conversations_update_v2"
ON public.conversations
FOR UPDATE
TO authenticated
USING (
    patient_user_id = auth.uid()
)
WITH CHECK (
    patient_user_id = auth.uid()
);


-- ============================================================
-- 6. REMOVE CIRCULAR MESSAGE POLICIES
-- ============================================================

DROP POLICY IF EXISTS "select_own_messages"
ON public.messages;

DROP POLICY IF EXISTS "insert_own_messages"
ON public.messages;

DROP POLICY IF EXISTS "update_own_messages"
ON public.messages;

DROP POLICY IF EXISTS "isf_messages_select"
ON public.messages;

DROP POLICY IF EXISTS "isf_messages_insert"
ON public.messages;

DROP POLICY IF EXISTS "isf_messages_update"
ON public.messages;


CREATE POLICY "isf_messages_select_v2"
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
            OR c.consultant_id = public.current_consultant_id()
        )
    )
);

CREATE POLICY "isf_messages_insert_v2"
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
            OR c.consultant_id = public.current_consultant_id()
        )
    )
);

CREATE POLICY "isf_messages_update_v2"
ON public.messages
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.conversations c
        WHERE c.id = messages.conversation_id
        AND (
            c.patient_user_id = auth.uid()
            OR c.consultant_id = public.current_consultant_id()
        )
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.conversations c
        WHERE c.id = messages.conversation_id
        AND (
            c.patient_user_id = auth.uid()
            OR c.consultant_id = public.current_consultant_id()
        )
    )
);


-- ============================================================
-- 7. REBUILD DEMO SEED FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION public.seed_demo_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_uid uuid;
    v_patch_id uuid;
    v_consultant_id uuid;
    v_now timestamptz := now();
    v_wear_start timestamptz;
    v_replacement_due timestamptz;

    v_androgen numeric := 42.0;
    v_progesterone numeric := 28.0;

    i integer;
BEGIN

    v_uid := auth.uid();

    IF v_uid IS NULL THEN
        RAISE EXCEPTION
            'Unauthorized: caller must be authenticated.';
    END IF;


    -- ========================================================
    -- PATIENT PROFILE
    -- ========================================================

    INSERT INTO public.patient_profiles (
        user_id,
        full_name,
        language,
        timezone
    )
    VALUES (
        v_uid,
        COALESCE(
            NULLIF(
                auth.jwt() -> 'user_metadata' ->> 'full_name',
                ''
            ),
            'ISF Demo Patient'
        ),
        'en',
        'Africa/Nairobi'
    )
    ON CONFLICT DO NOTHING;


    -- ========================================================
    -- DEMO CONSULTANT 1
    -- ========================================================

    INSERT INTO public.consultants (
        full_name,
        professional_type,
        license_reference,
        organization,
        status,
        initials,
        color,
        online
    )
    SELECT
        'Dr. Amina',
        'gynecologist',
        'DEMO-GYN-001',
        'ISF Demo Clinic',
        'active',
        'DA',
        '#5B8DEF',
        true
    WHERE NOT EXISTS (
        SELECT 1
        FROM public.consultants
        WHERE license_reference = 'DEMO-GYN-001'
    );


    -- ========================================================
    -- DEMO CONSULTANT 2
    -- ========================================================

    INSERT INTO public.consultants (
        full_name,
        professional_type,
        license_reference,
        organization,
        status,
        initials,
        color,
        online
    )
    SELECT
        'Dr. Brian',
        'endocrinologist',
        'DEMO-ENDO-001',
        'ISF Demo Clinic',
        'active',
        'DB',
        '#8B6FD6',
        true
    WHERE NOT EXISTS (
        SELECT 1
        FROM public.consultants
        WHERE license_reference = 'DEMO-ENDO-001'
    );


    -- ========================================================
    -- PROTOTYPE REFERENCE RANGES
    -- ========================================================

    INSERT INTO public.reference_ranges (
        hormone,
        population_context,
        lower_normal,
        upper_normal,
        unit,
        effective_from,
        version
    )
    SELECT
        'androgen',
        'demo_prototype',
        20,
        85,
        'nmol/L',
        v_now,
        'demo-1.0'
    WHERE NOT EXISTS (
        SELECT 1
        FROM public.reference_ranges
        WHERE hormone = 'androgen'
        AND population_context = 'demo_prototype'
        AND version = 'demo-1.0'
    );


    INSERT INTO public.reference_ranges (
        hormone,
        population_context,
        lower_normal,
        upper_normal,
        unit,
        effective_from,
        version
    )
    SELECT
        'progesterone',
        'demo_prototype',
        5,
        60,
        'nmol/L',
        v_now,
        'demo-1.0'
    WHERE NOT EXISTS (
        SELECT 1
        FROM public.reference_ranges
        WHERE hormone = 'progesterone'
        AND population_context = 'demo_prototype'
        AND version = 'demo-1.0'
    );


    -- ========================================================
    -- PREDICTIVE CONSENT
    -- ========================================================

    INSERT INTO public.predictive_consents (
        patient_user_id,
        status,
        consent_version,
        granted_at
    )
    SELECT
        v_uid,
        'granted',
        'demo-1.0',
        v_now
    WHERE NOT EXISTS (
        SELECT 1
        FROM public.predictive_consents
        WHERE patient_user_id = v_uid
        AND status = 'granted'
        AND revoked_at IS NULL
    );


    -- ========================================================
    -- DEMO PATCH
    -- ========================================================

    SELECT pp.patch_id
    INTO v_patch_id
    FROM public.patient_patches pp
    WHERE pp.patient_user_id = v_uid
    AND pp.status = 'active'
    ORDER BY pp.created_at DESC
    LIMIT 1;


    IF v_patch_id IS NULL THEN

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

    END IF;


    -- ========================================================
    -- DEMO HORMONE READINGS
    -- ========================================================

    IF (
        SELECT count(*)
        FROM public.hormone_readings
        WHERE patient_user_id = v_uid
    ) < 3 THEN

        FOR i IN REVERSE 13..0 LOOP

            v_androgen :=
                greatest(
                    20.0,
                    least(
                        85.0,
                        v_androgen +
                        (random() - 0.45) * 8.0
                    )
                );


            v_progesterone :=
                greatest(
                    5.0,
                    least(
                        60.0,
                        v_progesterone +
                        (random() - 0.5) * 6.0
                    )
                );


            INSERT INTO public.hormone_readings (
                patient_user_id,
                patch_id,
                recorded_at,
                androgen_value,
                androgen_unit,
                progesterone_value,
                progesterone_unit,
                quality_status,
                sequence_number,
                firmware_version,
                battery_percent
            )
            VALUES (
                v_uid,
                v_patch_id,
                v_now - (i * interval '12 hours'),
                round(v_androgen, 1),
                'nmol/L',
                round(v_progesterone, 1),
                'nmol/L',
                'valid',
                14 - i,
                '1.0.0',
                78
            );

        END LOOP;

    END IF;


    -- ========================================================
    -- CONSULTANT ASSIGNMENTS + CONSENT
    -- ========================================================

    FOR v_consultant_id IN
        SELECT c.id
        FROM public.consultants c
        WHERE c.status = 'active'
        ORDER BY c.created_at ASC
        LIMIT 2
    LOOP

        INSERT INTO public.patient_consultants (
            patient_user_id,
            consultant_id,
            status
        )
        SELECT
            v_uid,
            v_consultant_id,
            'active'
        WHERE NOT EXISTS (
            SELECT 1
            FROM public.patient_consultants pc
            WHERE pc.patient_user_id = v_uid
            AND pc.consultant_id = v_consultant_id
        );


        INSERT INTO public.consent_records (
            patient_user_id,
            consultant_id,
            purpose,
            scope,
            status,
            consent_version,
            granted_at
        )
        SELECT
            v_uid,
            v_consultant_id,
            'consultant_access',
            '{"demo":true,"scope":"clinical_dashboard"}'::jsonb,
            'granted',
            'demo-1.0',
            v_now
        WHERE NOT EXISTS (
            SELECT 1
            FROM public.consent_records cr
            WHERE cr.patient_user_id = v_uid
            AND cr.consultant_id = v_consultant_id
            AND cr.purpose = 'consultant_access'
            AND cr.status = 'granted'
            AND cr.revoked_at IS NULL
        );

    END LOOP;


    -- ========================================================
    -- FREE SUBSCRIPTION
    -- ========================================================

    INSERT INTO public.subscriptions (
        patient_user_id,
        plan,
        status
    )
    SELECT
        v_uid,
        'free',
        'free'
    WHERE NOT EXISTS (
        SELECT 1
        FROM public.subscriptions
        WHERE patient_user_id = v_uid
    );

END;
$$;


REVOKE ALL
ON FUNCTION public.seed_demo_data()
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.seed_demo_data()
TO authenticated;


-- ============================================================
-- 8. VERIFY PREDICTION FUNCTION
-- ============================================================

DO $$
BEGIN

    IF NOT EXISTS (
        SELECT 1
        FROM pg_proc p
        JOIN pg_namespace n
        ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
        AND p.proname = 'generate_predictions'
        AND p.pronargs = 0
    ) THEN

        RAISE EXCEPTION
            'generate_predictions() does not exist. Apply the predictive_analysis migration first.';

    END IF;

END;
$$;


REVOKE ALL
ON FUNCTION public.generate_predictions()
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.generate_predictions()
TO authenticated;


-- ============================================================
-- 9. FORCE POSTGREST TO RELOAD
-- ============================================================

NOTIFY pgrst, 'reload schema';

NOTIFY pgrst, 'reload config';

-- ============================================================================
-- MIGRATION: 20260828150000_runtime_error_repairs.sql
-- ============================================================================

/*
  ISF TRACKER — RUNTIME ERROR REPAIRS

  Repairs:
  1. Prediction condition mismatch.
  2. Missing hormone readings for the dashboard.
  3. Missing consultants and patient-consultant relationships.
  4. Missing subscription records.
  5. Missing passkey tables.
  6. PostgREST schema cache.
*/

CREATE EXTENSION IF NOT EXISTS pgcrypto;


/* ============================================================================
   1. PREDICTIONS
   ========================================================================== */

/*
  The frontend uses "pmos_pcos".
  Older database records/functions may use "pcos".

  We allow both temporarily and normalize new "pcos" records.
*/

ALTER TABLE public.predictions
DROP CONSTRAINT IF EXISTS predictions_condition_check;

ALTER TABLE public.predictions
ADD CONSTRAINT predictions_condition_check
CHECK (
    condition IN (
        'pmos_pcos',
        'pcos',
        'type_2_diabetes',
        'insulin_resistance',
        'high_blood_pressure',
        'endometrial_cancer'
    )
);


/*
  Convert existing PCOS records to the canonical frontend name.
*/

UPDATE public.predictions
SET condition = 'pmos_pcos'
WHERE condition = 'pcos';


/*
  Normalize future inserts.
*/

CREATE OR REPLACE FUNCTION public.normalize_prediction_condition()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.condition = 'pcos' THEN
        NEW.condition := 'pmos_pcos';
    END IF;

    RETURN NEW;
END;
$$;


DROP TRIGGER IF EXISTS trg_normalize_prediction_condition
ON public.predictions;


CREATE TRIGGER trg_normalize_prediction_condition
BEFORE INSERT OR UPDATE OF condition
ON public.predictions
FOR EACH ROW
EXECUTE FUNCTION public.normalize_prediction_condition();


/* ============================================================================
   2. REFERENCE RANGES
   ========================================================================== */

INSERT INTO public.reference_ranges (
    hormone,
    population_context,
    lower_normal,
    upper_normal,
    unit,
    effective_from,
    version
)
SELECT
    'androgen',
    'demo_prototype',
    20,
    85,
    'nmol/L',
    now(),
    'demo-1.0'
WHERE NOT EXISTS (
    SELECT 1
    FROM public.reference_ranges
    WHERE hormone = 'androgen'
      AND population_context = 'demo_prototype'
      AND version = 'demo-1.0'
);


INSERT INTO public.reference_ranges (
    hormone,
    population_context,
    lower_normal,
    upper_normal,
    unit,
    effective_from,
    version
)
SELECT
    'progesterone',
    'demo_prototype',
    5,
    60,
    'nmol/L',
    now(),
    'demo-1.0'
WHERE NOT EXISTS (
    SELECT 1
    FROM public.reference_ranges
    WHERE hormone = 'progesterone'
      AND population_context = 'demo_prototype'
      AND version = 'demo-1.0'
);


/* ============================================================================
   3. CONSULTANTS
   ========================================================================== */

INSERT INTO public.consultants (
    full_name,
    professional_type,
    license_reference,
    organization,
    status,
    initials,
    color,
    online
)
SELECT
    'Dr. Amina',
    'gynecologist',
    'DEMO-GYN-001',
    'ISF Demo Clinic',
    'active',
    'DA',
    '#5B8DEF',
    true
WHERE NOT EXISTS (
    SELECT 1
    FROM public.consultants
    WHERE license_reference = 'DEMO-GYN-001'
);


INSERT INTO public.consultants (
    full_name,
    professional_type,
    license_reference,
    organization,
    status,
    initials,
    color,
    online
)
SELECT
    'Dr. Brian',
    'endocrinologist',
    'DEMO-ENDO-001',
    'ISF Demo Clinic',
    'active',
    'DB',
    '#8B6FD6',
    true
WHERE NOT EXISTS (
    SELECT 1
    FROM public.consultants
    WHERE license_reference = 'DEMO-ENDO-001'
);


/*
  Assign the demo consultants to every existing authenticated user
  who does not already have them.
*/

INSERT INTO public.patient_consultants (
    patient_user_id,
    consultant_id,
    status
)
SELECT
    u.id,
    c.id,
    'active'
FROM auth.users u
CROSS JOIN public.consultants c
WHERE c.license_reference IN (
    'DEMO-GYN-001',
    'DEMO-ENDO-001'
)
AND c.status = 'active'
AND NOT EXISTS (
    SELECT 1
    FROM public.patient_consultants pc
    WHERE pc.patient_user_id = u.id
      AND pc.consultant_id = c.id
      AND pc.status = 'active'
);


/*
  Give the patient explicit consultant-access consent.
*/

INSERT INTO public.consent_records (
    patient_user_id,
    consultant_id,
    purpose,
    scope,
    status,
    consent_version,
    granted_at
)
SELECT
    u.id,
    c.id,
    'consultant_access',
    jsonb_build_object(
        'current_readings', true,
        'historical_readings', true,
        'trend_alerts', true,
        'chat', true
    ),
    'granted',
    '1.0',
    now()
FROM auth.users u
CROSS JOIN public.consultants c
WHERE c.license_reference IN (
    'DEMO-GYN-001',
    'DEMO-ENDO-001'
)
AND NOT EXISTS (
    SELECT 1
    FROM public.consent_records cr
    WHERE cr.patient_user_id = u.id
      AND cr.consultant_id = c.id
      AND cr.purpose = 'consultant_access'
      AND cr.status = 'granted'
);


/* ============================================================================
   4. HORMONE READINGS
   ========================================================================== */

DO $$
DECLARE
    v_user_id uuid;
    v_androgen numeric;
    v_progesterone numeric;
    v_count integer;
    i integer;
BEGIN

    FOR v_user_id IN
        SELECT id
        FROM auth.users
    LOOP

        SELECT count(*)
        INTO v_count
        FROM public.hormone_readings
        WHERE patient_user_id = v_user_id;


        /*
          Give the dashboard enough demo data to render the chart.
        */

        IF v_count < 3 THEN

            v_androgen := 42;
            v_progesterone := 28;


            FOR i IN REVERSE 13..0 LOOP

                v_androgen :=
                    greatest(
                        20,
                        least(
                            85,
                            v_androgen +
                            (random() - 0.45) * 8
                        )
                    );


                v_progesterone :=
                    greatest(
                        5,
                        least(
                            60,
                            v_progesterone +
                            (random() - 0.50) * 6
                        )
                    );


                INSERT INTO public.hormone_readings (
                    patient_user_id,
                    patch_id,
                    recorded_at,
                    androgen_value,
                    androgen_unit,
                    progesterone_value,
                    progesterone_unit,
                    quality_status,
                    sequence_number,
                    firmware_version,
                    battery_percent
                )
                VALUES (
                    v_user_id,
                    NULL,
                    now() - (i * interval '12 hours'),
                    round(v_androgen, 1),
                    'nmol/L',
                    round(v_progesterone, 1),
                    'nmol/L',
                    'valid',
                    14 - i,
                    '1.0.0',
                    78
                );

            END LOOP;

        END IF;

    END LOOP;

END;
$$;


/* ============================================================================
   5. FREE SUBSCRIPTIONS
   ========================================================================== */

INSERT INTO public.subscriptions (
    patient_user_id,
    plan,
    status
)
SELECT
    u.id,
    'free',
    'free'
FROM auth.users u
WHERE NOT EXISTS (
    SELECT 1
    FROM public.subscriptions s
    WHERE s.patient_user_id = u.id
);


/* ============================================================================
   6. PASSKEY TABLES
   ========================================================================== */

CREATE TABLE IF NOT EXISTS public.passkeys (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id uuid NOT NULL
        REFERENCES auth.users(id)
        ON DELETE CASCADE,

    credential_id text NOT NULL UNIQUE,

    public_key text NOT NULL,

    counter bigint NOT NULL DEFAULT 0,

    transports text[] NOT NULL DEFAULT '{}',

    device_name text
        DEFAULT 'Biometric Authenticator',

    created_at timestamptz NOT NULL DEFAULT now(),

    last_used_at timestamptz
);


CREATE INDEX IF NOT EXISTS idx_passkeys_user_id
ON public.passkeys(user_id);


CREATE INDEX IF NOT EXISTS idx_passkeys_credential_id
ON public.passkeys(credential_id);


ALTER TABLE public.passkeys
ENABLE ROW LEVEL SECURITY;


DROP POLICY IF EXISTS passkeys_select_own
ON public.passkeys;


CREATE POLICY passkeys_select_own
ON public.passkeys
FOR SELECT
TO authenticated
USING (
    user_id = auth.uid()
);


DROP POLICY IF EXISTS passkeys_insert_own
ON public.passkeys;


CREATE POLICY passkeys_insert_own
ON public.passkeys
FOR INSERT
TO authenticated
WITH CHECK (
    user_id = auth.uid()
);


DROP POLICY IF EXISTS passkeys_delete_own
ON public.passkeys;


CREATE POLICY passkeys_delete_own
ON public.passkeys
FOR DELETE
TO authenticated
USING (
    user_id = auth.uid()
);


/*
  Passkey challenges are backend-only.
*/

CREATE TABLE IF NOT EXISTS public.passkey_challenges (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id uuid
        REFERENCES auth.users(id)
        ON DELETE CASCADE,

    challenge text NOT NULL,

    type text NOT NULL
        CHECK (
            type IN (
                'registration',
                'authentication'
            )
        ),

    expires_at timestamptz NOT NULL,

    created_at timestamptz NOT NULL DEFAULT now()
);


CREATE INDEX IF NOT EXISTS idx_passkey_challenges_lookup
ON public.passkey_challenges(
    challenge,
    type,
    expires_at
);


ALTER TABLE public.passkey_challenges
ENABLE ROW LEVEL SECURITY;


/* ============================================================================
   7. POSTGREST
   ========================================================================== */

NOTIFY pgrst, 'reload schema';

NOTIFY pgrst, 'reload config';

-- ============================================================================
-- MIGRATION: 20260829000000_comprehensive_demo_data.sql
-- ============================================================================

/*
===============================================================================
ISF TRACKER — COMPREHENSIVE DEMO DATA
Migration: 20260829000000_comprehensive_demo_data.sql

Purpose:
  Populate the EXISTING canonical ISF Tracker schema with a realistic,
  repeatable development/demo dataset.

IMPORTANT:
  - ALL medical readings, ranges, trend events, predictions and messages in
    this migration are SYNTHETIC DEVELOPMENT/DEMO DATA.
  - They are NOT clinically validated and MUST NOT be presented as medical
    advice, diagnosis, or validated reference data.
  - This migration does NOT create replacement tables such as profiles,
    readings, or message_usage.
  - Existing RLS policies are preserved.
  - The seed function derives the patient exclusively from auth.uid().
  - The RPC accepts NO patient UUID from the browser.
  - This is intended for development/demo environments.

Canonical tables used:
  patient_profiles
  consultants
  patient_consultants
  consent_records
  patches
  patient_patches
  hormone_readings
  reference_ranges
  trend_events
  notifications
  conversations
  messages
  predictive_consents
  predictions
  subscriptions
  payments
  temporary_access_tokens
  audit_logs
===============================================================================
*/

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;


/*
===============================================================================
1. CONSULTANT SPECIALTY COMPATIBILITY

The original canonical consultants table allowed only:

  gynecologist
  endocrinologist
  nutritionist
  other

The MVP demo requires additional specialties.

We modify the CHECK constraint only.
No consultant table is recreated.
===============================================================================
*/

ALTER TABLE public.consultants
    DROP CONSTRAINT IF EXISTS consultants_professional_type_check;

ALTER TABLE public.consultants
    DROP CONSTRAINT IF EXISTS consultants_professional_type_check_v2;

ALTER TABLE public.consultants
    ADD CONSTRAINT consultants_professional_type_check_v2
    CHECK (
        professional_type IN (
            'gynecologist',
            'endocrinologist',
            'reproductive_endocrinologist',
            'nutritionist',
            'womens_health_specialist',
            'primary_care',
            'nurse_care_coordinator',
            'other'
        )
    );


/*
===============================================================================
2. SUPPORTING INDEXES
===============================================================================
*/

CREATE INDEX IF NOT EXISTS idx_consultants_license_reference
    ON public.consultants(license_reference);

CREATE INDEX IF NOT EXISTS idx_patient_patches_patient_created
    ON public.patient_patches(
        patient_user_id,
        created_at DESC
    );

CREATE INDEX IF NOT EXISTS idx_hormone_readings_patient_patch_time
    ON public.hormone_readings(
        patient_user_id,
        patch_id,
        recorded_at DESC
    );

CREATE INDEX IF NOT EXISTS idx_trend_events_dedupe
    ON public.trend_events(deduplication_key)
    WHERE deduplication_key IS NOT NULL;

COMMIT;


/*
===============================================================================
3. COMPREHENSIVE DEMO SEED RPC

Function:
    seed_comprehensive_demo_data()

Identity:
    auth.uid()

The function NEVER accepts a patient UUID.

All generated clinical-looking information is synthetic demo data.
===============================================================================
*/

CREATE OR REPLACE FUNCTION public.seed_comprehensive_demo_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$

DECLARE

    v_uid uuid := auth.uid();

    v_now timestamptz := now();

    v_start timestamptz;

    v_patch_1 uuid;
    v_patch_2 uuid;
    v_patch_3 uuid;

    v_subscription_id uuid;

    v_consultant_id uuid;

    v_conversation_id uuid;

    v_existing_count integer;

    v_inserted_readings integer := 0;
    v_inserted_events integer := 0;
    v_inserted_notifications integer := 0;
    v_inserted_messages integer := 0;
    v_inserted_predictions integer := 0;
    v_inserted_payments integer := 0;

    v_sequence integer;
    v_day integer;
    v_slot integer;

    v_androgen numeric;
    v_progesterone numeric;

    v_battery integer;

    v_quality text;

    v_recorded_at timestamptz;

    v_patient_name text;

    v_demo_patch_serial text;

BEGIN

    /*
    ===========================================================================
    AUTHENTICATION
    ===========================================================================
    */

    IF v_uid IS NULL THEN

        RAISE EXCEPTION
            'Unauthorized: caller must be authenticated.';

    END IF;


    /*
    ===========================================================================
    DETERMINISTIC DEMO IDENTIFIER

    This is based on the authenticated user's ID.

    The user ID is never supplied by the browser.
    ===========================================================================
    */

    v_demo_patch_serial :=
        'ISF-DEMO-' ||
        upper(
            substr(
                md5(v_uid::text),
                1,
                8
            )
        );


    /*
    ===========================================================================
    PATIENT PROFILE
    ===========================================================================
    */

    v_patient_name :=
        COALESCE(
            NULLIF(
                auth.jwt() -> 'user_metadata' ->> 'full_name',
                ''
            ),
            'ISF Demo Patient'
        );


    UPDATE public.patient_profiles
    SET
        full_name =
            CASE
                WHEN full_name IS NULL
                     OR btrim(full_name) = ''
                THEN v_patient_name
                ELSE full_name
            END,

        date_of_birth =
            COALESCE(
                date_of_birth,
                DATE '1998-05-14'
            ),

        language =
            COALESCE(
                language,
                'en'
            ),

        timezone =
            COALESCE(
                timezone,
                'Africa/Nairobi'
            ),

        weight_kg =
            COALESCE(
                weight_kg,
                64.2
            ),

        patient_reference =
            COALESCE(
                patient_reference,
                'DEMO-PATIENT-' ||
                upper(
                    substr(
                        md5(v_uid::text),
                        1,
                        8
                    )
                )
            ),

        updated_at = v_now

    WHERE user_id = v_uid;


    IF NOT FOUND THEN

        INSERT INTO public.patient_profiles (
            user_id,
            full_name,
            date_of_birth,
            language,
            timezone,
            weight_kg,
            patient_reference,
            created_at,
            updated_at
        )
        VALUES (
            v_uid,
            v_patient_name,
            DATE '1998-05-14',
            'en',
            'Africa/Nairobi',
            64.2,
            'DEMO-PATIENT-' ||
            upper(
                substr(
                    md5(v_uid::text),
                    1,
                    8
                )
            ),
            v_now,
            v_now
        );

    END IF;


    /*
    ===========================================================================
    DEMO CONSULTANTS

    These identities are invented.
    They are NOT real clinicians.
    License references are explicitly DEMO values.
    ===========================================================================
    */

    INSERT INTO public.consultants (
        full_name,
        professional_type,
        license_reference,
        organization,
        status,
        initials,
        color,
        online
    )

    SELECT
        x.full_name,
        x.professional_type,
        x.license_reference,
        'ISF Tracker Demo Clinic',
        'active',
        x.initials,
        x.color,
        x.online

    FROM (
        VALUES

        (
            'Dr. Amina Demo',
            'gynecologist',
            'DEMO-GYN-001',
            'AD',
            '#5B8DEF',
            true
        ),

        (
            'Dr. Brian Demo',
            'endocrinologist',
            'DEMO-ENDO-001',
            'BD',
            '#8B6FD6',
            true
        ),

        (
            'Dr. Claire Demo',
            'reproductive_endocrinologist',
            'DEMO-RE-001',
            'CD',
            '#D66FA0',
            false
        ),

        (
            'Grace Demo',
            'nutritionist',
            'DEMO-NUT-001',
            'GD',
            '#58A889',
            true
        ),

        (
            'Dr. Diana Demo',
            'womens_health_specialist',
            'DEMO-WH-001',
            'DD',
            '#D68A5B',
            false
        ),

        (
            'Dr. Elias Demo',
            'primary_care',
            'DEMO-PC-001',
            'ED',
            '#4E9AA8',
            true
        ),

        (
            'Nurse Faith Demo',
            'nurse_care_coordinator',
            'DEMO-NCC-001',
            'FD',
            '#7A9E5B',
            true
        ),

        (
            'Dr. George Demo',
            'other',
            'DEMO-METABOLIC-001',
            'GD',
            '#6C7A89',
            false
        )

    ) AS x(
        full_name,
        professional_type,
        license_reference,
        initials,
        color,
        online
    )

    WHERE NOT EXISTS (
        SELECT 1
        FROM public.consultants c
        WHERE c.license_reference =
              x.license_reference
    );


    /*
    ===========================================================================
    REFRESH DEMO CONSULTANT DISPLAY INFORMATION
    ===========================================================================
    */

    UPDATE public.consultants c

    SET
        full_name = x.full_name,
        professional_type = x.professional_type,
        organization = 'ISF Tracker Demo Clinic',
        status = 'active',
        initials = x.initials,
        color = x.color,
        online = x.online,
        updated_at = v_now

    FROM (
        VALUES

        (
            'Dr. Amina Demo',
            'gynecologist',
            'DEMO-GYN-001',
            'AD',
            '#5B8DEF',
            true
        ),

        (
            'Dr. Brian Demo',
            'endocrinologist',
            'DEMO-ENDO-001',
            'BD',
            '#8B6FD6',
            true
        ),

        (
            'Dr. Claire Demo',
            'reproductive_endocrinologist',
            'DEMO-RE-001',
            'CD',
            '#D66FA0',
            false
        ),

        (
            'Grace Demo',
            'nutritionist',
            'DEMO-NUT-001',
            'GD',
            '#58A889',
            true
        ),

        (
            'Dr. Diana Demo',
            'womens_health_specialist',
            'DEMO-WH-001',
            'DD',
            '#D68A5B',
            false
        ),

        (
            'Dr. Elias Demo',
            'primary_care',
            'DEMO-PC-001',
            'ED',
            '#4E9AA8',
            true
        ),

        (
            'Nurse Faith Demo',
            'nurse_care_coordinator',
            'DEMO-NCC-001',
            'FD',
            '#7A9E5B',
            true
        ),

        (
            'Dr. George Demo',
            'other',
            'DEMO-METABOLIC-001',
            'GD',
            '#6C7A89',
            false
        )

    ) AS x(
        full_name,
        professional_type,
        license_reference,
        initials,
        color,
        online
    )

    WHERE c.license_reference =
          x.license_reference;


    /*
    ===========================================================================
    PROTOTYPE REFERENCE RANGES

    These are NOT clinical reference intervals.
    They exist only for the development/demo interface.
    ===========================================================================
    */

    INSERT INTO public.reference_ranges (
        hormone,
        population_context,
        lower_normal,
        upper_normal,
        unit,
        effective_from,
        effective_to,
        version
    )

    SELECT
        x.hormone,
        'demo_prototype',
        x.lower_normal,
        x.upper_normal,
        'nmol/L',
        v_now,
        NULL,
        'demo-2.0'

    FROM (
        VALUES
            (
                'androgen',
                20::numeric,
                85::numeric
            ),
            (
                'progesterone',
                5::numeric,
                60::numeric
            )
    ) AS x(
        hormone,
        lower_normal,
        upper_normal
    )

    WHERE NOT EXISTS (
        SELECT 1
        FROM public.reference_ranges rr
        WHERE rr.hormone = x.hormone
          AND rr.population_context = 'demo_prototype'
          AND rr.version = 'demo-2.0'
    );


    /*
    ===========================================================================
    THREE DEMO PATCHES

    Patch 1 = replaced
    Patch 2 = replaced
    Patch 3 = current active patch
    ===========================================================================
    */

    INSERT INTO public.patches (
        serial_number,
        model,
        firmware_version,
        status
    )

    VALUES

    (
        v_demo_patch_serial || '-01',
        'ISF-MN-001',
        '1.0.0',
        'replaced'
    ),

    (
        v_demo_patch_serial || '-02',
        'ISF-MN-001',
        '1.1.0',
        'replaced'
    ),

    (
        v_demo_patch_serial || '-03',
        'ISF-MN-001',
        '1.1.0',
        'active'
    )

    ON CONFLICT (
        serial_number
    )

    DO UPDATE SET
        model = EXCLUDED.model,
        firmware_version = EXCLUDED.firmware_version,
        status = EXCLUDED.status;


    SELECT id
    INTO v_patch_1

    FROM public.patches

    WHERE serial_number =
          v_demo_patch_serial || '-01';


    SELECT id
    INTO v_patch_2

    FROM public.patches

    WHERE serial_number =
          v_demo_patch_serial || '-02';


    SELECT id
    INTO v_patch_3

    FROM public.patches

    WHERE serial_number =
          v_demo_patch_serial || '-03';


    /*
    ===========================================================================
    PATCH 1
    ===========================================================================
    */

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

    SELECT
        v_uid,
        v_patch_1,
        v_now - interval '30 days',
        v_now - interval '16 days',
        v_now - interval '18 days',
        v_now - interval '14 days',
        'replaced',
        7,
        false,
        v_now - interval '16 days'

    WHERE NOT EXISTS (
        SELECT 1
        FROM public.patient_patches
        WHERE patient_user_id = v_uid
          AND patch_id = v_patch_1
    );


    UPDATE public.patient_patches

    SET
        wear_started_at =
            v_now - interval '30 days',

        replacement_due_at =
            v_now - interval '16 days',

        replacement_window_start_at =
            v_now - interval '18 days',

        replacement_window_end_at =
            v_now - interval '14 days',

        status = 'replaced',

        battery_percent = 7,

        connected = false,

        last_synced_at =
            v_now - interval '16 days'

    WHERE patient_user_id = v_uid
      AND patch_id = v_patch_1;


    /*
    ===========================================================================
    PATCH 2
    ===========================================================================
    */

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

    SELECT
        v_uid,
        v_patch_2,
        v_now - interval '16 days',
        v_now - interval '2 days',
        v_now - interval '4 days',
        v_now,
        'replaced',
        11,
        false,
        v_now - interval '2 days'

    WHERE NOT EXISTS (
        SELECT 1
        FROM public.patient_patches
        WHERE patient_user_id = v_uid
          AND patch_id = v_patch_2
    );


    UPDATE public.patient_patches

    SET
        wear_started_at =
            v_now - interval '16 days',

        replacement_due_at =
            v_now - interval '2 days',

        replacement_window_start_at =
            v_now - interval '4 days',

        replacement_window_end_at =
            v_now,

        status = 'replaced',

        battery_percent = 11,

        connected = false,

        last_synced_at =
            v_now - interval '2 days'

    WHERE patient_user_id = v_uid
      AND patch_id = v_patch_2;


    /*
    ===========================================================================
    PATCH 3 — CURRENT ACTIVE PATCH
    ===========================================================================
    */

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

    SELECT
        v_uid,
        v_patch_3,
        v_now - interval '2 days',
        v_now + interval '12 days',
        v_now + interval '10 days',
        v_now + interval '14 days',
        'active',
        86,
        true,
        v_now - interval '3 minutes'

    WHERE NOT EXISTS (
        SELECT 1
        FROM public.patient_patches
        WHERE patient_user_id = v_uid
          AND patch_id = v_patch_3
    );


    UPDATE public.patient_patches

    SET
        wear_started_at =
            v_now - interval '2 days',

        replacement_due_at =
            v_now + interval '12 days',

        replacement_window_start_at =
            v_now + interval '10 days',

        replacement_window_end_at =
            v_now + interval '14 days',

        status = 'active',

        battery_percent = 86,

        connected = true,

        last_synced_at =
            v_now - interval '3 minutes'

    WHERE patient_user_id = v_uid
      AND patch_id = v_patch_3;


    /*
    ===========================================================================
    HORMONE READINGS

    30 days x 3 readings/day = 90 readings.

    These values intentionally contain:

      - baseline variation
      - increasing trend
      - sustained high period
      - decreasing trend
      - low period
      - occasional calibration/invalid readings

    They are synthetic demo values.
    ===========================================================================
    */

    DELETE FROM public.hormone_readings hr

    WHERE hr.patient_user_id = v_uid

      AND hr.patch_id IN (
          v_patch_1,
          v_patch_2,
          v_patch_3
      );


    v_start :=
        date_trunc(
            'hour',
            v_now - interval '30 days'
        )
        + interval '1 hour';


    FOR v_sequence IN 1..90 LOOP

        v_day :=
            floor(
                (v_sequence - 1) / 3.0
            )::integer;


        v_slot :=
            (v_sequence - 1) % 3;


        v_recorded_at :=
            v_start
            + (
                (v_sequence - 1)
                * interval '8 hours'
            );


        /*
        -----------------------------------------------------------------------
        ANDROGEN SYNTHETIC PATTERN
        -----------------------------------------------------------------------
        */

        IF v_day <= 9 THEN

            v_androgen :=
                46
                + (
                    v_day * 0.5
                )
                + (
                    sin(
                        v_sequence * 1.7
                    ) * 3.2
                );

        ELSIF v_day <= 15 THEN

            v_androgen :=
                55
                + (
                    (v_day - 10)
                    * 6.0
                )
                + (
                    sin(
                        v_sequence * 1.3
                    ) * 2.6
                );

        ELSIF v_day <= 20 THEN

            v_androgen :=
                89
                + (
                    sin(
                        v_sequence * 1.1
                    ) * 3.4
                );

        ELSIF v_day <= 24 THEN

            v_androgen :=
                80
                - (
                    (v_day - 21)
                    * 10.0
                )
                + (
                    sin(
                        v_sequence * 1.5
                    ) * 2.4
                );

        ELSE

            v_androgen :=
                16
                + (
                    sin(
                        v_sequence * 1.2
                    ) * 2.0
                )
                + (
                    (v_day - 25)
                    * 0.3
                );

        END IF;


        /*
        -----------------------------------------------------------------------
        PROGESTERONE SYNTHETIC PATTERN
        -----------------------------------------------------------------------
        */

        IF v_day <= 9 THEN

            v_progesterone :=
                28
                + (
                    sin(
                        v_sequence * 1.4
                    ) * 2.8
                );

        ELSIF v_day <= 15 THEN

            v_progesterone :=
                31
                + (
                    (v_day - 10)
                    * 3.8
                )
                + (
                    sin(
                        v_sequence * 1.0
                    ) * 2.2
                );

        ELSIF v_day <= 20 THEN

            v_progesterone :=
                63
                + (
                    sin(
                        v_sequence * 1.6
                    ) * 3.8
                );

        ELSIF v_day <= 24 THEN

            v_progesterone :=
                48
                - (
                    (v_day - 21)
                    * 8.5
                )
                + (
                    sin(
                        v_sequence * 1.3
                    ) * 2.0
                );

        ELSE

            v_progesterone :=
                4.5
                + (
                    sin(
                        v_sequence * 1.1
                    ) * 1.0
                )
                + (
                    (v_day - 25)
                    * 0.15
                );

        END IF;


        /*
        -----------------------------------------------------------------------
        BATTERY TELEMETRY
        -----------------------------------------------------------------------
        */

        IF v_day <= 13 THEN

            v_battery :=
                greatest(
                    7,
                    58
                    - floor(
                        v_day * 3.7
                    )::integer
                );

        ELSIF v_day <= 23 THEN

            v_battery :=
                greatest(
                    11,
                    82
                    - floor(
                        (v_day - 14) * 7.0
                    )::integer
                );

        ELSE

            v_battery :=
                greatest(
                    86,
                    95
                    - floor(
                        (v_day - 24) * 3.0
                    )::integer
                );

        END IF;


        /*
        -----------------------------------------------------------------------
        SENSOR QUALITY
        -----------------------------------------------------------------------
        */

        v_quality :=
            CASE

                WHEN v_sequence IN (
                    17,
                    54,
                    81
                )
                THEN 'calibrating'

                WHEN v_sequence IN (
                    29,
                    73
                )
                THEN 'invalid'

                ELSE 'valid'

            END;


        /*
        -----------------------------------------------------------------------
        INSERT READING
        -----------------------------------------------------------------------
        */

        INSERT INTO public.hormone_readings (
            patient_user_id,
            patch_id,
            recorded_at,
            received_at,
            androgen_value,
            androgen_unit,
            progesterone_value,
            progesterone_unit,
            quality_status,
            sequence_number,
            firmware_version,
            battery_percent
        )

        VALUES (
            v_uid,

            CASE
                WHEN v_day <= 13
                THEN v_patch_1

                WHEN v_day <= 23
                THEN v_patch_2

                ELSE v_patch_3
            END,

            v_recorded_at,

            v_recorded_at
            + interval '1 minute',

            round(
                v_androgen::numeric,
                1
            ),

            'nmol/L',

            round(
                v_progesterone::numeric,
                1
            ),

            'nmol/L',

            v_quality,

            v_sequence,

            CASE
                WHEN v_day <= 13
                THEN '1.0.0'
                ELSE '1.1.0'
            END,

            v_battery
        );


        v_inserted_readings :=
            v_inserted_readings + 1;

    END LOOP;


    /*
    ===========================================================================
    PREDICTIVE CONSENT
    ===========================================================================
    */

    INSERT INTO public.predictive_consents (
        patient_user_id,
        status,
        consent_version,
        granted_at,
        revoked_at
    )

    SELECT
        v_uid,
        'granted',
        'demo-2.0',
        v_now - interval '5 days',
        NULL

    WHERE NOT EXISTS (
        SELECT 1
        FROM public.predictive_consents pc

        WHERE pc.patient_user_id = v_uid

          AND pc.status = 'granted'

          AND pc.revoked_at IS NULL
    );


    /*
    ===========================================================================
    CONSULTANT RELATIONSHIPS AND CONSENT

    All eight demo consultants are assigned to the demo patient.

    This is intentionally synthetic.
    ===========================================================================
    */

    FOR v_consultant_id IN

        SELECT c.id

        FROM public.consultants c

        WHERE c.license_reference LIKE 'DEMO-%'

          AND c.status = 'active'

        ORDER BY c.license_reference

    LOOP


        INSERT INTO public.patient_consultants (
            patient_user_id,
            consultant_id,
            status,
            started_at
        )

        SELECT
            v_uid,
            v_consultant_id,
            'active',
            v_now - interval '12 days'

        WHERE NOT EXISTS (
            SELECT 1
            FROM public.patient_consultants pc

            WHERE pc.patient_user_id = v_uid

              AND pc.consultant_id =
                  v_consultant_id

              AND pc.status = 'active'
        );


        IF NOT EXISTS (

            SELECT 1
            FROM public.consent_records cr

            WHERE cr.patient_user_id = v_uid

              AND cr.consultant_id =
                  v_consultant_id

              AND cr.purpose =
                  'consultant_access'

              AND cr.status =
                  'granted'

              AND cr.revoked_at IS NULL

              AND cr.consent_version =
                  'demo-2.0'

        ) THEN


            INSERT INTO public.consent_records (
                patient_user_id,
                consultant_id,
                purpose,
                scope,
                status,
                consent_version,
                granted_at,
                revoked_at
            )

            VALUES (
                v_uid,

                v_consultant_id,

                'consultant_access',

                '{
                    "demo": true,
                    "scope": "clinical_dashboard",
                    "readings": true,
                    "patch_status": true,
                    "trend_alerts": true,
                    "chat": true
                }'::jsonb,

                'granted',

                'demo-2.0',

                v_now - interval '12 days',

                NULL
            );

        END IF;

    END LOOP;


    /*
    ===========================================================================
    TREND EVENTS

    Events are generated from actual synthetic reading windows.

    They are NOT random.
    ===========================================================================
    */

    DELETE FROM public.trend_events

    WHERE patient_user_id = v_uid

      AND deduplication_key LIKE
          'DEMO-COMPREHENSIVE-V2:%';


    /*
    ---------------------------------------------------------------------------
    HIGH ANDROGEN
    ---------------------------------------------------------------------------
    */

    INSERT INTO public.trend_events (
        patient_user_id,
        hormone,
        event_type,
        severity,
        started_at,
        ended_at,
        peak_value,
        baseline_value,
        status,
        deduplication_key
    )

    SELECT
        v_uid,
        'androgen',
        'high',
        'moderate',
        MIN(recorded_at),
        MAX(recorded_at),
        MAX(androgen_value),
        AVG(androgen_value),
        'acknowledged',
        'DEMO-COMPREHENSIVE-V2:androgen:high'

    FROM public.hormone_readings

    WHERE patient_user_id = v_uid

      AND patch_id IN (
          v_patch_1,
          v_patch_2,
          v_patch_3
      )

      AND quality_status = 'valid'

      AND recorded_at >=
          v_start + interval '16 days'

      AND recorded_at <
          v_start + interval '21 days'

    HAVING COUNT(*) >= 3;


    /*
    ---------------------------------------------------------------------------
    LOW ANDROGEN
    ---------------------------------------------------------------------------
    */

    INSERT INTO public.trend_events (
        patient_user_id,
        hormone,
        event_type,
        severity,
        started_at,
        ended_at,
        peak_value,
        baseline_value,
        status,
        deduplication_key
    )

    SELECT
        v_uid,
        'androgen',
        'low',
        'moderate',
        MIN(recorded_at),
        MAX(recorded_at),
        MIN(androgen_value),
        AVG(androgen_value),
        'active',
        'DEMO-COMPREHENSIVE-V2:androgen:low'

    FROM public.hormone_readings

    WHERE patient_user_id = v_uid

      AND patch_id IN (
          v_patch_1,
          v_patch_2,
          v_patch_3
      )

      AND quality_status = 'valid'

      AND recorded_at >=
          v_start + interval '25 days'

    HAVING COUNT(*) >= 3;


    /*
    ---------------------------------------------------------------------------
    INCREASING ANDROGEN
    ---------------------------------------------------------------------------
    */

    INSERT INTO public.trend_events (
        patient_user_id,
        hormone,
        event_type,
        severity,
        started_at,
        ended_at,
        peak_value,
        baseline_value,
        status,
        deduplication_key
    )

    SELECT
        v_uid,
        'androgen',
        'increasing',
        'moderate',
        MIN(recorded_at),
        MAX(recorded_at),
        MAX(androgen_value),
        MIN(androgen_value),
        'resolved',
        'DEMO-COMPREHENSIVE-V2:androgen:increasing'

    FROM public.hormone_readings

    WHERE patient_user_id = v_uid

      AND quality_status = 'valid'

      AND recorded_at >=
          v_start + interval '10 days'

      AND recorded_at <
          v_start + interval '16 days'

    HAVING
        MAX(androgen_value)
        -
        MIN(androgen_value)
        >= 20;


    /*
    ---------------------------------------------------------------------------
    DECREASING ANDROGEN
    ---------------------------------------------------------------------------
    */

    INSERT INTO public.trend_events (
        patient_user_id,
        hormone,
        event_type,
        severity,
        started_at,
        ended_at,
        peak_value,
        baseline_value,
        status,
        deduplication_key
    )

    SELECT
        v_uid,
        'androgen',
        'decreasing',
        'moderate',
        MIN(recorded_at),
        MAX(recorded_at),
        MAX(androgen_value),
        MIN(androgen_value),
        'resolved',
        'DEMO-COMPREHENSIVE-V2:androgen:decreasing'

    FROM public.hormone_readings

    WHERE patient_user_id = v_uid

      AND quality_status = 'valid'

      AND recorded_at >=
          v_start + interval '21 days'

      AND recorded_at <
          v_start + interval '25 days'

    HAVING
        MAX(androgen_value)
        -
        MIN(androgen_value)
        >= 20;


    /*
    ---------------------------------------------------------------------------
    SUSTAINED ABNORMAL PROGESTERONE
    ---------------------------------------------------------------------------
    */

    INSERT INTO public.trend_events (
        patient_user_id,
        hormone,
        event_type,
        severity,
        started_at,
        ended_at,
        peak_value,
        baseline_value,
        status,
        deduplication_key
    )

    SELECT
        v_uid,
        'progesterone',
        'sustained_abnormal',
        'moderate',
        MIN(recorded_at),
        MAX(recorded_at),
        MAX(progesterone_value),
        AVG(progesterone_value),
        'acknowledged',
        'DEMO-COMPREHENSIVE-V2:progesterone:sustained'

    FROM public.hormone_readings

    WHERE patient_user_id = v_uid

      AND quality_status = 'valid'

      AND recorded_at >=
          v_start + interval '16 days'

      AND recorded_at <
          v_start + interval '21 days'

      AND progesterone_value > 60

    HAVING COUNT(*) >= 6;


    /*
    Count the actual events generated.
    */

    SELECT COUNT(*)
    INTO v_inserted_events

    FROM public.trend_events

    WHERE patient_user_id = v_uid

      AND deduplication_key LIKE
          'DEMO-COMPREHENSIVE-V2:%';


    /*
    ===========================================================================
    NOTIFICATIONS
    ===========================================================================
    */

    DELETE FROM public.notifications

    WHERE patient_user_id = v_uid

      AND body LIKE
          '[DEMO-COMPREHENSIVE-V2]%';


    SELECT id
    INTO v_consultant_id

    FROM public.consultants

    WHERE license_reference =
          'DEMO-GYN-001'

    LIMIT 1;


    INSERT INTO public.notifications (
        patient_user_id,
        consultant_id,
        type,
        channel,
        status,
        body,
        sent_at,
        read_at
    )

    VALUES

    (
        v_uid,
        v_consultant_id,
        'trend_alert',
        'in_app',
        'read',

        '[DEMO-COMPREHENSIVE-V2] Androgen trend returned toward the prototype reference range after a sustained high period.',

        v_now - interval '2 days',

        v_now - interval '1 day 20 hours'
    ),

    (
        v_uid,
        v_consultant_id,
        'alert',
        'in_app',
        'sent',

        '[DEMO-COMPREHENSIVE-V2] Sustained progesterone elevation detected in synthetic demo readings. Review the trend with your care team.',

        v_now - interval '1 day',

        NULL
    ),

    (
        v_uid,
        v_consultant_id,
        'trend_alert',
        'in_app',
        'pending',

        '[DEMO-COMPREHENSIVE-V2] Synthetic low androgen readings are continuing in the latest demo window.',

        NULL,

        NULL
    );


    v_inserted_notifications := 3;


    /*
    ===========================================================================
    CONVERSATIONS

    Three dedicated demo conversations:

      - Gynecology
      - Endocrinology
      - Nutrition

    A stable marker prevents duplicate conversations.
    ===========================================================================
    */

    FOR v_consultant_id IN

        SELECT c.id

        FROM public.consultants c

        WHERE c.license_reference IN (
            'DEMO-GYN-001',
            'DEMO-ENDO-001',
            'DEMO-NUT-001'
        )

        ORDER BY c.license_reference

    LOOP


        SELECT c.id
        INTO v_conversation_id

        FROM public.conversations c

        WHERE c.patient_user_id = v_uid

          AND c.consultant_id =
              v_consultant_id

          AND EXISTS (

              SELECT 1

              FROM public.messages m

              WHERE m.conversation_id =
                    c.id

                AND m.body LIKE
                    '[DEMO-COMPREHENSIVE-V2] conversation marker%'

          )

        ORDER BY c.created_at

        LIMIT 1;


        IF v_conversation_id IS NULL THEN


            INSERT INTO public.conversations (
                patient_user_id,
                consultant_id,
                status,
                created_at,
                updated_at
            )

            VALUES (
                v_uid,
                v_consultant_id,
                'active',
                v_now - interval '4 days',
                v_now - interval '1 hour'
            )

            RETURNING id
            INTO v_conversation_id;


            INSERT INTO public.messages (
                conversation_id,
                sender_type,
                sender_id,
                message_type,
                body,
                metadata,
                created_at,
                read_at
            )

            VALUES (
                v_conversation_id,
                'system',
                NULL,
                'consent_notice',

                '[DEMO-COMPREHENSIVE-V2] conversation marker — synthetic development conversation.',

                '{
                    "demo": true,
                    "seed_version": "2.0"
                }'::jsonb,

                v_now - interval '4 days',

                v_now - interval '4 days'
            );


            v_inserted_messages :=
                v_inserted_messages + 1;

        END IF;


        /*
        -----------------------------------------------------------------------
        PATIENT MESSAGE
        -----------------------------------------------------------------------
        */

        IF NOT EXISTS (

            SELECT 1

            FROM public.messages

            WHERE conversation_id =
                  v_conversation_id

              AND body =
                  '[DEMO-COMPREHENSIVE-V2] Patient: I have been checking my synthetic trend dashboard and noticed the recent change.'

        ) THEN


            INSERT INTO public.messages (
                conversation_id,
                sender_type,
                sender_id,
                message_type,
                body,
                metadata,
                created_at,
                read_at
            )

            VALUES (
                v_conversation_id,
                'patient',
                v_uid,
                'text',

                '[DEMO-COMPREHENSIVE-V2] Patient: I have been checking my synthetic trend dashboard and noticed the recent change.',

                '{"demo":true}'::jsonb,

                v_now - interval '3 days 6 hours',

                v_now - interval '3 days'
            );


            v_inserted_messages :=
                v_inserted_messages + 1;

        END IF;


        /*
        -----------------------------------------------------------------------
        CONSULTANT MESSAGE
        -----------------------------------------------------------------------
        */

        IF NOT EXISTS (

            SELECT 1

            FROM public.messages

            WHERE conversation_id =
                  v_conversation_id

              AND body =
                  '[DEMO-COMPREHENSIVE-V2] Consultant: Thanks for checking in. The displayed trend is synthetic demo data; use it to test the dashboard workflow rather than for clinical decisions.'

        ) THEN


            INSERT INTO public.messages (
                conversation_id,
                sender_type,
                sender_id,
                message_type,
                body,
                metadata,
                created_at,
                read_at
            )

            VALUES (
                v_conversation_id,
                'consultant',
                v_consultant_id,
                'text',

                '[DEMO-COMPREHENSIVE-V2] Consultant: Thanks for checking in. The displayed trend is synthetic demo data; use it to test the dashboard workflow rather than for clinical decisions.',

                '{"demo":true}'::jsonb,

                v_now - interval '3 days',

                v_now - interval '2 days 20 hours'
            );


            v_inserted_messages :=
                v_inserted_messages + 1;

        END IF;


        /*
        -----------------------------------------------------------------------
        AUTOMATED TREND ALERT
        -----------------------------------------------------------------------
        */

        IF NOT EXISTS (

            SELECT 1

            FROM public.messages

            WHERE conversation_id =
                  v_conversation_id

              AND body =
                  '[DEMO-COMPREHENSIVE-V2] Automated alert: a synthetic trend event has been added to the patient timeline.'

        ) THEN


            INSERT INTO public.messages (
                conversation_id,
                sender_type,
                sender_id,
                message_type,
                body,
                metadata,
                created_at,
                read_at
            )

            VALUES (
                v_conversation_id,
                'automated_alert',
                NULL,
                'trend_alert',

                '[DEMO-COMPREHENSIVE-V2] Automated alert: a synthetic trend event has been added to the patient timeline.',

                '{
                    "demo": true,
                    "event_type": "trend_alert"
                }'::jsonb,

                v_now - interval '2 days 12 hours',

                NULL
            );


            v_inserted_messages :=
                v_inserted_messages + 1;

        END IF;


        /*
        -----------------------------------------------------------------------
        CONSENT NOTICE
        -----------------------------------------------------------------------
        */

        IF NOT EXISTS (

            SELECT 1

            FROM public.messages

            WHERE conversation_id =
                  v_conversation_id

              AND body =
                  '[DEMO-COMPREHENSIVE-V2] Consent notice: consultant access is enabled for this synthetic development account.'

        ) THEN


            INSERT INTO public.messages (
                conversation_id,
                sender_type,
                sender_id,
                message_type,
                body,
                metadata,
                created_at,
                read_at
            )

            VALUES (
                v_conversation_id,
                'system',
                NULL,
                'consent_notice',

                '[DEMO-COMPREHENSIVE-V2] Consent notice: consultant access is enabled for this synthetic development account.',

                '{
                    "demo": true,
                    "consent": "consultant_access"
                }'::jsonb,

                v_now - interval '2 days',

                v_now - interval '1 day 23 hours'
            );


            v_inserted_messages :=
                v_inserted_messages + 1;

        END IF;


        UPDATE public.conversations

        SET updated_at = v_now

        WHERE id = v_conversation_id;

    END LOOP;


    /*
    ===========================================================================
    DEMO PREDICTIONS

    These records explicitly identify themselves as synthetic prototype data.

    They are based on the generated 90-reading historical window.
    They are NOT diagnoses.
    ===========================================================================
    */

    DELETE FROM public.predictions

    WHERE patient_user_id = v_uid

      AND model_id =
          'isf-demo-v2';


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

    SELECT

        v_uid,

        x.condition,

        x.risk_category,

        x.risk_percentage,

        'isf-demo-v2',

        '2.0-demo',

        'demo-features-2.0',

        v_now,

        v_now + interval '7 days',

        jsonb_build_object(

            'type',
            'synthetic_prototype',

            'demo',
            true,

            'disclaimer',
            'Synthetic development prediction. Not a medical diagnosis.',

            'source_reading_count',
            90,

            'source_window_start',
            v_start,

            'source_window_end',
            v_start + interval '30 days',

            'reference_context',
            'demo_prototype'

        ),

        x.trend

    FROM (

        VALUES

        (
            'pcos',
            'elevated',
            58.0::numeric,
            'increasing'
        ),

        (
            'type_2_diabetes',
            'moderate',
            34.0::numeric,
            'stable'
        ),

        (
            'insulin_resistance',
            'elevated',
            51.0::numeric,
            'increasing'
        ),

        (
            'high_blood_pressure',
            'low',
            18.0::numeric,
            'stable'
        ),

        (
            'endometrial_cancer',
            'moderate',
            31.0::numeric,
            'stable'
        )

    ) AS x(
        condition,
        risk_category,
        risk_percentage,
        trend
    );


    GET DIAGNOSTICS
        v_inserted_predictions =
            ROW_COUNT;


    /*
    ===========================================================================
    SUBSCRIPTION

    IMPORTANT:

    The canonical schema has one subscription per patient.

    We therefore preserve that invariant.

    We DO NOT create a second subscription row for the same patient and we
    DO NOT weaken the unique subscription constraint.

    The authenticated demo patient remains FREE by default.

    Payment records below provide the premium payment lifecycle states for
    testing without incorrectly granting premium access.
    ===========================================================================
    */

    SELECT s.id

    INTO v_subscription_id

    FROM public.subscriptions s

    WHERE s.patient_user_id = v_uid

    ORDER BY s.created_at

    LIMIT 1;


    IF v_subscription_id IS NULL THEN


        INSERT INTO public.subscriptions (
            patient_user_id,
            plan,
            status,
            provider,
            started_at,
            renewal_at
        )

        VALUES (
            v_uid,
            'free',
            'free',
            'demo',
            v_now - interval '30 days',
            NULL
        )

        RETURNING id
        INTO v_subscription_id;

    END IF;


    /*
    ===========================================================================
    PAYMENT TEST DATA

    These are completely synthetic.

      - pending
      - completed
      - failed

    No real financial transaction occurs.
    ===========================================================================
    */

    DELETE FROM public.payments

    WHERE subscription_id =
          v_subscription_id

      AND provider_reference LIKE
          'DEMO-PAY-V2-%';


    INSERT INTO public.payments (
        subscription_id,
        provider,
        provider_reference,
        amount,
        currency,
        status,
        paid_at,
        raw_reference_hash
    )

    VALUES

    (
        v_subscription_id,
        'demo_gateway',
        'DEMO-PAY-V2-PENDING',
        2499,
        'KES',
        'pending',
        NULL,
        md5(
            'DEMO-PAY-V2-PENDING'
        )
    ),

    (
        v_subscription_id,
        'demo_gateway',
        'DEMO-PAY-V2-COMPLETED',
        2499,
        'KES',
        'completed',
        v_now - interval '8 days',
        md5(
            'DEMO-PAY-V2-COMPLETED'
        )
    ),

    (
        v_subscription_id,
        'demo_gateway',
        'DEMO-PAY-V2-FAILED',
        2499,
        'KES',
        'failed',
        NULL,
        md5(
            'DEMO-PAY-V2-FAILED'
        )
    );


    v_inserted_payments := 3;


    /*
    ===========================================================================
    AUDIT LOGS
    ===========================================================================
    */

    DELETE FROM public.audit_logs

    WHERE patient_user_id = v_uid

      AND metadata ->>
          'seed_version'
          =
          'comprehensive-demo-v2';


    INSERT INTO public.audit_logs (
        actor_user_id,
        patient_user_id,
        action,
        resource_type,
        resource_id,
        metadata,
        created_at
    )

    VALUES

    (
        v_uid,
        v_uid,
        'demo_seeded',
        'demo_dataset',
        v_demo_patch_serial,

        '{
            "seed_version": "comprehensive-demo-v2",
            "synthetic": true
        }'::jsonb,

        v_now
    ),

    (
        v_uid,
        v_uid,
        'demo_readings_generated',
        'hormone_readings',
        NULL,

        '{
            "seed_version": "comprehensive-demo-v2",
            "count": 90,
            "synthetic": true
        }'::jsonb,

        v_now
    ),

    (
        v_uid,
        v_uid,
        'demo_consultants_assigned',
        'patient_consultants',
        NULL,

        '{
            "seed_version": "comprehensive-demo-v2",
            "count": 8,
            "synthetic": true
        }'::jsonb,

        v_now
    ),

    (
        v_uid,
        v_uid,
        'demo_predictions_generated',
        'predictions',
        NULL,

        '{
            "seed_version": "comprehensive-demo-v2",
            "count": 5,
            "synthetic": true
        }'::jsonb,

        v_now
    ),

    (
        v_uid,
        v_uid,
        'demo_payment_states_generated',
        'payments',
        NULL,

        '{
            "seed_version": "comprehensive-demo-v2",
            "count": 3,
            "synthetic": true
        }'::jsonb,

        v_now
    );


    /*
    ===========================================================================
    FINAL COUNTS
    ===========================================================================
    */

    SELECT COUNT(*)

    INTO v_existing_count

    FROM public.hormone_readings

    WHERE patient_user_id = v_uid;


    /*
    ===========================================================================
    RETURN RESULT
    ===========================================================================
    */

    RETURN jsonb_build_object(

        'success',
        true,

        'synthetic_demo_data',
        true,

        'seed_version',
        'comprehensive-demo-v2',

        'patient_user_id',
        v_uid,

        'readings_generated',
        v_inserted_readings,

        'total_patient_readings',
        v_existing_count,

        'consultants',
        8,

        'patches',
        3,

        'trend_events_generated',
        v_inserted_events,

        'notifications_generated',
        v_inserted_notifications,

        'messages_generated',
        v_inserted_messages,

        'predictions_generated',
        v_inserted_predictions,

        'payments_generated',
        v_inserted_payments,

        'subscription_plan',
        (
            SELECT plan
            FROM public.subscriptions
            WHERE id = v_subscription_id
        ),

        'warning',
        'All medical data is synthetic development/demo data and is not clinically validated.'

    );

END;
$$;


/*
===============================================================================
4. PRESERVE EXISTING APPLICATION RPC

The existing application already calls:

    seed_demo_data()

Therefore we keep that API contract.

The old function now delegates to the comprehensive seed.
===============================================================================
*/

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


/*
===============================================================================
5. FUNCTION PRIVILEGES

Never expose these functions to PUBLIC.

Only authenticated Supabase users may execute them.
===============================================================================
*/

REVOKE ALL
ON FUNCTION public.seed_comprehensive_demo_data()
FROM PUBLIC;


REVOKE ALL
ON FUNCTION public.seed_demo_data()
FROM PUBLIC;


GRANT EXECUTE
ON FUNCTION public.seed_comprehensive_demo_data()
TO authenticated;


GRANT EXECUTE
ON FUNCTION public.seed_demo_data()
TO authenticated;


/*
===============================================================================
6. POSTGREST SCHEMA CACHE
===============================================================================
*/

NOTIFY pgrst, 'reload schema';



-- ============================================================================
-- MIGRATION: 20260829000001_backend_hardening.sql
-- ============================================================================


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



-- ============================================================================
-- MIGRATION: 20260829010000_seed_demo_final_repair.sql
-- ============================================================================

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

-- ============================================================================
-- MIGRATION: 20260829020000_add_trend_processing_columns.sql
-- ============================================================================

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

-- ============================================================================
-- MIGRATION: 20260829020001_final_mvp_hardening.sql
-- ============================================================================

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

-- ============================================================================
-- MIGRATION: 20260829030000_audit_logs_actor_role_fix.sql
-- ============================================================================

/*
===============================================================================
FIX: audit_logs.actor_role missing column

server/services/qrService.ts and server/services/subscriptionService.ts
insert an `actor_role` value ("patient" | "system") on every audit log
row they write, but no prior migration ever added this column to
public.audit_logs. This produced the runtime error:

    Could not find the 'actor_role' column of 'audit_logs' in the schema cache

This migration adds the column (nullable, so historical rows and any
callers that omit it remain valid) with a constrained vocabulary that
matches every value currently written by the server.
===============================================================================
*/

ALTER TABLE public.audit_logs
    ADD COLUMN IF NOT EXISTS actor_role text;

ALTER TABLE public.audit_logs
    DROP CONSTRAINT IF EXISTS audit_logs_actor_role_check;

ALTER TABLE public.audit_logs
    ADD CONSTRAINT audit_logs_actor_role_check
    CHECK (
        actor_role IS NULL
        OR actor_role IN ('patient', 'consultant', 'system', 'provider')
    );

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_role
    ON public.audit_logs (actor_role);


-- ============================================================================
-- MIGRATION: 20260829040000_messages_sender_type_rls_fix.sql
-- ============================================================================

BEGIN;

/*
===============================================================================
ISF TRACKER
SECURITY FIX: messages.sender_type IMPERSONATION

Migration: 20260829040000_messages_sender_type_rls_fix.sql
===============================================================================

FINDING (audited 2026-08-30):

  The currently active INSERT policy on public.messages
  ("isf_messages_insert_v2", defined in
  20260828140000_backend_repair.sql) only verifies that the
  caller is a participant of the target conversation:

      WITH CHECK (
          EXISTS (
              SELECT 1 FROM public.conversations c
              WHERE c.id = messages.conversation_id
              AND (
                  c.patient_user_id = auth.uid()
                  OR c.consultant_id = public.current_consultant_id()
              )
          )
      );

  It never inspects messages.sender_type. Because
  messages.sender_type only has a CHECK constraint restricting
  it to ('patient','consultant','system','automated_alert') --
  not an identity check -- any authenticated participant can
  insert a row claiming to be 'system' or 'automated_alert', or
  a patient can claim 'consultant' and vice versa.

FIX:

  Replace the INSERT policy so that:

    - A caller who is the conversation's patient may only insert
      sender_type = 'patient'.
    - A caller who is the conversation's assigned consultant may
      only insert sender_type = 'consultant'.
    - No row satisfying the "authenticated" policy may ever set
      sender_type IN ('system', 'automated_alert'). Those message
      types must be written exclusively by server code using the
      service-role client (supabaseAdmin), which bypasses RLS by
      design and is not subject to this policy at all.

  This is additive/replacing by policy name only -- no existing
  migration file is edited, no table is dropped, no data is
  touched.
===============================================================================
*/

DROP POLICY IF EXISTS "isf_messages_insert_v2"
ON public.messages;

CREATE POLICY "isf_messages_insert_v3"
ON public.messages
FOR INSERT
TO authenticated
WITH CHECK (
    (
        sender_type = 'patient'
        AND EXISTS (
            SELECT 1
            FROM public.conversations c
            WHERE c.id = messages.conversation_id
              AND c.patient_user_id = auth.uid()
        )
    )
    OR
    (
        sender_type = 'consultant'
        AND EXISTS (
            SELECT 1
            FROM public.conversations c
            WHERE c.id = messages.conversation_id
              AND c.consultant_id = public.current_consultant_id()
        )
    )
);

COMMENT ON POLICY "isf_messages_insert_v3" ON public.messages IS
    'Restricts INSERT so a caller can only claim the sender_type '
    'matching their actual relationship to the conversation. '
    'system/automated_alert messages are intentionally excluded '
    'and must be written via the service-role client.';

COMMIT;


-- ============================================================================
-- MIGRATION: 20260829050000_consent_conversation_assignment_check.sql
-- ============================================================================

BEGIN;

/*
===============================================================================
ISF TRACKER
SECURITY FIX: consent_records / conversations INSERT missing assignment check

Migration: 20260829050000_consent_conversation_assignment_check.sql
===============================================================================

FINDING (audited 2026-08-30):

  The currently active INSERT policies on public.consent_records
  ("consent_records_insert_own", 20260828000002_isf_final_reconciliation.sql)
  and public.conversations ("isf_conversations_insert_v2",
  20260828140000_backend_repair.sql) only verify ownership:

      WITH CHECK (patient_user_id = auth.uid())

  Neither verifies that the target consultant_id is actually an
  active consultant assigned to that patient via
  public.patient_consultants. A patient could therefore create a
  "granted" consent_records row, or open a conversation, against
  any consultant_id in the system -- including consultants never
  assigned to them -- and that consultant's own SELECT policies
  would then surface the record to them.

FIX:

  Both INSERT policies now additionally require an active row in
  public.patient_consultants linking the caller (as patient) to
  the target consultant_id. This mirrors the check already
  performed server-side in
  server/routes/chat.ts (POST /consultants/:consultantId/consent),
  as defense-in-depth at the database layer for any caller that
  reaches these tables directly.

  Additive/replacing by policy name only -- no existing migration
  file is edited, no data is touched.
===============================================================================
*/

-- ============================================================================
-- 1. CONSENT_RECORDS
-- ============================================================================

DROP POLICY IF EXISTS "consent_records_insert_own"
ON public.consent_records;

DROP POLICY IF EXISTS consent_records_insert_own
ON public.consent_records;

CREATE POLICY consent_records_insert_own
ON public.consent_records
FOR INSERT
TO authenticated
WITH CHECK (
    patient_user_id = auth.uid()
    AND (
        -- predictive_analysis consent has no consultant_id
        consultant_id IS NULL
        OR EXISTS (
            SELECT 1
            FROM public.patient_consultants pc
            WHERE pc.patient_user_id = auth.uid()
              AND pc.consultant_id = consent_records.consultant_id
              AND pc.status = 'active'
        )
    )
);

-- ============================================================================
-- 2. CONVERSATIONS
-- ============================================================================

DROP POLICY IF EXISTS "isf_conversations_insert_v2"
ON public.conversations;

DROP POLICY IF EXISTS isf_conversations_insert_v2
ON public.conversations;

CREATE POLICY "isf_conversations_insert_v3"
ON public.conversations
FOR INSERT
TO authenticated
WITH CHECK (
    patient_user_id = auth.uid()
    AND EXISTS (
        SELECT 1
        FROM public.patient_consultants pc
        WHERE pc.patient_user_id = auth.uid()
          AND pc.consultant_id = conversations.consultant_id
          AND pc.status = 'active'
    )
);

COMMENT ON POLICY consent_records_insert_own ON public.consent_records IS
    'Requires an active patient_consultants assignment before a '
    'patient can grant consent to a given consultant_id.';

COMMENT ON POLICY "isf_conversations_insert_v3" ON public.conversations IS
    'Requires an active patient_consultants assignment before a '
    'patient can open a conversation with a given consultant_id.';

COMMIT;

