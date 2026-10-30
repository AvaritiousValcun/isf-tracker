BEGIN;

-- ============================================================================
-- ISF TRACKER
-- CONVERSATION RLS REPAIR
-- ============================================================================
--
-- Purpose:
--   Remove recursive RLS dependencies from conversations and messages.
--
-- The patient-side application only needs direct ownership checks:
--
--   conversations.patient_user_id = auth.uid()
--
-- Consultant authorization is handled by the backend/API layer and can be
-- expanded later with SECURITY DEFINER authorization functions.
--
-- ============================================================================


-- ============================================================================
-- 1. CONVERSATIONS
-- ============================================================================

DROP POLICY IF EXISTS conversations_select_allowed
ON public.conversations;

DROP POLICY IF EXISTS conversations_insert_patient
ON public.conversations;

DROP POLICY IF EXISTS conversations_update_patient
ON public.conversations;

DROP POLICY IF EXISTS conversations_delete_patient
ON public.conversations;


CREATE POLICY conversations_select_patient
ON public.conversations
FOR SELECT
TO authenticated
USING (
    patient_user_id = auth.uid()
);


CREATE POLICY conversations_insert_patient
ON public.conversations
FOR INSERT
TO authenticated
WITH CHECK (
    patient_user_id = auth.uid()
);


CREATE POLICY conversations_update_patient
ON public.conversations
FOR UPDATE
TO authenticated
USING (
    patient_user_id = auth.uid()
)
WITH CHECK (
    patient_user_id = auth.uid()
);


CREATE POLICY conversations_delete_patient
ON public.conversations
FOR DELETE
TO authenticated
USING (
    patient_user_id = auth.uid()
);


-- ============================================================================
-- 2. MESSAGES
-- ============================================================================

DROP POLICY IF EXISTS messages_select_allowed
ON public.messages;

DROP POLICY IF EXISTS messages_insert_patient
ON public.messages;

DROP POLICY IF EXISTS messages_update_patient
ON public.messages;

DROP POLICY IF EXISTS messages_delete_patient;


CREATE POLICY messages_select_patient
ON public.messages
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.conversations c
        WHERE c.id = messages.conversation_id
          AND c.patient_user_id = auth.uid()
    )
);


CREATE POLICY messages_insert_patient
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


CREATE POLICY messages_update_patient
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


CREATE POLICY messages_delete_patient
ON public.messages
FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.conversations c
        WHERE c.id = messages.conversation_id
          AND c.patient_user_id = auth.uid()
    )
);


COMMIT;