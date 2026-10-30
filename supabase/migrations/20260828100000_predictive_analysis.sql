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