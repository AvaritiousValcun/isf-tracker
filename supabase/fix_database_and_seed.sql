-- ============================================================================
-- ISF TRACKER: COMPLETE DATABASE RECONCILIATION & AUTO-SEED
-- ============================================================================
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/ibmuhcspiaohdwhxpyoh/sql/new

-- 0. RELAX / DROP LEGACY CHECK CONSTRAINTS
ALTER TABLE public.consultants
DROP CONSTRAINT IF EXISTS consultants_professional_type_check,
DROP CONSTRAINT IF EXISTS consultants_professional_type_check_v2;

ALTER TABLE public.hormone_readings
DROP CONSTRAINT IF EXISTS hormone_readings_reading_quality_check,
DROP CONSTRAINT IF EXISTS hormone_readings_quality_status_check;

ALTER TABLE public.patient_patches
DROP CONSTRAINT IF EXISTS patient_patches_status_check;

ALTER TABLE public.predictive_consents
DROP CONSTRAINT IF EXISTS predictive_consents_status_check;

ALTER TABLE public.consent_records
DROP CONSTRAINT IF EXISTS consent_records_status_check;

ALTER TABLE public.subscriptions
DROP CONSTRAINT IF EXISTS subscriptions_status_check,
DROP CONSTRAINT IF EXISTS subscriptions_tier_check;

-- 1. FIX TABLE: patches
ALTER TABLE public.patches
ADD COLUMN IF NOT EXISTS model text NOT NULL DEFAULT 'ISF-MN-001',
ADD COLUMN IF NOT EXISTS firmware_version text NOT NULL DEFAULT '1.0.0';

-- 2. FIX TABLE: patient_patches
ALTER TABLE public.patient_patches
ALTER COLUMN patient_id DROP NOT NULL,
ALTER COLUMN applied_at DROP NOT NULL;

ALTER TABLE public.patient_patches
ADD COLUMN IF NOT EXISTS patient_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS wear_started_at timestamptz DEFAULT now(),
ADD COLUMN IF NOT EXISTS replacement_due_at timestamptz DEFAULT (now() + interval '14 days'),
ADD COLUMN IF NOT EXISTS replacement_window_start_at timestamptz DEFAULT (now() + interval '12 days'),
ADD COLUMN IF NOT EXISTS replacement_window_end_at timestamptz DEFAULT (now() + interval '16 days'),
ADD COLUMN IF NOT EXISTS battery_percent integer DEFAULT 88,
ADD COLUMN IF NOT EXISTS connected boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS last_synced_at timestamptz DEFAULT now();

-- 3. FIX TABLE: predictive_consents
ALTER TABLE public.predictive_consents
ALTER COLUMN patient_id DROP NOT NULL,
ALTER COLUMN model_type DROP NOT NULL,
ALTER COLUMN consent_granted DROP NOT NULL;

ALTER TABLE public.predictive_consents
ADD COLUMN IF NOT EXISTS patient_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'granted',
ADD COLUMN IF NOT EXISTS consent_version text NOT NULL DEFAULT '1.0',
ADD COLUMN IF NOT EXISTS revoked_at timestamptz;

-- 4. FIX TABLE: hormone_readings
ALTER TABLE public.hormone_readings
ALTER COLUMN patient_id DROP NOT NULL;

ALTER TABLE public.hormone_readings
ADD COLUMN IF NOT EXISTS patient_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS androgen_value numeric,
ADD COLUMN IF NOT EXISTS progesterone_value numeric,
ADD COLUMN IF NOT EXISTS battery_percent integer DEFAULT 88,
ADD COLUMN IF NOT EXISTS reading_quality text DEFAULT 'good',
ADD COLUMN IF NOT EXISTS quality_status text DEFAULT 'good',
ADD COLUMN IF NOT EXISTS estrogen_pg_ml numeric,
ADD COLUMN IF NOT EXISTS progesterone_ng_ml numeric,
ADD COLUMN IF NOT EXISTS cortisol_ug_dl numeric,
ADD COLUMN IF NOT EXISTS lh_miu_ml numeric,
ADD COLUMN IF NOT EXISTS fsh_miu_ml numeric;

-- 5. FIX TABLE: consent_records
ALTER TABLE public.consent_records
ALTER COLUMN patient_id DROP NOT NULL,
ALTER COLUMN consent_type DROP NOT NULL;

