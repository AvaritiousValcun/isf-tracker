
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

