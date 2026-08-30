-- Migration to update handle_new_user to insert into patient_profiles

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS \$\$
BEGIN

    -- 1. Insert into legacy profiles table (if it exists)
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
        COALESCE(NEW.raw_user_meta_data ->> 'first_name', ''),
        COALESCE(NEW.raw_user_meta_data ->> 'last_name', '')
    )
    ON CONFLICT (id) DO NOTHING;

    -- 2. Insert into new patient_profiles table
    INSERT INTO public.patient_profiles (
        user_id,
        full_name,
        language,
        timezone
    )
    VALUES (
        NEW.id,
        COALESCE(
            NEW.raw_user_meta_data ->> 'full_name',
            NEW.raw_user_meta_data ->> 'name',
            ''
        ),
        'en',
        'Africa/Nairobi'
    )
    ON CONFLICT (user_id) DO NOTHING;

    RETURN NEW;
END;
\$\$;
