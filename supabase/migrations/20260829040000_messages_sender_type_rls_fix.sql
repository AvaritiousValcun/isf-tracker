BEGIN;

/*
===============================================================================
ISF TRACKER
SECURITY FIX: messages.sender_type IMPERSONATION

Migration: 20260829040000_messages_sender_type_rls_fix.sql
===============================================================================

FINDING (audited 2026-08-30):

  The currently active INSERT policy on public.messages
  ("isf_messages_insert_v2", defined in
  20260828140000_backend_repair.sql) only verifies that the
  caller is a participant of the target conversation:

      WITH CHECK (
          EXISTS (
              SELECT 1 FROM public.conversations c
              WHERE c.id = messages.conversation_id
              AND (
                  c.patient_user_id = auth.uid()
                  OR c.consultant_id = public.current_consultant_id()
              )
          )
      );

  It never inspects messages.sender_type. Because
  messages.sender_type only has a CHECK constraint restricting
  it to ('patient','consultant','system','automated_alert') --
  not an identity check -- any authenticated participant can
  insert a row claiming to be 'system' or 'automated_alert', or
  a patient can claim 'consultant' and vice versa.

FIX:

  Replace the INSERT policy so that:

    - A caller who is the conversation's patient may only insert
      sender_type = 'patient'.
    - A caller who is the conversation's assigned consultant may
      only insert sender_type = 'consultant'.
    - No row satisfying the "authenticated" policy may ever set
      sender_type IN ('system', 'automated_alert'). Those message
      types must be written exclusively by server code using the
      service-role client (supabaseAdmin), which bypasses RLS by
      design and is not subject to this policy at all.

  This is additive/replacing by policy name only -- no existing
  migration file is edited, no table is dropped, no data is
  touched.
===============================================================================
*/

DROP POLICY IF EXISTS "isf_messages_insert_v2"
ON public.messages;

CREATE POLICY "isf_messages_insert_v3"
ON public.messages
FOR INSERT
TO authenticated
WITH CHECK (
    (
        sender_type = 'patient'
        AND EXISTS (
            SELECT 1
            FROM public.conversations c
            WHERE c.id = messages.conversation_id
              AND c.patient_user_id = auth.uid()
        )
    )
    OR
    (
        sender_type = 'consultant'
        AND EXISTS (
            SELECT 1
            FROM public.conversations c
            WHERE c.id = messages.conversation_id
              AND c.consultant_id = public.current_consultant_id()
        )
    )
);

COMMENT ON POLICY "isf_messages_insert_v3" ON public.messages IS
    'Restricts INSERT so a caller can only claim the sender_type '
    'matching their actual relationship to the conversation. '
    'system/automated_alert messages are intentionally excluded '
    'and must be written via the service-role client.';

COMMIT;
