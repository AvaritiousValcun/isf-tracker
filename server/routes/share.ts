
import { Router } from "express";
import { z } from "zod";

import { requireAuth } from "../middleware/auth.js";
import { validateRequest } from "../middleware/validate.js";
import { QRService } from "../services/qrService.js";

const router = Router();

const createSchema = z.object({
  body: z.object({
    scope: z
      .array(z.string().trim().min(1))
      .min(1)
      .max(20),
  }),
});

/**
 * GET /api/share
 *
 * Lists the patient's temporary access tokens.
 */
router.get(
  "/",
  requireAuth,
  async (req: any, res, next) => {
    try {
      const sessions =
        await QRService.listSessions(
          req.user.id,
        );

      return res.json(sessions);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * POST /api/share
 *
 * Creates a new temporary access token.
 */
router.post(
  "/",
  requireAuth,
  validateRequest(createSchema),
  async (req: any, res, next) => {
    try {
      const session =
        await QRService.createSession(
          req.user.id,
          req.body.scope,
        );

      return res.status(201).json(
        session,
      );
    } catch (error) {
      next(error);
    }
  },
);

/**
 * PATCH /api/share/:id/revoke
 */
router.patch(
  "/:id/revoke",
  requireAuth,
  async (req: any, res, next) => {
    try {
      const session =
        await QRService.revokeSession(
          req.user.id,
          req.params.id,
        );

      return res.json(session);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * GET /api/share/resolve/:token
 *
 * Public endpoint used by the person scanning
 * the QR code.
 */
router.get(
  "/resolve/:token",
  async (req, res, next) => {
    try {
      const token =
        String(req.params.token || "");

      const payload =
        await QRService.resolveSession(
          token,
        );

      return res.json(payload);
    } catch (error: any) {
      return res.status(403).json({
        error:
          error?.message ||
          "Access denied",
      });
    }
  },
);

export default router;

