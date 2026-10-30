
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

