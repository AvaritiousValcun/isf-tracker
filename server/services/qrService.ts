
import crypto from "node:crypto";

import { supabaseAdmin } from "../lib/supabaseAdmin.js";

const QR_EXPIRATION_HOURS = 24;

function hashToken(token: string): string {
  return crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
}

function generateToken(): string {
  return crypto
    .randomBytes(32)
    .toString("hex");
}

export class QRService {
  /**
   * Create a temporary access token.
   *
   * Canonical table:
   * temporary_access_tokens
   */
  static async createSession(
    patientUserId: string,
    scope: string[],
  ) {
    const rawToken =
      generateToken();

    const tokenHash =
      hashToken(rawToken);

    const expiresAt =
      new Date(
        Date.now() +
          QR_EXPIRATION_HOURS *
            60 *
            60 *
            1000,
      );

    const scopeObject =
      scope.reduce(
        (
          result: Record<
            string,
            boolean
          >,
          item,
        ) => {
          result[item] = true;
          return result;
        },
        {},
      );

    const { data, error } =
      await supabaseAdmin
        .from(
          "temporary_access_tokens",
        )
        .insert({
          patient_user_id:
            patientUserId,
          token_hash:
            tokenHash,
          scope:
            scopeObject,
          expires_at:
            expiresAt.toISOString(),
          revoked_at: null,
        })
        .select(
          "id, patient_user_id, scope, expires_at, revoked_at, created_at",
        )
        .single();

    if (error) {
      throw error;
    }

    await this.logAudit(
      patientUserId,
      patientUserId,
      "temporary_access_token_created",
      data.id,
      {
        scope: scopeObject,
        expiresAt:
          expiresAt.toISOString(),
      },
    );

    return {
      sessionId: data.id,
      token: rawToken,
      expiresAt:
        data.expires_at,
      scope:
        data.scope,
    };
  }

  /**
   * List patient's temporary access tokens.
   *
   * Never returns token_hash.
   */
  static async listSessions(
    patientUserId: string,
  ) {
    const { data, error } =
      await supabaseAdmin
        .from(
          "temporary_access_tokens",
        )
        .select(
          "id, scope, expires_at, revoked_at, created_at",
        )
        .eq(
          "patient_user_id",
          patientUserId,
        )
        .order(
          "created_at",
          {
            ascending: false,
          },
        );

    if (error) {
      throw error;
    }

    return data || [];
  }

