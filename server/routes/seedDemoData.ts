import { Router } from "express";
import { createClient } from "@supabase/supabase-js";

import { requireAuth } from "../middleware/auth";
import { env } from "../lib/env";

const router = Router();

/*
 * POST /api/seed-demo-data
 *
 * Calls seed_demo_data() using the authenticated
 * patient's JWT so that auth.uid() works correctly.
 */
router.post("/", requireAuth, async (req: any, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    /*
     * NOTE (fixed 2026-08-30):
     *
     * This route previously checked `req.user.role !== "patient"`
     * and forwarded `req.user.accessToken`. Neither field was ever
     * set by requireAuth (it only attaches { id, email }), so this
     * route unconditionally returned 403 for every caller,
     * including legitimate patients, and the fallback forwarded
     * header would have been "Bearer undefined" even if the role
     * check had passed.
     *
     * There is no separate "role" concept elsewhere in this
     * codebase -- every account created through the normal sign-up
     * flow is a patient (client/hooks/useAuth.tsx), and consultants
     * are identified via public.current_consultant_id(), not a
     * field on the Supabase user/session. So the role check is
     * removed rather than reconstructed around a role system that
     * doesn't exist.
     *
     * requireAuth now attaches the verified raw JWT as
     * req.user.accessToken (see server/middleware/auth.ts), which
     * is forwarded below so that auth.uid() resolves correctly
     * inside seed_demo_data().
     */

    /*
     * Create a Supabase client using the ANON key.
     *
     * IMPORTANT:
     * We intentionally do NOT use supabaseAdmin here.
     * The seed_demo_data() function uses auth.uid()
     * Therefore the patient's JWT must be forwarded.
     */
    const userSupabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      global: {
        headers: {
          Authorization: `Bearer ${req.user.accessToken}`,
        },
      },
    });

    /*
     * Call the authenticated RPC.
     */
    const { error } = await userSupabase.rpc("seed_demo_data");

    if (error) {
      console.error("seed_demo_data RPC failed:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to seed authenticated patient data",
        details: error.message,
      });
    }

    return res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;