import { Router } from "express";

import { requireAuth } from "../middleware/auth.js";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";

import {
  DemoPredictionProvider,
  PredictionProvider,
} from "../services/predictionProvider.js";

const router = Router();

const activePredictionProvider: PredictionProvider =
  new DemoPredictionProvider();

const PREDICTIVE_CONSENT_VERSION =
  "1.0";

function isPremiumSubscription(
  subscription:
    | {
        plan?: string | null;
        status?: string | null;
        renewal_at?: string | null;
      }
    | null,
) {
  return (
    subscription?.plan ===
      "premium" &&
    subscription?.status ===
      "active" &&
    (
      !subscription.renewal_at ||
      new Date(
        subscription.renewal_at,
      ).getTime() > Date.now()
    )
  );
}

/*
 * GET /api/predictions/consent
 */
router.get(
  "/consent",
  requireAuth,
  async (req: any, res, next) => {
    try {
      const patientId =
        req.user.id;

      const {
        data,
        error,
      } = await supabaseAdmin
        .from(
          "predictive_consents",
        )
        .select(
          `
            id,
            patient_user_id,
            status,
            consent_version,
            granted_at,
            revoked_at,
            created_at
          `,
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

      if (error) {
        throw error;
      }

      return res.json(
        data || {
          status:
            "not_granted",
        },
      );
    } catch (error) {
      next(error);
    }
  },
);

/*
 * POST /api/predictions/consent
 */
router.post(
  "/consent",
  requireAuth,
  async (req: any, res, next) => {
    try {
      const patientId =
        req.user.id;

      /*
       * If a granted consent already exists,
       * return it instead of attempting another INSERT.
       */
      const {
        data: existingConsent,
        error:
          lookupError,
      } = await supabaseAdmin
        .from(
          "predictive_consents",
        )
        .select("*")
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

      if (lookupError) {
        throw lookupError;
      }

      if (existingConsent) {
        return res.json(
          existingConsent,
        );
      }

      const {
        data,
        error,
      } = await supabaseAdmin
        .from(
          "predictive_consents",
        )
        .insert({
          patient_user_id:
            patientId,
          status:
            "granted",
          consent_version:
            PREDICTIVE_CONSENT_VERSION,
          granted_at:
            new Date().toISOString(),
          revoked_at:
            null,
        })
        .select("*")
        .single();

      if (error) {
        /*
         * Protect against a concurrent request that
         * granted consent between our lookup and INSERT.
         */
        if (
          error.code ===
          "23505"
        ) {
          const {
            data:
              concurrentConsent,
            error:
              concurrentLookupError,
          } = await supabaseAdmin
            .from(
              "predictive_consents",
            )
            .select("*")
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

          if (concurrentLookupError) {
            throw concurrentLookupError;
          }

          if (!concurrentConsent) {
            throw error;
          }

          return res.json(
            concurrentConsent,
          );
        }

        throw error;
      }

      const {
        error:
          auditError,
      } = await supabaseAdmin
        .from("audit_logs")
        .insert({
          actor_user_id:
            patientId,
          patient_user_id:
            patientId,
          action:
            "predictive_consent_granted",
          resource_type:
            "predictive_consent",
          resource_id:
            data.id,
        });

      if (auditError) {
        console.error(
          "Failed to write predictive consent audit log:",
          auditError,
        );
      }

      return res.json(
        data,
      );
    } catch (error) {
      next(error);
    }
  },
);

/*
 * DELETE /api/predictions/consent
 */
router.delete(
  "/consent",
  requireAuth,
  async (req: any, res, next) => {
    try {
      const patientId =
        req.user.id;

      const {
        data,
        error,
      } = await supabaseAdmin
        .from(
          "predictive_consents",
        )
        .update({
          status:
            "revoked",
          revoked_at:
            new Date().toISOString(),
        })
        .eq(
          "patient_user_id",
          patientId,
        )
        .eq(
          "status",
          "granted",
        )
        .select("*")
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (data) {
        const {
          error:
            auditError,
        } = await supabaseAdmin
          .from("audit_logs")
          .insert({
            actor_user_id:
              patientId,
            patient_user_id:
              patientId,
            action:
              "predictive_consent_revoked",
            resource_type:
              "predictive_consent",
            resource_id:
              data.id,
          });

        if (auditError) {
          console.error(
            "Failed to write predictive consent revocation audit log:",
            auditError,
          );
        }
      }

      return res.json({
        success:
          true,
      });
    } catch (error) {
      next(error);
    }
  },
);

/*
 * POST /api/predictions/generate
 */
router.post(
  "/generate",
  requireAuth,
  async (req: any, res, next) => {
    try {
      const patientId =
        req.user.id;

      const {
        data: consent,
        error:
          consentError,
      } = await supabaseAdmin
        .from(
          "predictive_consents",
        )
        .select(
          "id, status, consent_version",
        )
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

      if (consentError) {
        throw consentError;
      }

      if (!consent) {
        return res.status(403).json({
          error:
            "Active predictive consent is required before generating predictions.",
        });
      }

      const generated =
        await activePredictionProvider.generatePredictions(
          patientId,
        );

      const predictionRows =
        generated.map(
          (prediction) => ({
            patient_user_id:
              patientId,

            condition:
              prediction.condition,

            risk_category:
              prediction.risk_category,

            risk_percentage:
              prediction.risk_percentage ??
              null,

            calculated_at:
              prediction.generated_at ||
              new Date().toISOString(),

            model_id:
              "demo-prediction-provider",

            model_version:
              prediction.model_version,

            feature_version:
              "demo-1.0.0",

            expires_at:
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
              null,

            provider_id:
              "demo",

            provider_environment:
              "demo",
          }),
        );

      const {
        error:
          deleteError,
      } = await supabaseAdmin
        .from(
          "predictions",
        )
        .delete()
        .eq(
          "patient_user_id",
          patientId,
        );

      if (deleteError) {
        throw deleteError;
      }

      let savedPredictions =
        predictionRows;

      if (
        predictionRows.length >
        0
      ) {
        const {
          data,
          error:
            insertError,
        } = await supabaseAdmin
          .from(
            "predictions",
          )
          .insert(
            predictionRows,
          )
          .select("*");

        if (insertError) {
          throw insertError;
        }

        savedPredictions =
          data ||
          predictionRows;
      }

      const {
        error:
          auditError,
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
              "demo-prediction-provider",
            environment:
              "demo",
          },
        });

      if (auditError) {
        console.error(
          "Failed to write prediction audit log:",
          auditError,
        );
      }

      return res.json({
        success:
          true,
        results:
          savedPredictions,
      });
    } catch (error) {
      next(error);
    }
  },
);

/*
 * GET /api/predictions
 */
router.get(
  "/",
  requireAuth,
  async (req: any, res, next) => {
    try {
      const patientId =
        req.user.id;

      const {
        data: consent,
        error:
          consentError,
      } = await supabaseAdmin
        .from(
          "predictive_consents",
        )
        .select(
          "id, status",
        )
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

      if (consentError) {
        throw consentError;
      }

      if (!consent) {
        return res.status(403).json({
          error:
            "Active predictive consent is required.",
        });
      }

      const {
        data: subscription,
        error:
          subscriptionError,
      } = await supabaseAdmin
        .from(
          "subscriptions",
        )
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
        isPremiumSubscription(
          subscription,
        );

      const {
        data: predictions,
        error,
      } = await supabaseAdmin
        .from(
          "predictions",
        )
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

      const seen =
        new Set<string>();

      const latestPredictions =
        (
          predictions ||
          []
        ).filter(
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

export default router;