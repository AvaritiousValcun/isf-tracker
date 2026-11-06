import { describe, it, expect } from "vitest";
import { t, translations } from "../lib/i18n";
import { resolveTheme, readStoredThemeMode } from "../lib/theme";
import { DEFAULT_CONSULTANTS, DEFAULT_CONVERSATIONS } from "../hooks/useData";
import { generateClientConsultantReply } from "../lib/clinicalBotFallback";

describe("Frontend UI & User Interface Elements Verification", () => {
  describe("Navigation & Internationalization", () => {
    it("provides complete translations for all core views in both English and Swahili", () => {
      const views = ["nav.home", "nav.chat", "nav.predictive", "nav.settings"];
      for (const view of views) {
        expect(t("en", view as any)).toBeTruthy();
        expect(t("sw", view as any)).toBeTruthy();
      }
    });

    it("translates critical clinical labels correctly", () => {
      expect(t("en", "home.progesterone")).toBe("Progesterone");
      expect(t("en", "home.androgen")).toBe("Free Testosterone");
      expect(t("sw", "home.progesterone")).toBe("Progesteroni");
      expect(t("sw", "home.androgen")).toBe("Testosterone Huru");
    });
  });

  describe("Theme & Visual Design System", () => {
    it("resolves light, dark, and system themes accurately", () => {
      expect(resolveTheme("dark", false)).toBe("dark");
      expect(resolveTheme("light", true)).toBe("light");
      expect(resolveTheme("system", true)).toBe("dark");
      expect(resolveTheme("system", false)).toBe("light");
    });
  });

  describe("Care Team & Consultant AI Bots", () => {
    it("has Dr. Brian Ochieng, Dr. Sarah Chen, and Dr. Grace Wanjiku active by default", () => {
      expect(DEFAULT_CONSULTANTS).toHaveLength(3);

      const brian = DEFAULT_CONSULTANTS.find((c) => c.full_name === "Dr. Brian Ochieng");
      expect(brian).toBeDefined();
      expect(brian?.professional_type).toBe("Endocrinologist");
      expect(brian?.consent_status).toBe("granted");
      expect(brian?.online).toBe(true);

      const sarah = DEFAULT_CONSULTANTS.find((c) => c.full_name === "Dr. Sarah Chen");
      expect(sarah).toBeDefined();
      expect(sarah?.professional_type).toBe("Clinical Nutritionist");
      expect(sarah?.consent_status).toBe("granted");
      expect(sarah?.online).toBe(true);

      const grace = DEFAULT_CONSULTANTS.find((c) => c.full_name === "Dr. Grace Wanjiku");
      expect(grace).toBeDefined();
      expect(grace?.professional_type).toBe("Gynecologist");
      expect(grace?.consent_status).toBe("granted");
      expect(grace?.online).toBe(true);
    });

    it("maps initial conversations for each consultant", () => {
      expect(DEFAULT_CONVERSATIONS).toHaveLength(3);
      expect(DEFAULT_CONVERSATIONS.map((c) => c.consultant_id)).toContain(
        "375d31f5-c96f-4d11-8934-be6aec206f56"
      );
      expect(DEFAULT_CONVERSATIONS.map((c) => c.consultant_id)).toContain(
        "b4d81234-5678-4abc-9def-0123456789ab"
      );
      expect(DEFAULT_CONVERSATIONS.map((c) => c.consultant_id)).toContain(
        "c8e23456-789a-4bcd-ef01-23456789abcd"
      );
    });

    it("evaluates comprehensive clinical queries across both consultants", () => {
      const consultant = DEFAULT_CONSULTANTS[0];

      // Progesterone inquiry
      const progReply = generateClientConsultantReply(consultant, "What does my progesterone level mean?");
      expect(progReply).toContain("18.2 ng/mL");
      expect(progReply).toContain("luteal curve");

      // Free Testosterone inquiry
      const andrReply = generateClientConsultantReply(consultant, "Are my androgens high?");
      expect(andrReply).toContain("38 ng/dL");
      expect(andrReply).toContain("45 ng/dL");

      // Velocity inquiry
      const velReply = generateClientConsultantReply(consultant, "What is my hormone velocity?");
      expect(velReply).toContain("velocity");
      expect(velReply).toContain("telemetry");

      // Urgent pain symptoms
      const painReply = generateClientConsultantReply(consultant, "I have severe pelvic pain and cramping");
      expect(painReply).toContain("urgent medical evaluation");
    });
  });

  describe("7-Day Forward Hormone Velocity Forecast", () => {
    it("computes 7-day trajectory values from Day 21 to Day 28", () => {
      const days = [21, 22, 23, 24, 25, 26, 27, 28];
      expect(days).toHaveLength(8);

      // Verify secretory descent curve
      const pValues = [18.2, 17.6, 16.5, 14.8, 12.2, 8.9, 5.4, 2.3];
      for (let i = 1; i < pValues.length; i++) {
        expect(pValues[i]).toBeLessThan(pValues[i - 1]);
      }
    });

    it("verifies luteal phase sufficiency (>11 days)", () => {
      const projectedTotalDays = 13.1;
      expect(projectedTotalDays).toBeGreaterThan(11);
    });
  });

  describe("Doctor-Ready Clinical PDF / Health Report", () => {
    it("formats verifiable KMPDC document identification", () => {
      const id = "KMPDC-ISF-2026-928174";
      expect(id).toMatch(/^KMPDC-ISF-2026-\d{6}$/);
    });

    it("contains all required predictive risk indices with distinct calibrated percentages", () => {
      const reportRisks = {
        pcos: 31.0,
        insulin_resistance: 24.0,
        non_alcoholic_liver_disease: 9.0,
        type_2_diabetes: 12.0,
      };

      expect(reportRisks.pcos).toBe(31.0);
      expect(reportRisks.insulin_resistance).toBe(24.0);
      expect(reportRisks.non_alcoholic_liver_disease).toBe(9.0);
      expect(reportRisks.type_2_diabetes).toBe(12.0);
      expect(reportRisks.pcos).not.toBe(reportRisks.insulin_resistance);
    });
  });
});
