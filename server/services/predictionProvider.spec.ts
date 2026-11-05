import { describe, it, expect } from "vitest";
import { DemoPredictionProvider } from "./predictionProvider";

describe("DemoPredictionProvider - Predictive Risk Engine", () => {
  const provider = new DemoPredictionProvider();
  const testPatientId = "test-patient-uuid-9999";

  it("should generate predictions without endometrial_cancer", async () => {
    const results = await provider.generatePredictions(testPatientId);

    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThan(0);

    // Verify endometrial_cancer is NEVER returned
    const endometrial = results.find(
      (r) => (r.condition as string) === "endometrial_cancer" || (r.condition as string) === "endometrial"
    );
    expect(endometrial).toBeUndefined();
  });

  it("should include PMOS/PCOS with a calibrated risk percentage", async () => {
    const results = await provider.generatePredictions(testPatientId);
    const pmos = results.find((r) => (r.condition as string) === "pmos_pcos" || (r.condition as string) === "pcos");

    expect(pmos).toBeDefined();
    expect(pmos?.risk_category).toBeDefined();
    expect(typeof pmos?.risk_percentage).toBe("number");
    expect(pmos?.risk_percentage).toBeGreaterThan(0);
    expect(pmos?.risk_percentage).toBeLessThanOrEqual(100);
  });

  it("should provide distinct risk percentages for each long-term health condition", async () => {
    const results = await provider.generatePredictions(testPatientId);
    
    // Conditions checked
    const t2d = results.find((r) => r.condition === "type_2_diabetes");
    const insulin = results.find((r) => r.condition === "insulin_resistance");
    const hbp = results.find((r) => r.condition === "high_blood_pressure");

    expect(t2d).toBeDefined();
    expect(typeof t2d?.risk_percentage).toBe("number");

    expect(insulin).toBeDefined();
    expect(typeof insulin?.risk_percentage).toBe("number");

    expect(hbp).toBeDefined();
    expect(typeof hbp?.risk_percentage).toBe("number");

    // Verify percentages are non-identical (each condition has its own calibrated value)
    expect(t2d?.risk_percentage).not.toBe(insulin?.risk_percentage);
  });
});