ALTER TABLE public.consent_records
ADD COLUMN IF NOT EXISTS patient_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS purpose text DEFAULT 'consultant_access',
ADD COLUMN IF NOT EXISTS scope text DEFAULT 'all',
ADD COLUMN IF NOT EXISTS status text DEFAULT 'active',
ADD COLUMN IF NOT EXISTS granted_at timestamptz DEFAULT now(),
ADD COLUMN IF NOT EXISTS revoked_at timestamptz;

-- 6. FIX TABLE: patient_consultants
ALTER TABLE public.patient_consultants
ALTER COLUMN patient_id DROP NOT NULL;

ALTER TABLE public.patient_consultants
ADD COLUMN IF NOT EXISTS patient_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS status text DEFAULT 'active',
ADD COLUMN IF NOT EXISTS started_at timestamptz DEFAULT now();

-- 7. FIX TABLE: subscriptions
ALTER TABLE public.subscriptions
ALTER COLUMN patient_id DROP NOT NULL;

ALTER TABLE public.subscriptions
ADD COLUMN IF NOT EXISTS patient_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS plan text DEFAULT 'free',
ADD COLUMN IF NOT EXISTS status text DEFAULT 'active',
ADD COLUMN IF NOT EXISTS renewal_at timestamptz DEFAULT (now() + interval '30 days');

-- 8. FIX TABLE: trend_events
ALTER TABLE public.trend_events
ALTER COLUMN patient_id DROP NOT NULL;

ALTER TABLE public.trend_events
ADD COLUMN IF NOT EXISTS patient_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS hormone text DEFAULT 'estradiol';

-- 9. ENSURE CONSULTANTS EXIST AND ARE ACTIVE
UPDATE public.consultants
SET status = 'active', active = true, online = true;

INSERT INTO public.consultants (
    id,
    full_name,
    professional_type,
    license_reference,
    phone_contact,
    clinic_facility,
    active,
    status,
    initials,
    color,
    online
)
VALUES
    (
        '375d31f5-c96f-4d11-8934-be6aec206f56',
        'Dr. Amina Patel',
        'endocrinologist',
        'KMPDC-RE-4412',
        '+254 711 000 001',
        'Aga Khan University Hospital, Nairobi',
        true,
        'active',
        'AP',
        '#0EA5A4',
        true
    ),
    (
        'b4d81234-5678-4abc-9def-0123456789ab',
        'Dr. David Kim',
        'gynecologist',
        'KMPDC-OB-8891',
        '+254 711 000 002',
        'Nairobi Hospital Women Health Wing',
        true,
        'active',
        'DK',
        '#2C4C5C',
        true
    )
ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    professional_type = EXCLUDED.professional_type,
    status = 'active',
    active = true,
    online = true,
    initials = EXCLUDED.initials,
    color = EXCLUDED.color;

