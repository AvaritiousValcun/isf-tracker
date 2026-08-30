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