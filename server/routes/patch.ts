
import { Router } from "express";

import { requireAuth } from "../middleware/auth.js";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";

const router = Router();

/**
 * GET /api/patch
 *
 * Returns the latest patch assignment for
 * the authenticated patient.
 */
router.get(
  "/",
  requireAuth,
  async (req: any, res, next) => {
    try {
      const patientUserId =
        req.user.id;

      const { data, error } =
        await supabaseAdmin
          .from("patient_patches")
          .select(
            `
              id,
              patient_user_id,
              patch_id,
              status,
              wear_started_at,
              replacement_due_at,
              replacement_window_start_at,
              replacement_window_end_at,
              battery_percent,
              connected,
              last_synced_at,
              created_at,
              patches (
                id,
                serial_number,
                model,
                firmware_version,
                status,
                created_at
              )
            `,
          )
          .eq(
            "patient_user_id",
            patientUserId,
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

      if (!data) {
        return res.json(null);
      }

      const patch =
        Array.isArray(
          data.patches,
        )
          ? data.patches[0] ||
            null
          : data.patches ||
            null;

      return res.json({
        id: data.id,
        patient_user_id:
          data.patient_user_id,
        patch_id:
          data.patch_id,

        assignment_status:
          data.status,

        wear_started_at:
          data.wear_started_at,

        replacement_due_at:
          data.replacement_due_at,

        replacement_window_start_at:
          data.replacement_window_start_at,

        replacement_window_end_at:
          data.replacement_window_end_at,

        // Kept for backward-compat with older clients that read `activated_at`.
        activated_at:
          data.wear_started_at,

        serial_number:
          patch?.serial_number ||
          null,

        // Kept for backward-compat with older clients that read `device_identifier`.
        device_identifier:
          patch?.serial_number ||
          null,

        battery_percent:
          data.battery_percent ??
          null,

        connected:
          data.connected ??
          false,

        status:
          patch?.status ||
          "unassigned",

        last_synced_at:
          data.last_synced_at ||
          null,

        patch:
          patch || null,
      });
    } catch (error) {
      next(error);
    }
  },
);

export default router;

