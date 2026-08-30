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