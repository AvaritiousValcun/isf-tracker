
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Activity,
  ShieldAlert,
  Lock,
  Info,
  RefreshCw,
  AlertCircle,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../components/ui/card";

import { Button } from "../components/ui/button";

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "../components/ui/alert";

import { Badge } from "../components/ui/badge";

import {
  usePredictiveConsent,
  usePredictions,
  useSubscription,
} from "../hooks/useData";

import { apiRequest } from "../lib/api";

export default function PredictiveView() {
  const { t, i18n } = useTranslation();

  const {
    consented,
    loading: consentLoading,
    grantConsent,
    revokeConsent,
  } = usePredictiveConsent();

  const {
    predictions,
    loading: predictionsLoading,
    error: predictionsError,
    refetch: refetchPredictions,
  } = usePredictions();

  const {
    subscription,
    loading: subscriptionLoading,
  } = useSubscription();

  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);

  const isPremium =
    subscription?.plan === "premium" &&
    subscription?.status === "active";

  const loading =
    consentLoading ||
    predictionsLoading ||
    subscriptionLoading ||
    generating;

  /*
   * Generate predictions through the authenticated backend API.
   *
   * The backend receives the patient's Supabase JWT and
   * invokes the prediction service using the authenticated
   * patient context.
   */
  const generatePredictions = async () => {
    setGenerating(true);
    setGenerationError(null);

    try {
      const response = await apiRequest<{
        success: boolean;
        results: any[];
      }>("/predictions/generate", {
        method: "POST",
      });

      if (!response.success) {
        throw new Error(
          "Prediction generation was not successful."
        );
      }

      await refetchPredictions();
    } catch (error) {
      console.error(
        "Prediction generation failed:",
        error
      );

      setGenerationError(
        error instanceof Error
          ? error.message
          : "Unable to generate predictions."
      );
    } finally {
      setGenerating(false);
    }
  };

  /*
   * Generate predictions whenever consent becomes active.
   */
  useEffect(() => {
    if (!consented) {
      return;
    }

    generatePredictions();

    // We intentionally run this when consent changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consented]);

  /*
   * Grant predictive-analysis consent.
   */
  const handleGrant = async () => {
    setGenerationError(null);

    const result = await grantConsent();

    if (!result.success) {
      setGenerationError(
        result.error ?? "Unable to save predictive consent."
      );
    }
  };

  /*
   * Revoke predictive-analysis consent.
   */
  const handleRevoke = async () => {
    setGenerationError(null);

    const result = await revokeConsent();

    if (!result.success) {
      setGenerationError(
        result.error ?? "Unable to revoke predictive consent."
      );
    }
  };

  /*
   * Initial loading state.
   */
  if (consentLoading || subscriptionLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex items-center gap-3 text-muted-foreground">
          <RefreshCw className="h-5 w-5 animate-spin" />

          <span>
            {t(
              "predictive.loading",
              "Loading predictive analysis..."
            )}
          </span>
        </div>
      </div>
    );
  }

  /*
   * Consent screen.
   */
  if (!consented) {
    return (
      <div className="flex flex-col items-center justify-center p-6 min-h-[calc(100vh-8rem)]">
        <Card className="max-w-xl w-full border-primary/20 shadow-sm">
          <CardHeader className="text-center">
            <div className="mx-auto bg-primary/10 w-12 h-12 flex items-center justify-center rounded-full mb-4">
              <Activity className="w-6 h-6 text-primary" />
            </div>

            <CardTitle>
              {t(
                "predictive.consent.title",
                "Predictive Health Analysis"
              )}
            </CardTitle>

            <CardDescription>
              {t(
                "predictive.consent.subtitle",
                "Use your hormone readings to identify potential health trends."
              )}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <Alert variant="default" className="bg-muted/50">
              <ShieldAlert className="h-4 w-4" />

              <AlertTitle>
                {t(
                  "predictive.consent.disclaimer_title",
                  "Important information"
                )}
              </AlertTitle>

              <AlertDescription>
                {t(
                  "predictive.consent.disclaimer_body",
                  "Predictive analysis is for informational purposes only and does not replace professional medical advice."
                )}
              </AlertDescription>
            </Alert>

            <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-2">
              <li>
                {t(
                  "predictive.consent.point_1",
                  "Your hormone readings may be analyzed to identify health trends."
                )}
              </li>

              <li>
                {t(
                  "predictive.consent.point_2",
                  "Predictions are estimates and are not medical diagnoses."
                )}
              </li>

              <li>
                {t(
                  "predictive.consent.point_3",
                  "You can revoke predictive-analysis consent at any time."
                )}
              </li>
            </ul>

            {generationError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />

                <AlertTitle>
                  {t("common.error", "Error")}
                </AlertTitle>

                <AlertDescription>
                  {generationError}
                </AlertDescription>
              </Alert>
            )}

            <Button
              className="w-full mt-4"
              onClick={handleGrant}
              disabled={generating}
            >
              {generating
                ? t(
                    "predictive.generating",
                    "Processing..."
                  )
                : t(
                    "predictive.consent.accept",
                    "I agree and continue"
                  )}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  /*
   * Prediction loading state.
   */
  if (predictionsLoading || generating) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <RefreshCw className="h-6 w-6 animate-spin" />

          <span>
            {generating
              ? t(
                  "predictive.generating",
                  "Generating your predictions..."
                )
              : t(
                  "predictive.loading",
                  "Loading predictive analysis..."
                )}
          </span>
        </div>
      </div>
    );
  }

  /*
   * Error state.
   */
  if (predictionsError || generationError) {
    return (
      <div className="w-full max-w-3xl mx-auto p-6">
        <Card>
          <CardContent className="p-8">
            <div className="flex flex-col items-center text-center gap-4">
              <AlertCircle className="h-10 w-10 text-destructive" />

              <div>
                <h2 className="text-xl font-semibold">
                  {t(
                    "predictive.error_title",
                    "Unable to load predictions"
                  )}
                </h2>

                <p className="text-sm text-muted-foreground mt-2">
                  {generationError ||
                    predictionsError ||
                    t(
                      "predictive.error_body",
                      "Something went wrong while loading your predictions."
                    )}
                </p>
              </div>

              <Button
                onClick={generatePredictions}
                disabled={generating}
              >
                <RefreshCw className="mr-2 h-4 w-4" />

                {t(
                  "common.retry",
                  "Try again"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  /*
   * Find the PMOS/PCOS prediction.
   *
   * The backend may identify this prediction as either
   * "pmos_pcos" or "pcos", so both are supported.
   */
  const pmosRisk =
    predictions.find(
      (prediction) =>
        prediction.condition ===
          "pmos_pcos" ||
        prediction.condition ===
          "pcos"
    );

  /*
   * All other long-term conditions.
   *
   * Both PMOS/PCOS identifiers are excluded so that
   * the same prediction is not displayed twice.
   */
  const longTermRisks =
    predictions.filter(
      (prediction) =>
        prediction.condition !==
          "pmos_pcos" &&
        prediction.condition !==
          "pcos"
    );

  /*
   * Main predictive-analysis dashboard.
   */
  return (
    <div className="w-full max-w-7xl mx-auto p-4 md:p-6 space-y-8">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            {t(
              "predictive.title",
              "Predictive Analysis"
            )}
          </h1>

          <p className="text-muted-foreground">
            {t(
              "predictive.subtitle",
              "Understand potential health trends from your hormone data."
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={generatePredictions}
            disabled={generating}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${
                generating ? "animate-spin" : ""
              }`}
            />

            {t(
              "common.refresh",
              "Refresh"
            )}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleRevoke}
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            {t(
              "predictive.revoke",
              "Revoke consent"
            )}
          </Button>
        </div>
      </div>

      {/* Medical disclaimer */}
      <Alert className="bg-primary/5 border-primary/20">
        <Info className="h-4 w-4 text-primary" />

        <AlertDescription className="text-primary font-medium">
          {t(
            "predictive.medical_disclaimer",
            "Predictive analysis provides estimates only and should not be used as a medical diagnosis. Please consult a qualified healthcare professional for medical advice."
          )}
        </AlertDescription>
      </Alert>

      {/* Synthetic demo warning */}
      <Alert className="bg-amber-50 border-amber-200">
        <Info className="h-4 w-4 text-amber-700" />

        <AlertDescription className="text-amber-800">
          {t(
            "predictive.demo_warning",
            "These predictive results are synthetic demonstration results. They are not clinically validated and must not be used as a diagnosis or for medical decision-making."
          )}
        </AlertDescription>
      </Alert>

      {/* No predictions */}
      {predictions.length === 0 && (
        <Card>
          <CardContent className="p-10">
            <div className="flex flex-col items-center text-center gap-4">
              <Activity className="h-10 w-10 text-muted-foreground" />

              <div>
                <h2 className="text-xl font-semibold">
                  {t(
                    "predictive.no_data_title",
                    "No predictions available yet"
                  )}
                </h2>

                <p className="text-sm text-muted-foreground mt-2 max-w-lg">
                  {t(
                    "predictive.no_data_body",
                    "There may not be enough hormone readings available to generate a prediction yet."
                  )}
                </p>
              </div>

              <Button
                onClick={generatePredictions}
                disabled={generating}
              >
                <Activity className="mr-2 h-4 w-4" />

                {t(
                  "predictive.generate",
                  "Generate predictions"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* PMOS / PCOS Risk */}
      {pmosRisk && (
        <section>
          <h2 className="text-xl font-semibold mb-4 text-foreground">
            {t(
              "predictive.section1_title",
              "Future PMOS / PCOS Risk"
            )}
          </h2>

          <Card className="border-t-4 border-t-primary shadow-sm">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">

                <div>
                  <h3 className="text-lg font-medium">
                    {t(
                      "predictive.pmos_pcos",
                      "PMOS / PCOS"
                    )}
                  </h3>

                  {pmosRisk.model_version && (
                    <p className="text-sm text-muted-foreground">
                      {t(
                        "predictive.model_version",
                        "Model version"
                      )}
                      : {pmosRisk.model_version}
                    </p>
                  )}

                  <p className="text-xs text-muted-foreground mt-1">
                    {pmosRisk.calculated_at
                      ? new Intl.DateTimeFormat(
                          i18n.language === "sw"
                            ? "sw-KE"
                            : "en-KE",
                          {
                            dateStyle: "medium",
                            timeStyle: "short",
                          }
                        ).format(
                          new Date(
                            pmosRisk.calculated_at
                          )
                        )
                      : ""}
                  </p>
                </div>

                <div className="flex items-center gap-4">

                  {/* Premium risk percentage */}
                  {isPremium &&
                  pmosRisk.risk_percentage !== null ? (
                    <div className="text-right">
                      <div className="text-2xl font-bold text-primary">
                        {new Intl.NumberFormat(
                          i18n.language === "sw"
                            ? "sw-KE"
                            : "en-KE",
                          {
                            style: "percent",
                            maximumFractionDigits: 1,
                          }
                        ).format(
                          pmosRisk.risk_percentage / 100
                        )}
                      </div>

                      <div className="text-xs text-muted-foreground">
                        {t(
                          "predictive.estimated_risk",
                          "Estimated risk"
                        )}
                      </div>
                    </div>
                  ) : null}

                  {/* Risk category */}
                  <Badge
                    className={`px-4 py-2 text-sm capitalize ${
                      pmosRisk.risk_category ===
                      "monitoring"
                        ? "bg-secondary"
                        : "bg-primary"
                    }`}
                  >
                    {t(
                      `predictive.category.${pmosRisk.risk_category}`,
                      pmosRisk.risk_category
                    )}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      {/* Long-term conditions */}
      {longTermRisks.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold mb-4 text-foreground">
            {t(
              "predictive.section2_title",
              "Long-Term Health Conditions"
            )}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {longTermRisks.map((risk) => (
              <Card
                key={risk.condition}
                className="shadow-sm"
              >
                <CardContent className="p-5 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <Activity className="w-5 h-5 text-muted-foreground" />

                    <span className="font-medium text-foreground">
                      {t(
                        `predictive.conditions.${risk.condition}`,
                        risk.condition
                      )}
                    </span>
                  </div>

                  <Badge
                    variant="secondary"
                    className="capitalize text-sm font-normal"
                  >
                    {t(
                      `predictive.category.${risk.risk_category}`,
                      risk.risk_category
                    )}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

    </div>
  );
}

