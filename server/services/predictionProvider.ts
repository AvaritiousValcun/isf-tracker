export type PredictionCondition =
  | "pmos_pcos"
  | "type_2_diabetes"
  | "insulin_resistance"
  | "high_blood_pressure"
  | "endometrial_cancer";

export type PredictionRiskCategory =
  | "low"
  | "moderate"
  | "elevated"
  | "high";

export interface PredictionResult {
  condition: PredictionCondition;

  risk_category: PredictionRiskCategory;

  risk_percentage: number | null;

  model_id?: string;

  model_version: string;

  feature_version?: string;

  generated_at: string;

  expires_at?: string;

  trend?: string | null;

  explanation_data?: unknown;
}

export interface PredictionProvider {
  readonly id: string;

  readonly environment:
    | "demo"
    | "production";

  readonly productionReady: boolean;

  generatePredictions(
    patientId: string,
  ): Promise<PredictionResult[]>;
}

export class DemoPredictionProvider
  implements PredictionProvider {
  readonly id =
    "demo-prediction-provider";

  readonly environment =
    "demo" as const;

  readonly productionReady =
    false;

  async generatePredictions(
    patientId: string,
  ): Promise<PredictionResult[]> {
    if (!patientId) {
      throw new Error(
        "Patient ID is required.",
      );
    }

    const generatedAt =
      new Date().toISOString();

    const expiresAt =
      new Date(
        Date.now() +
          24 *
            60 *
            60 *
            1000,
      ).toISOString();

    return [
      {
        condition:
          "pmos_pcos",

        risk_category:
          "elevated",

        risk_percentage:
          31,

        model_id:
          this.id,

        model_version:
          "demo-1.1.0",

        feature_version:
          "demo-1.1.0",

        generated_at:
          generatedAt,

        expires_at:
          expiresAt,

        trend:
          "monitor",

        explanation_data: {
          provider:
            "demo",

          clinical_use:
            "not_for_clinical_decision_making",

          synthetic:
            true,

          message:
            "Synthetic demonstration percentage. It is not calculated by a clinically validated prediction model.",
        },
      },

      {
        condition:
          "type_2_diabetes",

        risk_category:
          "low",

        risk_percentage:
          12,

        model_id:
          this.id,

        model_version:
          "demo-1.1.0",

        feature_version:
          "demo-1.1.0",

        generated_at:
          generatedAt,

        expires_at:
          expiresAt,

        trend:
          "stable",

        explanation_data: {
          provider:
            "demo",

          clinical_use:
            "not_for_clinical_decision_making",

          synthetic:
            true,

          message:
            "Synthetic demonstration percentage.",
        },
      },

      {
        condition:
          "insulin_resistance",

        risk_category:
          "moderate",

        risk_percentage:
          24,

        model_id:
          this.id,

        model_version:
          "demo-1.1.0",

        feature_version:
          "demo-1.1.0",

        generated_at:
          generatedAt,

        expires_at:
          expiresAt,

        trend:
          "monitor",

        explanation_data: {
          provider:
            "demo",

          clinical_use:
            "not_for_clinical_decision_making",

          synthetic:
            true,

          message:
            "Synthetic demonstration percentage.",
        },
      },

      {
        condition:
          "high_blood_pressure",

        risk_category:
          "low",

        risk_percentage:
          9,

        model_id:
          this.id,

        model_version:
          "demo-1.1.0",

        feature_version:
          "demo-1.1.0",

        generated_at:
          generatedAt,

        expires_at:
          expiresAt,

        trend:
          "stable",

        explanation_data: {
          provider:
            "demo",

          clinical_use:
            "not_for_clinical_decision_making",

          synthetic:
            true,

          message:
            "Synthetic demonstration percentage.",
        },
      },

      {
        condition:
          "endometrial_cancer",

        risk_category:
          "elevated",

        risk_percentage:
          18,

        model_id:
          this.id,

        model_version:
          "demo-1.1.0",

        feature_version:
          "demo-1.1.0",

        generated_at:
          generatedAt,

        expires_at:
          expiresAt,

        trend:
          "monitor",

        explanation_data: {
          provider:
            "demo",

          clinical_use:
            "not_for_clinical_decision_making",

          synthetic:
            true,

          message:
            "Synthetic demonstration percentage.",
        },
      },
    ];
  }
}

export class ProductionPredictionProvider
  implements PredictionProvider {
  readonly id =
    "production-prediction-provider";

  readonly environment =
    "production" as const;

  readonly productionReady =
    false;

  async generatePredictions(
    _patientId: string,
  ): Promise<PredictionResult[]> {
    throw new Error(
      "Production clinical prediction is not configured. ISF Tracker is currently using the synthetic demo prediction provider.",
    );
  }
}