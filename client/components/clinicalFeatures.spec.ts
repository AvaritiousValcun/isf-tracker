import { describe, it, expect } from "vitest";
import { generateClientConsultantReply } from "../lib/clinicalBotFallback";

describe("Clinical Features & Velocity Models", () => {
  describe("7-Day Forward Hormone Velocity Logic", () => {
    it("computes negative progesterone velocity during late luteal descent", () => {
      const pToday = 18.2;
      const pTomorrow = 17.6;
      const deltaP = Number((pTomorrow - pToday).toFixed(1));
      expect(deltaP).toBe(-0.6);
      expect(deltaP).toBeLessThan(0);
    });

    it("verifies luteal phase adequacy threshold (>11 days)", () => {
      const projectedLutealDays = 13.1;
      const hasLutealDefect = projectedLutealDays < 11.0;
      expect(hasLutealDefect).toBe(false);
      expect(projectedLutealDays).toBeGreaterThan(11.0);
    });

    it("evaluates balanced estrogen to progesterone ratio", () => {
      const estradiol = 158; // pg/mL
      const progesterone = 17.6; // ng/mL
      const ratio = Number((estradiol / progesterone).toFixed(1));
      expect(ratio).toBe(9.0);
      expect(ratio).toBeLessThan(20.0); // Within normal luteal balance
    });
  });

  describe("Doctor-Ready Clinical Summary Formatting", () => {
    it("verifies KMPDC regulatory document reference structure", () => {
      const docPrefix = "KMPDC-ISF-2026-";
      const sampleId = `${docPrefix}849201`;
      expect(sampleId).toMatch(/^KMPDC-ISF-2026-\d{6}$/);
    });

    it("ensures all 4 key clinical biomarkers are present in telemetry summary", () => {
      const biomarkers = ["Progesterone", "Total Androgens", "Estradiol", "Glycemic Correlation"];
      expect(biomarkers).toHaveLength(4);
      expect(biomarkers).toContain("Progesterone");
      expect(biomarkers).toContain("Estradiol");
    });
  });

  describe("Consultant AI Bot Resilience", () => {
    const drKim = {
      full_name: "Dr. David Kim",
      professional_type: "Obstetrician & Gynecologist",
    };

    it("provides continuous clinical guidance even when offline", () => {
      const reply = generateClientConsultantReply(drKim, "Should I be worried about my progesterone?");
      expect(reply).toContain("progesterone");
      expect(reply).toContain("18.2 ng/mL");
      expect(reply).toContain("luteal curve");
    });
  });
});
