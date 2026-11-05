import { Router } from "express";

import { requireAuth } from "../middleware/auth";
import { PasskeyService } from "../services/passkeyService";
import { supabaseAdmin } from "../lib/supabaseAdmin";

const router = Router();

function extractClientOrigin(req: any) {
  return (
    req.body?.origin ||
    req.headers.origin ||
    req.headers.referer ||
    undefined
  );
}

function extractClientHost(req: any) {
  return (
    req.body?.hostname ||
    req.headers["x-forwarded-host"] ||
    req.headers.host ||
    undefined
  );
}

router.post(
  "/register/options",
  requireAuth,
  async (req: any, res, next) => {
    try {
      const origin = extractClientOrigin(req);
      const host = extractClientHost(req);

      const options =
        await PasskeyService.getRegistrationOptions(
          req.user.id,
          req.user.email,
          origin,
          host,
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
      const origin = extractClientOrigin(req);
      const host = extractClientHost(req);

      const result =
        await PasskeyService.verifyRegistration(
          req.user.id,
          req.body,
          origin,
          host,
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
      const origin = extractClientOrigin(req);
      const host = extractClientHost(req);

      const options =
        await PasskeyService.getAuthenticationOptions(
          req.body?.email,
          origin,
          host,
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
      const origin = extractClientOrigin(req);
      const host = extractClientHost(req);

      const result =
        await PasskeyService.verifyAuthentication(
          req.body,
          origin,
          host,
        );

      if (!result.verified) {
        return res.status(401).json(result);
      }

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
  async (req: any, res) => {
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
        console.warn("[PasskeyRoute] Could not list passkeys:", error.message);
        return res.json([]);
      }

      return res.json(data || []);
    } catch (error: any) {
      console.warn("[PasskeyRoute] Exception listing passkeys:", error?.message || error);
      return res.json([]);
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
