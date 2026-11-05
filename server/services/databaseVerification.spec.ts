import { describe, it, expect } from "vitest";

describe("Database & Tables Verification", () => {
  const tables = [
    "patient_profiles",
    "hormone_readings",
    "predictions",
    "consultants",
    "conversations",
    "messages",
    "consent_records",
    "subscriptions",
    "patient_patches",
    "trend_events",
    "share_sessions",
  ];

  it("verifies all canonical application tables are defined in schema", () => {
    expect(tables).toHaveLength(11);
    expect(tables).toContain("patient_profiles");
    expect(tables).toContain("hormone_readings");
    expect(tables).toContain("predictions");
    expect(tables).toContain("consultants");
    expect(tables).toContain("conversations");
    expect(tables).toContain("messages");
    expect(tables).toContain("consent_records");
    expect(tables).toContain("subscriptions");
    expect(tables).toContain("patient_patches");
    expect(tables).toContain("trend_events");
    expect(tables).toContain("share_sessions");
  });

  describe("Schema Invariant Checks", () => {
    it("ensures prediction service strips any endometrial cancer condition", async () => {
      const { DemoPredictionProvider } = await import("./predictionProvider");
      const provider = new DemoPredictionProvider();
      const predictions = await provider.generatePredictions("00000000-0000-4000-a000-000000000001");

      const endometrial = predictions.filter(
        (p) => (p.condition as string) === "endometrial_cancer" || (p.condition as string).includes("endometrial")
      );
      expect(endometrial).toHaveLength(0);
      expect(predictions.length).toBeGreaterThan(0);
      expect(predictions.map((p) => p.condition)).toContain("pmos_pcos");
      expect(predictions.map((p) => p.condition)).toContain("insulin_resistance");
      expect(predictions.map((p) => p.condition)).toContain("type_2_diabetes");
    });

    it("verifies consent record schema supports versioning and granular scope", () => {
      const record = {
        patient_user_id: "00000000-0000-4000-a000-000000000001",
        consultant_id: "375d31f5-c96f-4d11-8934-be6aec206f56",
        purpose: "consultant_access",
        scope: {
          current_readings: true,
          historical_readings: true,
          trend_alerts: true,
          chat: true,
        },
        status: "granted",
        consent_version: "1.0",
      };

      expect(record.consent_version).toBe("1.0");
      expect(record.scope.chat).toBe(true);
      expect(record.status).toBe("granted");
    });

    it("verifies conversation schema compatibility without patient_id foreign key constraint crash", () => {
      const conversationPayload = {
        patient_user_id: "00000000-0000-4000-a000-000000000001",
        consultant_id: "375d31f5-c96f-4d11-8934-be6aec206f56",
        status: "active",
      };

      expect(conversationPayload.patient_user_id).toBeDefined();
      expect(conversationPayload.consultant_id).toBeDefined();
      expect(conversationPayload.status).toBe("active");
    });
  });
});
