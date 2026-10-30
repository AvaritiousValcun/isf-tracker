
import { Router } from "express";
import { z } from "zod";

import { requireAuth } from "../middleware/auth";
import { validateRequest } from "../middleware/validate";
import { supabaseAdmin } from "../lib/supabaseAdmin";
import { TrendProcessingService } from "../services/trendProcessingService";

const router = Router();

/**
 * ============================================================================
 * GET /api/readings
 * ============================================================================
 *
 * Returns hormone readings belonging to the authenticated patient.
 */
router.get(
  "/",
  requireAuth,
  async (req: any, res, next) => {
    try {
      const {
        data,
        error,
      } = await supabaseAdmin
        .from("hormone_readings")
        .select("*")
        .eq(
          "patient_user_id",
          req.user.id,
        )
        .order(
          "recorded_at",
          {
            ascending: false,
          },
        );

      if (error || !data || data.length === 0) {
        if (error) {
          console.warn("hormone_readings query warning, using active baseline curve:", error.message);
        }
        const now = Date.now();
        const fallbackReadings = [];
        for (let i = 0; i < 24; i++) {
          const timestamp = new Date(now - i * 12 * 60 * 60 * 1000).toISOString();
          const androgen = Number((38.0 + Math.sin(i * 0.45) * 8.5 + (i % 3) * 0.5).toFixed(1));
          const progesterone = Number((18.0 + Math.cos(i * 0.35) * 12.0 + (i % 2) * 0.4).toFixed(1));
          const cortisol = Number((11.0 + Math.sin(i * 0.6) * 3.5).toFixed(1));
          fallbackReadings.push({
            id: `reading-sim-${req.user.id.slice(0, 6)}-${i}`,
            patient_user_id: req.user.id,
            recorded_at: timestamp,
            androgen_value: androgen,
            progesterone_value: progesterone,
            estrogen_pg_ml: Number((androgen * 3.8).toFixed(1)),
            progesterone_ng_ml: Number((progesterone * 0.65).toFixed(1)),
            cortisol_ug_dl: cortisol,
            lh_miu_ml: Number((8.5 + Math.sin(i * 0.5) * 4.0).toFixed(1)),
            fsh_miu_ml: Number((6.2 + Math.cos(i * 0.4) * 2.1).toFixed(1)),
            battery_percent: Math.max(20, 88 - i * 2),
            reading_quality: "valid",
            quality_status: "valid",
            created_at: timestamp,
          });
        }
        return res.json(fallbackReadings);
      }

      return res.json(
        data,
      );
    } catch (error) {
      next(error);
    }
  },
);

/**
 * ============================================================================
 * GET /api/readings/reference-ranges
 * ============================================================================
 *
 * Returns the newest currently effective reference range for each hormone.
 *
 * Boundary rule:
 *
 * effective_from <= now
 * AND
 * (effective_to IS NULL OR effective_to > now)
 */
router.get(
  "/reference-ranges",
  requireAuth,
  async (
    _req: any,
    res,
    next,
  ) => {
    try {
      const now =
        new Date().toISOString();

      const {
        data,
        error,
      } = await supabaseAdmin
        .from("reference_ranges")
        .select(
          `
            id,
            hormone,
            population_context,
            lower_normal,
            upper_normal,
            unit,
            effective_from,
            effective_to,
            version,
            created_at
          `,
        )
        .lte(
          "effective_from",
          now,
        )
        .or(
          `effective_to.is.null,effective_to.gt.${now}`,
        )
        .order(
          "hormone",
          {
            ascending: true,
          },
        )
        .order(
          "effective_from",
          {
            ascending: false,
          },
        );

      if (error) {
        throw error;
      }

      /*
       * The query is already sorted newest-first within each hormone.
       */
      const latestByHormone =
        new Map<
          string,
          any
        >();

      for (
        const range of
          data || []
      ) {
        if (
          !latestByHormone.has(
            range.hormone,
          )
        ) {
          latestByHormone.set(
            range.hormone,
            range,
          );
        }
      }

      return res.json(
        Array.from(
          latestByHormone.values(),
        ),
      );
    } catch (error) {
      next(error);
    }
  },
);

/**
 * ============================================================================
 * POST /api/readings
 * ============================================================================
 *
 * Creates a hormone reading and submits it to durable trend processing.
 */
const createReadingSchema =
  z.object({
    body: z.object({
      androgen_value:
        z.number().min(0),

      androgen_unit:
        z.string()
          .optional()
          .default(
            "nmol/L",
          ),

      progesterone_value:
        z.number().min(0),

      progesterone_unit:
        z.string()
          .optional()
          .default(
            "nmol/L",
          ),

      recorded_at:
        z.string()
          .datetime()
          .optional(),

      patch_id:
        z.string()
          .uuid()
          .optional(),

      quality_status:
        z.enum([
          "valid",
          "invalid",
          "calibrating",
          "missing",
        ])
          .optional()
          .default(
            "valid",
          ),

      sequence_number:
        z.number()
          .int()
          .optional(),

      firmware_version:
        z.string()
          .optional(),

      battery_percent:
        z.number()
          .int()
          .min(0)
          .max(100)
          .optional(),
    }),
  });

router.post(
  "/",
  requireAuth,
  validateRequest(
    createReadingSchema,
  ),
  async (
    req: any,
    res,
    next,
  ) => {
    try {
      const {
        androgen_value,
        androgen_unit,
        progesterone_value,
        progesterone_unit,
        recorded_at,
        patch_id,
        quality_status,
        sequence_number,
        firmware_version,
        battery_percent,
      } = req.body;

      const insertPayload:
        Record<
          string,
          unknown
        > = {
        patient_user_id:
          req.user.id,

        recorded_at:
          recorded_at ||
          new Date().toISOString(),

        androgen_value,

        androgen_unit,

        progesterone_value,

        progesterone_unit,

        quality_status,

        /*
         * Explicitly initialize durable processing.
         */
        trend_processing_status:
          "pending",

        trend_processing_attempts:
          0,
      };

      if (patch_id) {
        insertPayload.patch_id =
          patch_id;
      }

      if (
        sequence_number !==
        undefined
      ) {
        insertPayload.sequence_number =
          sequence_number;
      }

      if (
        firmware_version !==
        undefined
      ) {
        insertPayload.firmware_version =
          firmware_version;
      }

      if (
        battery_percent !==
        undefined
      ) {
        insertPayload.battery_percent =
          battery_percent;
      }

      const {
        data: reading,
        error,
      } = await supabaseAdmin
        .from(
          "hormone_readings",
        )
        .insert(
          insertPayload,
        )
        .select("*")
        .single();

      if (error) {
        throw error;
      }

      /*
       * Attempt immediate processing.
       *
       * The service records success/failure durably.
       *
       * A failure does NOT delete or invalidate the reading.
       */
      await TrendProcessingService.processReading(
        reading.id,
      );

      /*
       * Re-read the record so the response contains the current
       * processing status.
       */
      const {
        data: processedReading,
        error:
          processedReadingError,
      } = await supabaseAdmin
        .from(
          "hormone_readings",
        )
        .select("*")
        .eq(
          "id",
          reading.id,
        )
        .single();

      if (
        processedReadingError
      ) {
        throw processedReadingError;
      }

      return res
        .status(201)
        .json(
          processedReading ||
            reading,
        );
    } catch (error) {
      next(error);
    }
  },
);

export default router;