-- 10. REUSABLE SEED FUNCTION FOR ANY USER
CREATE OR REPLACE FUNCTION public.seed_user_patient_data(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_profile_id uuid;
    v_patch_id uuid;
    v_now timestamptz := now();
    i integer;
    v_androgen numeric;
    v_progesterone numeric;
    v_cortisol numeric;
    v_consultant record;
BEGIN
    -- Ensure patient profile exists
    INSERT INTO public.patient_profiles (user_id, full_name, language, timezone)
    SELECT 
        target_user_id,
        COALESCE(
            NULLIF(trim(raw_user_meta_data ->> 'full_name'), ''),
            NULLIF(trim(raw_user_meta_data ->> 'name'), ''),
            split_part(email, '@', 1),
            'Patient'
        ),
        'en',
        'Africa/Nairobi'
    FROM auth.users
    WHERE id = target_user_id
    ON CONFLICT (user_id) DO NOTHING;

    SELECT id INTO v_profile_id
    FROM public.patient_profiles
    WHERE user_id = target_user_id;

    -- Create patch
    INSERT INTO public.patches (
        serial_number,
        model,
        firmware_version,
        status
    )
    VALUES (
        'ISF-MN-' || upper(substr(md5(target_user_id::text || random()::text), 1, 8)),
        'ISF-MN-001',
        '1.0.0',
        'active'
    )
    RETURNING id INTO v_patch_id;

    -- Link patch to patient
    DELETE FROM public.patient_patches WHERE patient_user_id = target_user_id;
    INSERT INTO public.patient_patches (
        patient_id,
        patient_user_id,
        patch_id,
        wear_started_at,
        replacement_due_at,
        battery_percent,
        connected,
        status,
        last_synced_at
    )
    VALUES (
        v_profile_id,
        target_user_id,
        v_patch_id,
        v_now - interval '3 days',
        v_now + interval '11 days',
        88,
        true,
        'active',
        v_now
    );

    -- Seed 24 realistic hormone readings over the last 12 days
    DELETE FROM public.hormone_readings WHERE patient_user_id = target_user_id;
    FOR i IN 0..23 LOOP
        v_androgen := 38.0 + (sin(i::numeric * 0.45) * 8.5) + (random() * 2.0);
        v_progesterone := 18.0 + (cos(i::numeric * 0.35) * 12.0) + (random() * 1.5);
        v_cortisol := 11.0 + (sin(i::numeric * 0.6) * 3.5);

        INSERT INTO public.hormone_readings (
            patient_id,
            patient_user_id,
            patch_id,
            recorded_at,
            androgen_value,
            progesterone_value,
            estrogen_pg_ml,
            progesterone_ng_ml,
            cortisol_ug_dl,
            battery_percent,
            quality_status,
            reading_quality
        )
        VALUES (
            v_profile_id,
            target_user_id,
            v_patch_id,
            v_now - (i * interval '12 hours'),
            round(v_androgen, 1),
            round(v_progesterone, 1),
            round(v_androgen * 3.8, 1),
            round(v_progesterone * 0.65, 1),
            round(v_cortisol, 1),
            GREATEST(20, 88 - (i * 2)),
            'good',
            'good'
        );
    END LOOP;

    -- Assign consultants to patient
    DELETE FROM public.patient_consultants WHERE patient_user_id = target_user_id;
    FOR v_consultant IN
        SELECT id FROM public.consultants WHERE status = 'active' LIMIT 2
    LOOP
        INSERT INTO public.patient_consultants (
            patient_id,
            patient_user_id,
            consultant_id,
            status,
            started_at
        )
        VALUES (
            v_profile_id,
            target_user_id,
            v_consultant.id,
            'active',
            v_now - interval '7 days'
        )
        ON CONFLICT DO NOTHING;

        INSERT INTO public.consent_records (
            patient_id,
            patient_user_id,
            consultant_id,
            purpose,
            scope,
            status,
            granted_at
        )
        VALUES (
            v_profile_id,
            target_user_id,
            v_consultant.id,
            'consultant_access',
            'all',
            'active',
            v_now - interval '7 days'
        )
        ON CONFLICT DO NOTHING;
    END LOOP;

    -- Predictive consent
    DELETE FROM public.predictive_consents WHERE patient_user_id = target_user_id;
    INSERT INTO public.predictive_consents (
        patient_id,
        patient_user_id,
        model_type,
        consent_granted,
        status,
        consent_version,
        granted_at
    )
    VALUES (
        v_profile_id,
        target_user_id,
        'pcos',
        true,
        'granted',
        '1.0',
        v_now - interval '14 days'
    );

    -- Subscription
    DELETE FROM public.subscriptions WHERE patient_user_id = target_user_id;
    INSERT INTO public.subscriptions (
        patient_id,
        patient_user_id,
        tier,
        plan,
        status,
        renewal_at
    )
    VALUES (
        v_profile_id,
        target_user_id,
        'free',
        'free',
        'active',
        v_now + interval '30 days'
    );
END;
$$;

-- 11. SEED DATA RIGHT NOW FOR EVERY EXISTING USER IN AUTH.USERS
DO $$
DECLARE
    r record;
BEGIN
    FOR r IN SELECT id FROM auth.users LOOP
        PERFORM public.seed_user_patient_data(r.id);
    END LOOP;
END;
$$;

-- 12. UPDATE SEED_DEMO_DATA RPC
CREATE OR REPLACE FUNCTION public.seed_demo_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_uid uuid;
BEGIN
    v_uid := auth.uid();
    IF v_uid IS NOT NULL THEN
        PERFORM public.seed_user_patient_data(v_uid);
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.seed_demo_data() TO authenticated, anon;

-- 13. AUTO-SEED TRIGGER FOR ALL FUTURE USERS
CREATE OR REPLACE FUNCTION public.handle_new_user_complete_setup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    NEW.email_confirmed_at = COALESCE(NEW.email_confirmed_at, now());
    NEW.confirmed_at = COALESCE(NEW.confirmed_at, now());
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_auto_confirm ON auth.users;
CREATE TRIGGER on_auth_user_auto_confirm
BEFORE INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user_complete_setup();

CREATE OR REPLACE FUNCTION public.after_user_created_seed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    PERFORM public.seed_user_patient_data(NEW.id);
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_seed_data ON auth.users;
CREATE TRIGGER on_auth_user_seed_data
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.after_user_created_seed();

-- 14. GRANT COMPREHENSIVE PRIVILEGES
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO anon, authenticated, service_role;
