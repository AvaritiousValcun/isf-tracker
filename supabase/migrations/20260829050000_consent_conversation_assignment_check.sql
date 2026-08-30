BEGIN;

/*
===============================================================================
ISF TRACKER
SECURITY FIX: consent_records / conversations INSERT missing assignment check

Migration: 20260829050000_consent_conversation_assignment_check.sql
===============================================================================

FINDING (audited 2026-08-30):

  The currently active INSERT policies on public.consent_records
  ("consent_records_insert_own", 20260828000002_isf_final_reconciliation.sql)
  and public.conversations ("isf_conversations_insert_v2",
  20260828140000_backend_repair.sql) only verify ownership:

      WITH CHECK (patient_user_id = auth.uid())

  Neither verifies that the target consultant_id is actually an
  active consultant assigned to that patient via
  public.patient_consultants. A patient could therefore create a
  "granted" consent_records row, or open a conversation, against
  any consultant_id in the system -- including consultants never
  assigned to them -- and that consultant's own SELECT policies
  would then surface the record to them.

FIX:

  Both INSERT policies now additionally require an active row in
  public.patient_consultants linking the caller (as patient) to
  the target consultant_id. This mirrors the check already
  performed server-side in
  server/routes/chat.ts (POST /consultants/:consultantId/consent),
  as defense-in-depth at the database layer for any caller that
  reaches these tables directly.

  Additive/replacing by policy name only -- no existing migration
  file is edited, no data is touched.
===============================================================================
*/

-- ============================================================================
-- 1. CONSENT_RECORDS
-- ============================================================================

DROP POLICY IF EXISTS "consent_records_insert_own"
ON public.consent_records;

DROP POLICY IF EXISTS consent_records_insert_own
ON public.consent_records;

CREATE POLICY consent_records_insert_own
ON public.consent_records
FOR INSERT
TO authenticated
WITH CHECK (
    patient_user_id = auth.uid()
    AND (
        -- predictive_analysis consent has no consultant_id
        consultant_id IS NULL
        OR EXISTS (
            SELECT 1
            FROM public.patient_consultants pc
            WHERE pc.patient_user_id = auth.uid()
              AND pc.consultant_id = consent_records.consultant_id
              AND pc.status = 'active'
        )
    )
);

-- ============================================================================
-- 2. CONVERSATIONS
-- ============================================================================

DROP POLICY IF EXISTS "isf_conversations_insert_v2"
ON public.conversations;

DROP POLICY IF EXISTS isf_conversations_insert_v2
ON public.conversations;

CREATE POLICY "isf_conversations_insert_v3"
ON public.conversations
FOR INSERT
TO authenticated
WITH CHECK (
    patient_user_id = auth.uid()
    AND EXISTS (
        SELECT 1
        FROM public.patient_consultants pc
        WHERE pc.patient_user_id = auth.uid()
          AND pc.consultant_id = conversations.consultant_id
          AND pc.status = 'active'
    )
);

COMMENT ON POLICY consent_records_insert_own ON public.consent_records IS
    'Requires an active patient_consultants assignment before a '
    'patient can grant consent to a given consultant_id.';

COMMENT ON POLICY "isf_conversations_insert_v3" ON public.conversations IS
    'Requires an active patient_consultants assignment before a '
    'patient can open a conversation with a given consultant_id.';

COMMIT;
