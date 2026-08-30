
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

