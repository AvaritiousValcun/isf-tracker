
import { Router } from "express";

import { requireAuth } from "../middleware/auth.js";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";
import {
  DemoPredictionProvider,
  PredictionProvider,
} from "../services/predictionProvider.js";

const router = Router();

/*
 * ============================================================================
 * PREDICTION PROVIDER
 * ============================================================================
 *
 * The demo provider is intentionally explicit.
 *
 * It must never be represented as a clinically validated production model.
 */
const activePredictionProvider: PredictionProvider =
  new DemoPredictionProvider();

/**
 * Check whether the patient currently has predictive consent.
 */
async function hasActivePredictiveConsent(
  patientId: string,
): Promise<boolean> {
  const {
    data,
    error,
  } = await supabaseAdmin
    .from("predictive_consents")
    .select("id")
    .eq(
      "patient_user_id",
      patientId,
    )
    .eq(
      "status",
      "granted",
    )
    .order(
      "granted_at",
      {
        ascending: false,
      },
    )
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(data);
}

/**
 * GET /api/predictions
 *
 * Returns the latest predictions for the authenticated patient.
 */
router.get(
  "/",
  requireAuth,
  async (req: any, res, next) => {
    try {
      const patientId =
        req.user.id;

      const hasConsent =
        await hasActivePredictiveConsent(
          patientId,
        );

      if (!hasConsent) {
        return res.status(403).json({
          error:
            "Active predictive consent is required.",
        });
      }

      const {
        data: subscription,
        error: subscriptionError,
      } = await supabaseAdmin
        .from("subscriptions")
        .select(
          "plan, status, renewal_at",
        )
        .eq(
          "patient_user_id",
          patientId,
        )
        .order(
          "created_at",
          {
            ascending: false,
          },
        )
        .limit(1)
        .maybeSingle();

      if (subscriptionError) {
        throw subscriptionError;
      }

      const isPremium =
        subscription?.plan ===
          "premium" &&
        subscription?.status ===
          "active" &&
        (
          !subscription.renewal_at ||
          new Date(
            subscription.renewal_at,
          ).getTime() >
            Date.now()
        );

      const {
        data: predictions,
        error,
      } = await supabaseAdmin
        .from("predictions")
        .select("*")
        .eq(
          "patient_user_id",
          patientId,
        )
        .order(
          "calculated_at",
          {
            ascending: false,
          },
        );

      if (error) {
        throw error;
      }

      /*
       * Keep only the newest prediction for each condition.
       */
      const seen =
        new Set<string>();

      const latestPredictions =
        (predictions || []).filter(
          (prediction) => {
            if (
              seen.has(
                prediction.condition,
              )
            ) {
              return false;
            }

            seen.add(
              prediction.condition,
            );

            return true;
          },
        );

      /*
       * Risk percentages remain premium-only.
       */
      const sanitizedPredictions =
        latestPredictions.map(
          (prediction) => ({
            ...prediction,

            risk_percentage:
              isPremium
                ? prediction.risk_percentage
                : null,
          }),
        );

      return res.json({
        isPremium,
        results:
          sanitizedPredictions,
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * POST /api/predictions/generate
 *
 * Generates predictions after verifying active predictive consent.
 */
router.post(
  "/generate",
  requireAuth,
  async (req: any, res, next) => {
    try {
      const patientId =
        req.user.id;

      const hasConsent =
        await hasActivePredictiveConsent(
          patientId,
        );

      if (!hasConsent) {
        return res.status(403).json({
          error:
            "Active predictive consent is required before generating predictions.",
        });
      }

      /*
       * Generate using the explicitly configured provider.
       */
      const generated =
        await activePredictionProvider.generatePredictions(
          patientId,
        );

      if (
        !Array.isArray(generated)
      ) {
        throw new Error(
          "Prediction provider returned an invalid response.",
        );
      }

      const providerId =
        activePredictionProvider.id;

      const providerEnvironment =
        activePredictionProvider.environment;

      const generatedAt =
        new Date().toISOString();

      const predictionRows =
        generated.map(
          (prediction) => ({
            patient_user_id:
              patientId,

            condition:
              prediction.condition,

            risk_category:
              prediction.risk_category,

            /*
             * Demo provider intentionally returns null.
             * A production provider may supply a validated probability.
             */
            risk_percentage:
              prediction.risk_percentage ??
              null,

            calculated_at:
              prediction.generated_at ||
              generatedAt,

            model_id:
              prediction.model_id ||
              providerId,

            model_version:
              prediction.model_version,

            feature_version:
              prediction.feature_version ||
              "1.0",

            expires_at:
              prediction.expires_at ||
              new Date(
                Date.now() +
                  24 *
                    60 *
                    60 *
                    1000,
              ).toISOString(),

            explanation:
              prediction.explanation_data ??
              null,

            trend:
              prediction.trend ??
              null,

            provider_id:
              providerId,

            provider_environment:
              providerEnvironment,
          }),
        );

      /*
       * Replace the patient's previous prediction snapshot.
       *
       * This preserves the existing application's snapshot model.
       */
      const {
        error: deleteError,
      } = await supabaseAdmin
        .from("predictions")
        .delete()
        .eq(
          "patient_user_id",
          patientId,
        );

      if (deleteError) {
        throw deleteError;
      }

      let savedPredictions:
        typeof predictionRows =
          predictionRows;

      if (
        predictionRows.length >
        0
      ) {
        const {
          data,
          error: insertError,
        } = await supabaseAdmin
          .from("predictions")
          .insert(
            predictionRows,
          )
          .select("*");

        if (insertError) {
          throw insertError;
        }

        savedPredictions =
          data || predictionRows;
      }

      const {
        error: auditError,
      } = await supabaseAdmin
        .from("audit_logs")
        .insert({
          actor_user_id:
            patientId,

          patient_user_id:
            patientId,

          action:
            "predictions_generated",

          resource_type:
            "predictions",

          metadata: {
            count:
              savedPredictions.length,

            provider:
              providerId,

            environment:
              providerEnvironment,
          },
        });

      if (auditError) {
        throw auditError;
      }

      return res.json({
        success: true,

        provider: {
          id:
            providerId,

          environment:
            providerEnvironment,

          production_ready:
            activePredictionProvider.productionReady,
        },

        results:
          savedPredictions,
      });
    } catch (error) {
      next(error);
    }
  },
);

export default router;

