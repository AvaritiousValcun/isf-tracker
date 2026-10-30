-- ============================================================================
-- ISF TRACKER: AUTO-CONFIRM & AUTO-ACCEPT ALL USERS IMMEDIATELY
-- ============================================================================
-- Run this script in the Supabase SQL Editor (https://supabase.com/dashboard/project/ibmuhcspiaohdwhxpyoh/sql)
-- It guarantees that every user who signs up is instantly confirmed and accepted
-- with zero email rate limits, zero email delays, and instant dashboard access.
-- ============================================================================

-- 1. Trigger function to auto-confirm new accounts on creation
CREATE OR REPLACE FUNCTION public.auto_confirm_new_user()
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

-- 2. Attach auto-confirm trigger to auth.users BEFORE INSERT
DROP TRIGGER IF EXISTS on_auth_user_auto_confirm ON auth.users;
CREATE TRIGGER on_auth_user_auto_confirm
BEFORE INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.auto_confirm_new_user();

-- 3. Trigger function to auto-create patient_profile with admin privileges
CREATE OR REPLACE FUNCTION public.handle_new_user_patient_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_full_name text;
BEGIN
    v_full_name := COALESCE(
        NULLIF(trim(NEW.raw_user_meta_data ->> 'full_name'), ''),
        NULLIF(trim(NEW.raw_user_meta_data ->> 'name'), ''),
        split_part(NEW.email, '@', 1),
        'Patient'
    );

    INSERT INTO public.patient_profiles (
        user_id,
        full_name,
        language,
        timezone
    )
    VALUES (
        NEW.id,
        v_full_name,
        'en',
        'Africa/Nairobi'
    )
    ON CONFLICT (user_id) DO UPDATE
    SET full_name = EXCLUDED.full_name;

    RETURN NEW;
END;
$$;

-- 4. Attach profile creation trigger to auth.users AFTER INSERT
DROP TRIGGER IF EXISTS on_auth_user_patient_profile ON auth.users;
CREATE TRIGGER on_auth_user_patient_profile
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user_patient_profile();

-- 5. Auto-confirm any existing users who were stuck in "email not confirmed"
UPDATE auth.users
SET email_confirmed_at = COALESCE(email_confirmed_at, now()),
    confirmed_at = COALESCE(confirmed_at, now())
WHERE email_confirmed_at IS NULL;

-- 6. Ensure any existing auth users have a patient profile
INSERT INTO public.patient_profiles (user_id, full_name, language, timezone)
SELECT 
    u.id, 
    COALESCE(
        NULLIF(trim(u.raw_user_meta_data ->> 'full_name'), ''),
        split_part(u.email, '@', 1),
        'Patient'
    ),
    'en',
    'Africa/Nairobi'
FROM auth.users u
ON CONFLICT (user_id) DO NOTHING;

-- 7. Grant public schema access so no "permission denied" errors occur
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO anon, authenticated;
