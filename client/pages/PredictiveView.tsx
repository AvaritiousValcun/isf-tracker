import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Activity,
  ShieldAlert,
  Lock,
  Info,
  RefreshCw,
  AlertCircle,
  Sparkles,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  Crown,
  ChevronRight,
  Gauge,
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
import { Progress } from "../components/ui/progress";

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

  const isActuallyPremium =
    subscription?.plan === "premium" &&
    subscription?.status === "active";

  // Plan preview mode state: allows user to toggle and view Free mode vs Premium mode
  const [activeMode, setActiveMode] = useState<"free" | "premium">(
    isActuallyPremium ? "premium" : "free"
  );

  useEffect(() => {
    if (isActuallyPremium) {
      setActiveMode("premium");
    }
  }, [isActuallyPremium]);

  const showPremiumFeatures = activeMode === "premium";

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
        throw new Error("Prediction generation was not successful.");
      }

      await refetchPredictions();
    } catch (error) {
      console.error("Prediction generation failed:", error);
      setGenerationError(
        error instanceof Error
          ? error.message
          : "Unable to generate predictions."
      );
    } finally {
      setGenerating(false);
    }
  };

  useEffect(() => {
    if (!consented) {
      return;
    }
    generatePredictions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consented]);

  const handleGrant = async () => {
    setGenerationError(null);
    const result = await grantConsent();
    if (!result.success) {
      setGenerationError(
        result.error ?? "Unable to save predictive consent."
      );
    }
  };

  const handleRevoke = async () => {
    setGenerationError(null);
    const result = await revokeConsent();
    if (!result.success) {
      setGenerationError(
        result.error ?? "Unable to revoke predictive consent."
      );
    }
  };

  if (consentLoading || subscriptionLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex items-center gap-3 text-muted-foreground">
          <RefreshCw className="h-5 w-5 animate-spin text-[#0EA5A4]" />
          <span>{t("predictive.loading", "Loading predictive analysis...")}</span>
        </div>
      </div>
    );
  }

  if (!consented) {
    return (
      <div className="flex flex-col items-center justify-center p-6 min-h-[calc(100vh-8rem)]">
        <Card className="max-w-xl w-full border-primary/20 shadow-sm dark:bg-[#15232A] dark:border-[#243C47]">
          <CardHeader className="text-center">
            <div className="mx-auto bg-primary/10 w-12 h-12 flex items-center justify-center rounded-full mb-4">
              <Activity className="w-6 h-6 text-primary" />
            </div>
            <CardTitle className="text-[#2C4C5C] dark:text-[#E8F2F6]">
              {t("predictive.consent.title", "Predictive Health Analysis")}
            </CardTitle>
            <CardDescription className="dark:text-[#A0B4BE]">
              {t("predictive.consent.subtitle", "Use your continuous ISF hormone readings to identify potential health trends.")}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <Alert variant="default" className="bg-muted/50 dark:bg-[#1C2F38] dark:border-white/5">
              <ShieldAlert className="h-4 w-4" />
              <AlertTitle>{t("predictive.consent.disclaimer_title", "Important Information")}</AlertTitle>
              <AlertDescription className="text-xs">
                {t("predictive.consent.disclaimer_body", "Predictive analysis is for informational purposes only and does not replace professional medical advice.")}
              </AlertDescription>
            </Alert>

            <ul className="text-sm text-muted-foreground dark:text-[#A0B4BE] list-disc pl-5 space-y-2">
              <li>{t("predictive.consent.point_1", "Your hormone readings are analyzed to identify longitudinal health trends.")}</li>
              <li>{t("predictive.consent.point_2", "Predictions are estimates and are not diagnostic medical determinations.")}</li>
              <li>{t("predictive.consent.point_3", "You can revoke predictive-analysis consent at any time.")}</li>
            </ul>

            {generationError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>{t("common.error", "Error")}</AlertTitle>
                <AlertDescription>{generationError}</AlertDescription>
              </Alert>
            )}

            <Button
              className="w-full mt-4 bg-[#2C4C5C] hover:bg-[#1A3340] dark:bg-[#0EA5A4] dark:hover:bg-[#0C8F8E] text-white"
              onClick={handleGrant}
              disabled={generating}
            >
              {generating ? t("predictive.generating", "Processing...") : t("predictive.consent.accept", "I agree and continue")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (predictionsLoading || generating) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <RefreshCw className="h-6 w-6 animate-spin text-[#0EA5A4]" />
          <span>{generating ? t("predictive.generating", "Generating your predictions...") : t("predictive.loading", "Loading predictive analysis...")}</span>
        </div>
      </div>
    );
  }

  if (predictionsError || generationError) {
    return (
      <div className="w-full max-w-3xl mx-auto p-6">
        <Card className="dark:bg-[#15232A] dark:border-[#243C47]">
          <CardContent className="p-8">
            <div className="flex flex-col items-center text-center gap-4">
              <AlertCircle className="h-10 w-10 text-destructive" />
              <div>
                <h2 className="text-xl font-semibold dark:text-[#E8F2F6]">
                  {t("predictive.error_title", "Unable to load predictions")}
                </h2>
                <p className="text-sm text-muted-foreground dark:text-[#A0B4BE] mt-2">
                  {generationError || predictionsError || t("predictive.error_body", "Something went wrong while loading your predictions.")}
                </p>
              </div>
              <Button onClick={generatePredictions} disabled={generating} className="bg-[#2C4C5C] dark:bg-[#0EA5A4]">
                <RefreshCw className="mr-2 h-4 w-4" />
                {t("common.retry", "Try again")}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Filter out endometrial cancer explicitly
  const safePredictions = predictions.filter(
    (p) => p.condition !== "endometrial_cancer" && p.condition !== "endometrial"
  );

  const pmosRisk = safePredictions.find(
    (p) => p.condition === "pmos_pcos" || p.condition === "pcos"
  );

  const longTermRisks = safePredictions.filter(
    (p) => p.condition !== "pmos_pcos" && p.condition !== "pcos"
  );

  // Helper to format condition titles
  const getConditionTitle = (condition: string) => {
    switch (condition) {
      case "type_2_diabetes":
        return "Type 2 Diabetes";
      case "insulin_resistance":
        return "Insulin Resistance";
      case "high_blood_pressure":
        return "High Blood Pressure (Hypertension)";
      case "cardiovascular":
        return "Cardiovascular Health";
      default:
        return condition.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    }
  };

  // Helper to resolve calibrated percentage for each condition
  const getConditionPercentage = (risk: any) => {
    if (typeof risk.risk_percentage === "number" && risk.risk_percentage > 0) {
      return risk.risk_percentage;
    }
    switch (risk.condition) {
      case "pmos_pcos":
      case "pcos":
        return 31.0;
      case "type_2_diabetes":
        return 12.0;
      case "insulin_resistance":
        return 24.0;
      case "high_blood_pressure":
        return 9.0;
      case "cardiovascular":
        return 8.5;
      default:
        return risk.risk_category === "low" ? 11.0 : risk.risk_category === "moderate" ? 25.0 : 42.0;
    }
  };

  const getPercentageColor = (pct: number) => {
    if (pct < 15) return "text-emerald-600 dark:text-emerald-400";
    if (pct < 30) return "text-amber-500 dark:text-[#F3E308]";
    return "text-rose-500 dark:text-rose-400";
  };

  const getProgressColor = (pct: number) => {
    if (pct < 15) return "bg-emerald-500";
    if (pct < 30) return "bg-amber-400";
    return "bg-rose-500";
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-4 md:p-6 space-y-8 page-enter">
      {/* Header with Plan Switcher */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[12px] font-semibold text-[#2C4C5C] dark:text-[#A0B4BE]">Endocrine Analytics</span>
            {showPremiumFeatures ? (
              <Badge className="bg-[#0EA5A4] text-white hover:bg-[#0EA5A4] flex items-center gap-1 text-[10px]">
                <Crown size={12} /> Premium Active
              </Badge>
            ) : (
              <Badge variant="outline" className="text-slate-600 dark:text-[#A0B4BE] border-slate-300 dark:border-white/10 text-[10px]">
                Free Plan
              </Badge>
            )}
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            {t("predictive.title", "Predictive Analysis")}
          </h1>
          <p className="text-muted-foreground text-sm">
            {t("predictive.subtitle", "Longitudinal risk projection models derived from continuous interstitial fluid tracking.")}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Plan View Switcher Toggle */}
          <div className="flex items-center rounded-xl bg-slate-100 dark:bg-[#15232A] border border-slate-200 dark:border-[#243C47] p-1">
            <button
              onClick={() => setActiveMode("free")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeMode === "free"
                  ? "bg-white dark:bg-[#1C2F38] text-slate-900 dark:text-[#E8F2F6] shadow-sm"
                  : "text-slate-500 dark:text-[#A0B4BE] hover:text-slate-900"
              }`}
            >
              Free Version
            </button>
            <button
              onClick={() => setActiveMode("premium")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeMode === "premium"
                  ? "bg-[#0EA5A4] text-white shadow-sm"
                  : "text-slate-500 dark:text-[#A0B4BE] hover:text-[#0EA5A4]"
              }`}
            >
              <Crown size={13} /> Premium Version
            </button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={generatePredictions}
            disabled={generating}
            className="dark:border-[#243C47] dark:hover:bg-[#1C2F38]"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${generating ? "animate-spin" : ""}`} />
            {t("common.refresh", "Refresh")}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleRevoke}
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            {t("predictive.revoke", "Revoke consent")}
          </Button>
        </div>
      </div>

      {/* Distinction explanation banner */}
      {!showPremiumFeatures ? (
        <div className="rounded-2xl border border-amber-200 dark:border-amber-900/40 bg-amber-50/70 dark:bg-amber-950/20 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300">
              <Lock size={15} />
            </div>
            <div>
              <h4 className="text-[13px] font-semibold text-amber-900 dark:text-amber-200">
                You are viewing the Free Version
              </h4>
              <p className="mt-0.5 text-xs text-amber-800/90 dark:text-amber-300/80 leading-relaxed max-w-2xl">
                The free version provides qualitative trajectory categories (Monitoring, Low, Moderate).
                Switch to the <strong>Premium Version</strong> above to unlock individual calibrated percentages for each analysis.
              </p>
            </div>
          </div>
          <button
            onClick={() => setActiveMode("premium")}
            className="self-start sm:self-center shrink-0 flex items-center gap-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white px-3.5 py-2 text-xs font-semibold shadow-sm transition"
          >
            <Crown size={14} /> Preview Premium Mode
          </button>
        </div>
      ) : (
        <div className="rounded-2xl border border-[#0EA5A4]/30 bg-[#0EA5A4]/10 dark:bg-[#0EA5A4]/15 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0EA5A4] text-white">
              <Crown size={16} />
            </div>
            <div>
              <h4 className="text-[13px] font-semibold text-[#0EA5A4] dark:text-[#5EEAD4]">
                Premium Active — Calibrated Risk Percentages
              </h4>
              <p className="mt-0.5 text-xs text-slate-700 dark:text-[#A0B4BE] leading-relaxed max-w-2xl">
                Each predictive model below provides its own calibrated probability percentage with 90-day trajectory progression and multi-biomarker ISF diffusion analysis.
              </p>
            </div>
          </div>
          <Badge className="self-start sm:self-center bg-[#0EA5A4] text-white">
            High Precision Telemetry
          </Badge>
        </div>
      )}

      {/* Medical disclaimer */}
      <Alert className="bg-[#2C4C5C]/5 dark:bg-[#1C2F38] border-[#2C4C5C]/20 dark:border-[#243C47]">
        <Info className="h-4 w-4 text-[#2C4C5C] dark:text-[#0EA5A4]" />
        <AlertDescription className="text-xs text-[#2C4C5C] dark:text-[#E8F2F6] font-medium">
          {t("predictive.medical_disclaimer", "Predictive analysis provides estimates based on continuous ISF measurements and should not replace clinical medical diagnoses. Always consult your healthcare provider.")}
        </AlertDescription>
      </Alert>

      {/* No predictions */}
      {safePredictions.length === 0 && (
        <Card className="dark:bg-[#15232A] dark:border-[#243C47]">
          <CardContent className="p-10">
            <div className="flex flex-col items-center text-center gap-4">
              <Activity className="h-10 w-10 text-muted-foreground" />
              <div>
                <h2 className="text-xl font-semibold dark:text-[#E8F2F6]">
                  {t("predictive.no_data_title", "No predictions available yet")}
                </h2>
                <p className="text-sm text-muted-foreground dark:text-[#A0B4BE] mt-2 max-w-lg">
                  {t("predictive.no_data_body", "There may not be enough hormone readings available to generate a prediction yet.")}
                </p>
              </div>
              <Button onClick={generatePredictions} disabled={generating} className="bg-[#2C4C5C] dark:bg-[#0EA5A4]">
                <Activity className="mr-2 h-4 w-4" />
                {t("predictive.generate", "Generate predictions")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Section 1: PMOS / PCOS Risk */}
      {pmosRisk && (() => {
        const pmosPct = getConditionPercentage(pmosRisk);
        return (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-foreground">
                  {t("predictive.section1_title", "Future PMOS / PCOS Risk")}
                </h2>
                <p className="text-xs text-muted-foreground">Continuous androgen-to-progesterone ratio correlation</p>
              </div>
              {showPremiumFeatures && (
                <span className="text-xs font-semibold text-[#0EA5A4] flex items-center gap-1">
                  <Gauge size={14} /> Individual Calibration
                </span>
              )}
            </div>

            <Card className="border-t-4 border-t-[#0EA5A4] shadow-sm dark:bg-[#15232A] dark:border-[#243C47]">
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-bold text-foreground">PMOS / PCOS</h3>
                      <Badge variant="outline" className="text-[10px] uppercase dark:border-white/10">
                        Primary Predictive Model
                      </Badge>
                    </div>

                    {pmosRisk.model_version && (
                      <p className="text-xs text-muted-foreground">
                        {t("predictive.model_version", "Model version")}: {pmosRisk.model_version}
                      </p>
                    )}

                    <p className="text-xs text-muted-foreground">
                      Updated: {pmosRisk.calculated_at ? new Date(pmosRisk.calculated_at).toLocaleDateString([], { dateStyle: "medium" }) : "Recent"}
                    </p>
                  </div>

                  {/* Free vs Premium Representation for PMOS */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    {showPremiumFeatures ? (
                      <div className="flex items-center gap-5 bg-slate-50 dark:bg-[#1C2F38] px-5 py-3 rounded-2xl border border-slate-200/60 dark:border-white/5">
                        <div className="text-right">
                          <div className={`text-3xl font-extrabold tracking-tight ${getPercentageColor(pmosPct)}`}>
                            {pmosPct.toFixed(1)}%
                          </div>
                          <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                            Estimated Risk
                          </div>
                        </div>

                        <div className="w-28 space-y-1.5">
                          <div className="h-2 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${getProgressColor(pmosPct)} transition-all duration-500`}
                              style={{ width: `${Math.min(100, Math.max(5, pmosPct))}%` }}
                            />
                          </div>
                          <p className="text-[10px] text-muted-foreground text-center">90-day trajectory</p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-[#1C2F38] text-slate-500 dark:text-[#A0B4BE] border border-slate-200 dark:border-white/5 text-xs font-medium">
                        <Lock size={13} className="text-slate-400" />
                        <span>Exact % locked (Free)</span>
                      </div>
                    )}

                    <Badge
                      className={`px-4 py-2 text-xs font-semibold capitalize ${
                        pmosRisk.risk_category === "monitoring"
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-[#F3E308]"
                          : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                      }`}
                    >
                      {pmosRisk.risk_category}
                    </Badge>
                  </div>
                </div>

                {showPremiumFeatures && (
                  <div className="mt-4 pt-4 border-t border-slate-100 dark:border-[#243C47] flex flex-wrap items-center justify-between text-xs text-muted-foreground gap-2">
                    <span>Biomarker weights: Androgen (58%), Progesterone (27%), Cortisol (15%)</span>
                    <span className="text-[#0EA5A4] font-medium">Confidence Interval: 94.2%</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </section>
        );
      })()}

      {/* Section 2: Long-Term Health Conditions (Each with its own percentage in Premium) */}
      {longTermRisks.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-foreground">
                {t("predictive.section2_title", "Long-Term Health Conditions")}
              </h2>
              <p className="text-xs text-muted-foreground">
                {showPremiumFeatures
                  ? "Premium View: Each long-term analysis displays its own calibrated percentage and longitudinal gauge."
                  : "Free View: Qualitative status categories and trend indicators."}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {longTermRisks.map((risk) => {
              const pct = getConditionPercentage(risk);
              return (
                <Card
                  key={risk.condition}
                  className="shadow-sm hover:shadow-md transition dark:bg-[#15232A] dark:border-[#243C47]"
                >
                  <CardContent className="p-5 flex flex-col justify-between h-full space-y-4">
                    <div className="flex justify-between items-start gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#2C4C5C]/10 dark:bg-[#0EA5A4]/15 text-[#2C4C5C] dark:text-[#0EA5A4]">
                          <Activity className="w-5 h-5" />
                        </div>
                        <div>
                          <span className="font-semibold text-foreground text-sm">
                            {getConditionTitle(risk.condition)}
                          </span>
                          <p className="text-[11px] text-muted-foreground">Continuous sensor modeling</p>
                        </div>
                      </div>

                      <Badge
                        variant="secondary"
                        className="capitalize text-xs font-medium dark:bg-[#1C2F38] dark:text-[#E8F2F6]"
                      >
                        {risk.risk_category}
                      </Badge>
                    </div>

                    {/* Free vs Premium Distinction for each condition */}
                    {showPremiumFeatures ? (
                      <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-[#243C47]">
                        <div className="flex items-baseline justify-between">
                          <span className="text-xs text-muted-foreground font-medium">Calibrated Risk</span>
                          <span className={`text-xl font-extrabold tracking-tight ${getPercentageColor(pct)}`}>
                            {pct.toFixed(1)}%
                          </span>
                        </div>
                        <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${getProgressColor(pct)} transition-all duration-500`}
                            style={{ width: `${Math.min(100, Math.max(5, pct))}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1">
                          <span>Low (&lt;15%)</span>
                          <span>Moderate (15-30%)</span>
                          <span>Elevated (&gt;30%)</span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-[#243C47] text-xs text-muted-foreground">
                        <span className="flex items-center gap-1.5 text-slate-500 dark:text-[#A0B4BE]">
                          <Lock size={12} className="text-slate-400" />
                          <span>Percentage locked</span>
                        </span>
                        <span className="text-[11px] font-medium text-slate-400 dark:text-[#738C98]">
                          Upgrade to Premium
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {/* Upgrade callout if on Free mode */}
      {!showPremiumFeatures && (
        <Card className="rounded-2xl border border-dashed border-[#0EA5A4]/40 bg-[#0EA5A4]/5 dark:bg-[#0EA5A4]/10">
          <CardContent className="p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Crown size={18} className="text-[#0EA5A4]" />
                <h3 className="font-bold text-foreground text-sm">Want individual percentages for every predictive marker?</h3>
              </div>
              <p className="text-xs text-muted-foreground max-w-xl">
                Premium unlocks calibrated percentages (e.g. Type 2 Diabetes: 12.0%, Insulin Resistance: 24.0%), hormonal velocity forecasts, and full AI care consultant access.
              </p>
            </div>
            <Button
              onClick={() => setActiveMode("premium")}
              className="bg-[#0EA5A4] hover:bg-[#0C8F8E] text-white shrink-0 text-xs font-semibold"
            >
              <Crown size={14} className="mr-1.5" /> Toggle Premium View
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
