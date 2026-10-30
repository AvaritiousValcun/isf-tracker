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

