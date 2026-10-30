import { Router } from "express";

import { requireAuth } from "../middleware/auth";
import { supabaseAdmin } from "../lib/supabaseAdmin";

const router = Router();

/**
 * GET /api/trends
 *
 * Returns trend events belonging to the authenticated patient.
 */
router.get(
  "/",
  requireAuth,
  async (req: any, res, next) => {
    try {
      const { data, error } =
        await supabaseAdmin
          .from("trend_events")
          .select(
            `
              id,
              patient_user_id,
              hormone,
              event_type,
              severity,
              status,
              started_at,
              resolved_at,
              created_at
            `,
          )
          .eq(
            "patient_user_id",
            req.user.id,
          )
          .order("started_at", {
            ascending: false,
          });

      if (error) {
        throw error;
      }

      return res.json(data || []);
    } catch (error) {
      next(error);
    }
  },
);

export default router;