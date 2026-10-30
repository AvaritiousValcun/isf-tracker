import { Router } from "express";

import { requireAuth } from "../middleware/auth";
import { PasskeyService } from "../services/passkeyService";
import { supabaseAdmin } from "../lib/supabaseAdmin";

const router = Router();

router.post(
  "/register/options",
  requireAuth,
  async (req: any, res, next) => {
    try {
      const options =
        await PasskeyService.getRegistrationOptions(
          req.user.id,
          req.user.email,
        );

      return res.json(options);
    } catch (error) {
      return next(error);
    }
  },
);

router.post(
  "/register/verify",
  requireAuth,
  async (req: any, res, next) => {
    try {
      const result =
        await PasskeyService.verifyRegistration(
          req.user.id,
          req.body,
        );

      if (!result.verified) {
        return res.status(400).json(result);
      }

      return res.json(result);
    } catch (error) {
      return next(error);
    }
  },
);

router.post(
  "/authenticate/options",
  async (req: any, res, next) => {
    try {
      const options =
        await PasskeyService.getAuthenticationOptions(
          req.body?.email,
        );

      return res.json(options);
    } catch (error) {
      return next(error);
    }
  },
);

router.post(
  "/authenticate/verify",
  async (req: any, res, next) => {
    try {
      const result =
        await PasskeyService.verifyAuthentication(
          req.body,
        );

      if (!result.verified) {
        return res.status(401).json(result);
      }

      /*
       * IMPORTANT:
       *
       * WebAuthn verification proves that the
       * authenticator possesses the private key
       * belonging to the registered credential.
       *
       * This endpoint currently returns the verified
       * patient ID.
       *
       * It does NOT manufacture a fake Supabase JWT.
       *
       * A production passwordless-login flow should
       * subsequently establish a real application
       * session using a supported server-side
       * authentication/session mechanism.
       */

      return res.json({
        success: true,
        verified: true,
        patientId: result.patientId,
      });
    } catch (error) {
      return next(error);
    }
  },
);

router.get(
  "/",
  requireAuth,
  async (req: any, res, next) => {
    try {
      const { data, error } =
        await supabaseAdmin
          .from("passkeys")
          .select(
            "id, device_name, created_at, last_used_at",
          )
          .eq("user_id", req.user.id)
          .order("created_at", {
            ascending: false,
          });

      if (error) {
        throw error;
      }

      return res.json(data || []);
    } catch (error) {
      return next(error);
    }
  },
);

router.delete(
  "/:id",
  requireAuth,
  async (req: any, res, next) => {
    try {
      const { error } =
        await supabaseAdmin
          .from("passkeys")
          .delete()
          .eq("id", req.params.id)
          .eq("user_id", req.user.id);

      if (error) {
        throw error;
      }

      return res.json({
        success: true,
      });
    } catch (error) {
      return next(error);
    }
  },
);

export default router;