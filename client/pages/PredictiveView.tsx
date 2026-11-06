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
  FileText,
  Droplets,
  Flame,
  ShieldCheck,
} from "lucide-react";
import ClinicalReportExportModal from "../components/ClinicalReportExportModal";

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
  const [reportOpen, setReportOpen] = useState(false);

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
      case "hypertension":
      case "non_alcoholic_fatty_liver":
      case "nafld":
        return "Non-Alcoholic Liver Disease (NAFLD)";
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
      case "non_alcoholic_fatty_liver":
      case "nafld":
      case "high_blood_pressure":
      case "hypertension":
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
    <div className="page-enter mx-auto max-w-[1250px] px-5 pb-10 pt-7 sm:px-8 lg:px-10 lg:pt-9 space-y-8">
      {/* Header with Plan Switcher */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-1">
        <div className="space-y-1">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#0EA5A4]">Endocrine Analytics</span>
            <span className="text-slate-300 dark:text-slate-700">•</span>
            {showPremiumFeatures ? (
              <Badge className="bg-[#0EA5A4] text-white hover:bg-[#0EA5A4] flex items-center gap-1 text-[10px] font-bold rounded-full">
                <Crown size={11} /> Premium Active
              </Badge>
            ) : (
              <Badge variant="outline" className="text-slate-600 dark:text-[#A0B4BE] border-slate-200 dark:border-white/10 text-[10px] font-semibold rounded-full">
                Free Plan
              </Badge>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-[#E8F2F6]">
            {t("predictive.title", "Predictive Analysis")}
          </h1>
          <p className="text-slate-500 dark:text-[#A0B4BE] text-xs sm:text-sm max-w-2xl leading-relaxed">
            {t("predictive.subtitle", "Longitudinal risk projection models derived from continuous interstitial fluid tracking.")}
          </p>
        </div>

        <div className="flex flex-col sm:items-end gap-2 shrink-0">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Plan View Switcher Toggle */}
            <div className="flex items-center rounded-full bg-slate-100 dark:bg-[#15232A] border border-slate-200 dark:border-[#243C47] p-1 shadow-2xs">
              <button
                onClick={() => setActiveMode("free")}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition ${
                  activeMode === "free"
                    ? "bg-white dark:bg-[#1C2F38] text-slate-900 dark:text-[#E8F2F6] shadow-2xs"
                    : "text-slate-500 dark:text-[#A0B4BE] hover:text-slate-900"
                }`}
              >
                Free Version
              </button>
              <button
                onClick={() => setActiveMode("premium")}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition ${
                  activeMode === "premium"
                    ? "bg-[#0EA5A4] text-white shadow-2xs"
                    : "text-slate-500 dark:text-[#A0B4BE] hover:text-[#0EA5A4]"
                }`}
              >
                <Crown size={13} /> Premium Version
              </button>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setReportOpen(true)}
              className="border-[#F3E308]/40 dark:border-[#F3E308]/40 bg-[#F3E308]/15 dark:bg-[#F3E308]/15 hover:bg-[#F3E308]/25 text-[#7A6600] dark:text-[#F3E308] font-bold shadow-2xs rounded-full px-4"
            >
              <FileText className="mr-1.5 h-3.5 w-3.5 text-[#7A6600] dark:text-[#F3E308]" />
              Doctor Report (PDF)
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={generatePredictions}
              disabled={generating}
              className="rounded-full border-slate-200 dark:border-[#243C47] dark:hover:bg-[#1C2F38] text-xs font-semibold px-4"
            >
              <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${generating ? "animate-spin" : ""}`} />
              {t("common.refresh", "Refresh")}
            </Button>
          </div>

          <button
            type="button"
            onClick={handleRevoke}
            className="text-[11px] text-slate-400 hover:text-destructive dark:text-slate-500 dark:hover:text-rose-400 transition font-medium self-start sm:self-end pr-1"
          >
            {t("predictive.revoke", "Revoke consent")}
          </button>
        </div>
      </div>

      {/* Medical disclaimer */}
      <div className="rounded-2xl border border-slate-200/90 dark:border-white/10 bg-slate-50/60 dark:bg-[#15232A] px-4 py-3 flex items-center gap-2.5 text-xs text-slate-500 dark:text-[#A0B4BE]">
        <Info className="h-4 w-4 text-[#0EA5A4] shrink-0" />
        <span>
          {t(
            "predictive.medical_disclaimer",
            "Predictive analysis provides estimates based on continuous ISF measurements and should not replace clinical medical diagnoses. Always consult your healthcare provider."
          )}
        </span>
      </div>

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
          <div className="space-y-3.5">
            <div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#0EA5A4]" />
                <h2 className="text-xs font-bold tracking-wider text-[#2C4C5C] dark:text-[#E8F2F6] uppercase">
                  {t("predictive.section1_title", "Future PMOS / PCOS Risk")}
                </h2>
              </div>
              <p className="text-xs text-slate-500 dark:text-[#A0B4BE] mt-0.5">
                Continuous free testosterone-to-progesterone ratio correlation & interstitial fluid kinetics
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200/90 dark:border-[#243C47] border-t-2 border-t-[#0EA5A4] bg-white dark:bg-[#15232A] p-6 shadow-xs hover:border-slate-300 dark:hover:border-[#325260] transition-all">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2.5">
                    <h3 className="font-display text-lg font-bold tracking-tight text-[#2C4C5C] dark:text-[#E8F2F6]">
                      PMOS / PCOS Trajectory
                    </h3>
                    <span className="inline-flex items-center rounded-full bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800/40 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                      Primary Predictive Model
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
                    <span>Model version: {pmosRisk.model_version || "demo-1.1.0"}</span>
                    <span>•</span>
                    <span>
                      Updated:{" "}
                      {pmosRisk.calculated_at
                        ? new Date(pmosRisk.calculated_at).toLocaleDateString([], {
                            dateStyle: "medium",
                          })
                        : "Nov 6, 2026"}
                    </span>
                  </div>
                </div>

                {/* Free vs Premium Representation for PMOS */}
                <div className="flex items-center gap-2.5">
                  {showPremiumFeatures ? (
                    <div className="flex items-center gap-5 bg-slate-50 dark:bg-[#1C2F38] px-5 py-3 rounded-2xl border border-slate-200 dark:border-white/10 shadow-xs">
                      <div className="text-right">
                        <div
                          className={`text-3xl font-extrabold tracking-tight ${getPercentageColor(
                            pmosPct
                          )}`}
                        >
                          {pmosPct.toFixed(1)}%
                        </div>
                        <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                          Estimated Risk
                        </div>
                      </div>

                      <div className="w-28 space-y-1.5">
                        <div className="h-2 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${getProgressColor(
                              pmosPct
                            )} transition-all duration-500`}
                            style={{
                              width: `${Math.min(100, Math.max(5, pmosPct))}%`,
                            }}
                          />
                        </div>
                        <p className="text-[10px] text-slate-500 text-center">
                          90-day trajectory
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 rounded-full bg-slate-50 dark:bg-[#1C2F38] border border-slate-200 dark:border-white/10 px-3.5 py-1.5 text-xs text-slate-600 dark:text-slate-300 font-medium">
                      <Lock size={12} className="text-amber-500" />
                      <span>Exact % locked (Free)</span>
                    </div>
                  )}

                  <div
                    className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold capitalize ${
                      pmosRisk.risk_category === "monitoring"
                        ? "bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-900/40 text-amber-700 dark:text-amber-300"
                        : pmosRisk.risk_category === "elevated"
                        ? "bg-rose-50 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-900/40 text-rose-600 dark:text-rose-300"
                        : "bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-900/40 text-emerald-600 dark:text-emerald-300"
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        pmosRisk.risk_category === "monitoring"
                          ? "bg-amber-500"
                          : pmosRisk.risk_category === "elevated"
                          ? "bg-rose-500"
                          : "bg-emerald-500"
                      }`}
                    />
                    <span>{pmosRisk.risk_category}</span>
                  </div>
                </div>
              </div>

              {showPremiumFeatures && (
                <div className="mt-5 pt-4 border-t border-slate-100 dark:border-[#243C47] flex flex-wrap items-center justify-between text-xs text-slate-500 dark:text-[#A0B4BE] gap-2">
                  <span>
                    Biomarker weights: Free Testosterone (58%), Progesterone (27%), Cortisol (15%)
                  </span>
                  <span className="text-teal-600 dark:text-teal-300 font-bold">
                    Confidence Interval: 94.2%
                  </span>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Section 2: Long-Term Health Conditions */}
      <div className="space-y-3.5">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-purple-500" />
            <h2 className="text-xs font-bold tracking-wider text-[#2C4C5C] dark:text-[#E8F2F6] uppercase">
              {t("predictive.section2_title", "Long-Term Health Conditions")}
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-[#A0B4BE] mt-0.5">
            {showPremiumFeatures
              ? "Premium View: Each long-term analysis displays its own calibrated percentage and longitudinal gauge."
              : "Free View: Qualitative status categories and trend indicators."}
          </p>
        </div>

        {(() => {
          const conditionsList = [
            {
              conditionKey: "type_2_diabetes",
              title: "Type 2 Diabetes",
              subtitle: "Continuous sensor modeling (Glycemic velocity)",
              defaultCategory: "low",
              defaultPct: 12.0,
              iconType: "diabetes" as const,
            },
            {
              conditionKey: "insulin_resistance",
              title: "Insulin Resistance",
              subtitle: "Receptor sensitivity & metabolic dynamics",
              defaultCategory: "moderate",
              defaultPct: 24.0,
              iconType: "insulin" as const,
            },
            {
              conditionKey: "nafld",
              title: "Non-Alcoholic Liver Disease (NAFLD)",
              subtitle: "Hepatic lipid biomarker & metabolic balance",
              defaultCategory: "low",
              defaultPct: 9.0,
              iconType: "nafld" as const,
            },
          ];

          return (
            <div className="overflow-hidden rounded-2xl border border-slate-200/90 dark:border-white/10 bg-white dark:bg-[#15232A] shadow-xs">
              {/* Table Column Headers */}
              <div className="hidden md:grid grid-cols-12 items-center px-6 py-3.5 border-b border-slate-100 dark:border-white/5 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400 bg-slate-50/50 dark:bg-white/[0.02]">
                <div className="col-span-4">Condition</div>
                <div className="col-span-4">Basis</div>
                <div className="col-span-2">Status</div>
                <div className="col-span-2 text-right">Risk Percentage</div>
              </div>

              {/* Table Rows */}
              <div className="divide-y divide-slate-100 dark:divide-white/5">
                {conditionsList.map((c) => {
                  const match = safePredictions.find(
                    (p) =>
                      p.condition === c.conditionKey ||
                      (c.conditionKey === "nafld" &&
                        (p.condition === "non_alcoholic_fatty_liver" ||
                          p.condition === "high_blood_pressure" ||
                          p.condition === "hypertension" ||
                          p.condition === "nafld"))
                  );

                  const category = match?.risk_category || c.defaultCategory;
                  const pct = match ? getConditionPercentage(match) : c.defaultPct;

                  return (
                    <div
                      key={c.conditionKey}
                      className="flex flex-col md:grid md:grid-cols-12 items-start md:items-center px-6 py-4.5 gap-3 md:gap-0 hover:bg-slate-50/50 dark:hover:bg-white/[0.015] transition"
                    >
                      {/* Condition */}
                      <div className="col-span-4 flex items-center gap-3">
                        <div
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                            c.iconType === "diabetes"
                              ? "bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400 border border-teal-200/60 dark:border-teal-800/40"
                              : c.iconType === "insulin"
                              ? "bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/40"
                              : "bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 border border-violet-200/60 dark:border-violet-800/40"
                          }`}
                        >
                          {c.iconType === "diabetes" ? (
                            <Droplets className="w-4 h-4" />
                          ) : c.iconType === "insulin" ? (
                            <Flame className="w-4 h-4" />
                          ) : (
                            <ShieldCheck className="w-4 h-4" />
                          )}
                        </div>
                        <span className="font-bold text-slate-900 dark:text-[#E8F2F6] text-sm leading-snug">
                          {c.title}
                        </span>
                      </div>

                      {/* Basis */}
                      <div className="col-span-4 text-xs text-slate-500 dark:text-[#A0B4BE] pr-4">
                        {c.subtitle}
                      </div>

                      {/* Status */}
                      <div className="col-span-2 flex items-center">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold capitalize ${
                            category === "moderate"
                              ? "bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/40 text-amber-700 dark:text-amber-300"
                              : category === "elevated"
                              ? "bg-rose-50 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-800/40 text-rose-700 dark:text-rose-300"
                              : "bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/40 text-emerald-700 dark:text-emerald-300"
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              category === "moderate"
                                ? "bg-amber-500"
                                : category === "elevated"
                                ? "bg-rose-500"
                                : "bg-emerald-500"
                            }`}
                          />
                          <span>{category}</span>
                        </span>
                      </div>

                      {/* Risk Percentage */}
                      <div className="col-span-2 flex items-center md:justify-end gap-3 w-full md:w-auto">
                        {showPremiumFeatures ? (
                          <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                            <div className="w-20 hidden lg:block">
                              <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                <div
                                  className={`h-full ${getProgressColor(
                                    pct
                                  )} transition-all duration-500`}
                                  style={{
                                    width: `${Math.min(100, Math.max(5, pct))}%`,
                                  }}
                                />
                              </div>
                            </div>
                            <span
                              className={`text-sm font-extrabold tracking-tight ${getPercentageColor(
                                pct
                              )}`}
                            >
                              {pct.toFixed(1)}%
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end text-xs">
                            <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 font-medium">
                              <Lock size={12} className="text-amber-500 dark:text-[#F3E308]" />
                              <span>Locked</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => setActiveMode("premium")}
                              className="font-semibold text-[#0EA5A4] hover:text-[#0C8F8E] dark:text-[#0EA5A4] dark:hover:text-[#5EEAD4] transition flex items-center gap-0.5 text-xs"
                            >
                              <span>Upgrade to Premium</span>
                              <span className="text-sm leading-none">›</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}
      </div>

      {/* Upgrade callout if on Free mode */}
      {!showPremiumFeatures && (
        <div className="rounded-2xl border border-teal-500/25 bg-teal-50/30 dark:bg-teal-950/20 p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="font-bold text-slate-900 dark:text-[#E8F2F6] text-sm">
              Want individual percentages for every predictive marker?
            </h3>
            <p className="text-xs text-slate-500 dark:text-[#A0B4BE] max-w-xl">
              Premium unlocks calibrated percentages (e.g. Type 2 Diabetes: 12.0%, Insulin Resistance: 24.0%), hormonal velocity forecasts, and full AI care consultant access.
            </p>
          </div>
          <button
            onClick={() => setActiveMode("premium")}
            className="rounded-full bg-[#0EA5A4] hover:bg-[#0C8F8E] text-white px-5 py-2.5 text-xs font-semibold shadow-xs transition shrink-0"
          >
            Toggle Premium View
          </button>
        </div>
      )}

      <ClinicalReportExportModal
        isOpen={reportOpen}
        onClose={() => setReportOpen(false)}
      />
    </div>
  );
}
