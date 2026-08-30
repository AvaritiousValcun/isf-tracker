/*
===============================================================================
FIX: audit_logs.actor_role missing column

server/services/qrService.ts and server/services/subscriptionService.ts
insert an `actor_role` value ("patient" | "system") on every audit log
row they write, but no prior migration ever added this column to
public.audit_logs. This produced the runtime error:

    Could not find the 'actor_role' column of 'audit_logs' in the schema cache

This migration adds the column (nullable, so historical rows and any
callers that omit it remain valid) with a constrained vocabulary that
matches every value currently written by the server.
===============================================================================
*/

ALTER TABLE public.audit_logs
    ADD COLUMN IF NOT EXISTS actor_role text;

ALTER TABLE public.audit_logs
    DROP CONSTRAINT IF EXISTS audit_logs_actor_role_check;

ALTER TABLE public.audit_logs
    ADD CONSTRAINT audit_logs_actor_role_check
    CHECK (
        actor_role IS NULL
        OR actor_role IN ('patient', 'consultant', 'system', 'provider')
    );

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_role
    ON public.audit_logs (actor_role);
