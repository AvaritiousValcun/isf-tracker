
import {
  Router,
  Request,
  Response,
} from "express";
import { z } from "zod";

import { requireAuth } from "../middleware/auth";
import { validateRequest } from "../middleware/validate";
import { supabaseAdmin } from "../lib/supabaseAdmin";

const router = Router();

const languageSchema = z.object({
  body: z.object({
    language: z.enum(["en", "sw"]),
  }),
});

/**
 * GET /api/profile
 */
router.get(
  "/",
  requireAuth,
  async (
    req: Request,
    res: Response,
    next,
  ) => {
    try {
      const { data, error } =
        await supabaseAdmin
          .from("patient_profiles")
          .select(
            `
              id,
              user_id,
              full_name,
              date_of_birth,
              language,
              timezone,
              weight_kg,
              patient_reference,
              created_at,
              updated_at
            `,
          )
          .eq(
            "user_id",
            req.user.id,
          )
          .maybeSingle();

      if (error) {
        throw error;
      }

      if (!data) {
        return res.status(404).json({
          error:
            "Patient profile not found",
        });
      }

      return res.json(data);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * PATCH /api/profile/language
 */
router.patch(
  "/language",
  requireAuth,
  validateRequest(languageSchema),
  async (
    req: Request,
    res: Response,
    next,
  ) => {
    try {
      const { data, error } =
        await supabaseAdmin
          .from("patient_profiles")
          .update({
            language:
              req.body.language,
            updated_at:
              new Date().toISOString(),
          })
          .eq(
            "user_id",
            req.user.id,
          )
          .select(
            `
              id,
              user_id,
              full_name,
              date_of_birth,
              language,
              timezone,
              weight_kg,
              patient_reference,
              updated_at
            `,
          )
          .maybeSingle();

      if (error) {
        throw error;
      }

      if (!data) {
        return res.status(404).json({
          error:
            "Patient profile not found",
        });
      }

      return res.json(data);
    } catch (error) {
      next(error);
    }
  },
);

export default router;