  /**
   * Resolve a raw QR token.
   */
  static async resolveSession(
    rawToken: string,
  ) {
    if (
      !rawToken ||
      rawToken.length < 32
    ) {
      throw new Error(
        "Invalid or expired QR token",
      );
    }

    const tokenHash =
      hashToken(rawToken);

    const { data: session, error } =
      await supabaseAdmin
        .from(
          "temporary_access_tokens",
        )
        .select(
          `
            id,
            patient_user_id,
            scope,
            expires_at,
            revoked_at
          `,
        )
        .eq(
          "token_hash",
          tokenHash,
        )
        .maybeSingle();

    if (error) {
      throw error;
    }

    if (!session) {
      throw new Error(
        "Invalid or expired QR token",
      );
    }

    if (
      new Date(
        session.expires_at,
      ).getTime() <= Date.now()
    ) {
      await this.logAudit(
        null,
        session.patient_user_id,
        "temporary_access_token_expired",
        session.id,
        {},
      );

      throw new Error(
        "This QR code has expired",
      );
    }

    if (session.revoked_at) {
      await this.logAudit(
        null,
        session.patient_user_id,
        "temporary_access_token_revoked",
        session.id,
        {},
      );

      throw new Error(
        "This QR code has been revoked",
      );
    }

    const scope =
      session.scope &&
      typeof session.scope === "object"
        ? session.scope
        : {};

    const payload: Record<
      string,
      unknown
    > = {
      patient_user_id:
        session.patient_user_id,
      scope_granted:
        scope,
      expires_at:
        session.expires_at,
    };

    const scopeAllows = (
      key: string,
    ) =>
      scope[key] === true;

    if (
      scopeAllows(
        "patient_profile",
      ) ||
      scopeAllows("profile")
    ) {
      const { data: profile, error } =
        await supabaseAdmin
          .from("patient_profiles")
          .select(
            `
              user_id,
              full_name,
              date_of_birth,
              language,
              timezone,
              weight_kg,
              patient_reference
            `,
          )
          .eq(
            "user_id",
            session.patient_user_id,
          )
          .maybeSingle();

      if (error) {
        throw error;
      }

      payload.profile =
        profile || null;
    }

    if (
      scopeAllows(
        "current_readings",
      ) ||
      scopeAllows(
        "readings",
      ) ||
      scopeAllows(
        "readings_latest",
      )
    ) {
      const { data: readings, error } =
        await supabaseAdmin
          .from("hormone_readings")
          .select(
            `
              id,
              androgen_value,
              progesterone_value,
              units,
              recorded_at
            `,
          )
          .eq(
            "patient_user_id",
            session.patient_user_id,
          )
          .order(
            "recorded_at",
            {
              ascending: false,
            },
          )
          .limit(1);

      if (error) {
        throw error;
      }

      payload.latest_readings =
        readings || [];
    }

    if (
      scopeAllows(
        "historical_readings",
      ) ||
      scopeAllows(
        "readings_history",
      )
    ) {
      const { data: readings, error } =
        await supabaseAdmin
          .from("hormone_readings")
          .select(
            `
              id,
              androgen_value,
              progesterone_value,
              units,
              recorded_at
            `,
          )
          .eq(
            "patient_user_id",
            session.patient_user_id,
          )
          .order(
            "recorded_at",
            {
              ascending: false,
            },
          )
          .limit(100);

      if (error) {
        throw error;
      }

      payload.readings =
        readings || [];
    }

    if (
      scopeAllows(
        "patch_status",
      )
    ) {
      const { data: assignment, error } =
        await supabaseAdmin
          .from("patient_patches")
          .select(
            `
              id,
              patch_id,
              status,
              wear_started_at,
              replacement_due_at,
              battery_percent,
              connected,
              last_synced_at,
              patches (
                id,
                serial_number,
                status
              )
            `,
          )
          .eq(
            "patient_user_id",
            session.patient_user_id,
          )
          .order(
            "wear_started_at",
            {
              ascending: false,
            },
          )
          .limit(1)
          .maybeSingle();

      if (error) {
        throw error;
      }

      const patch =
        Array.isArray(
          assignment?.patches,
        )
          ? assignment.patches[0] ||
            null
          : assignment?.patches ||
            null;

      payload.patch_status =
        assignment
          ? {
              assignment_id:
                assignment.id,
              patch_id:
                assignment.patch_id,
              assignment_status:
                assignment.status,
              wear_started_at:
                assignment.wear_started_at,
              replacement_due_at:
                assignment.replacement_due_at,
              battery_percent:
                assignment.battery_percent,
              connected:
                assignment.connected,
              patch,
            }
          : null;
    }

    await this.logAudit(
      null,
      session.patient_user_id,
      "temporary_access_token_used",
      session.id,
      {},
    );

    return payload;
  }

  /**
   * Revoke a token.
   */
  static async revokeSession(
    patientUserId: string,
    sessionId: string,
  ) {
    const { data, error } =
      await supabaseAdmin
        .from(
          "temporary_access_tokens",
        )
        .update({
          revoked_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          sessionId,
        )
        .eq(
          "patient_user_id",
          patientUserId,
        )
        .is(
          "revoked_at",
          null,
        )
        .select(
          "id, scope, expires_at, revoked_at, created_at",
        )
        .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      throw new Error(
        "Temporary access token not found or already revoked",
      );
    }

    await this.logAudit(
      patientUserId,
      patientUserId,
      "temporary_access_token_revoked",
      sessionId,
      {},
    );

    return data;
  }

  /**
   * Canonical audit logger.
   *
   * Uses actor_user_id rather than the obsolete actor_id.
   */
  private static async logAudit(
    actorUserId:
      | string
      | null,
    patientUserId:
      | string
      | null,
    action: string,
    resourceId: string,
    metadata: Record<
      string,
      unknown
    >,
  ) {
    const { error } =
      await supabaseAdmin
        .from("audit_logs")
        .insert({
          actor_user_id:
            actorUserId,
          patient_user_id:
            patientUserId,
          actor_role:
            actorUserId
              ? "patient"
              : "system",
          action,
          resource_type:
            "temporary_access_token",
          resource_id:
            resourceId,
          metadata,
        });

    if (error) {
      console.error(
        "[QRService] Audit log error:",
        error,
      );
    }
  }
}

