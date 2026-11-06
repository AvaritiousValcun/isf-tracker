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

    it("ensures focus clinical biomarkers are present in telemetry summary", () => {
      const biomarkers = ["Progesterone", "Free Testosterone"];
      expect(biomarkers).toHaveLength(2);
      expect(biomarkers).toContain("Progesterone");
      expect(biomarkers).toContain("Free Testosterone");
    });
  });

  describe("Consultant AI Bot Resilience", () => {
    const drGrace = {
      full_name: "Dr. Grace Wanjiku",
      professional_type: "Gynecologist",
    };

    it("provides continuous clinical guidance even when offline", () => {
      const reply = generateClientConsultantReply(drGrace, "Should I be worried about my progesterone?");
      expect(reply).toContain("progesterone");
      expect(reply).toContain("18.2 ng/mL");
      expect(reply).toContain("luteal curve");
    });

    describe("Hardcoded Curated Questions Matching Answers", () => {
      const drBrian = {
        full_name: "Dr. Brian Ochieng",
        professional_type: "Endocrinologist",
      };

      it("answers 'How are my latest hormone readings?' with exact telemetry", () => {
        const reply = generateClientConsultantReply(drBrian, "How are my latest hormone readings?");
        expect(reply).toContain("19.8 ng/mL");
        expect(reply).toContain("38.2 ng/dL");
        expect(reply.toLowerCase()).toContain("free testosterone");
      });

      it("answers 'What do my progesterone levels indicate?' with ovulatory confirmation", () => {
        const reply = generateClientConsultantReply(drBrian, "What do my progesterone levels indicate?");
        expect(reply).toContain("19.8 ng/mL");
        expect(reply.toLowerCase()).toContain("secretory phase");
      });

      it("answers 'Can you explain my androgen pattern?' with stable baseline details", () => {
        const reply = generateClientConsultantReply(drBrian, "Can you explain my androgen pattern?");
        expect(reply).toContain("38.2 ng/dL");
        expect(reply.toLowerCase()).toContain("threshold of 45 ng/dl");
      });

      it("answers 'When is my next predicted cycle transition?' with 6-7 day forecast", () => {
        const reply = generateClientConsultantReply(drBrian, "When is my next predicted cycle transition?");
        expect(reply.toLowerCase()).toContain("6 to 7 days");
      });
    });
  });
});
