import { describe, it, expect } from "vitest";
import { ConsultantAiService, type ConsultantContext } from "./consultantAiService";

describe("ConsultantAiService - Care Team AI Bot", () => {
  const drBrian: ConsultantContext = {
    id: "375d31f5-c96f-4d11-8934-be6aec206f56",
    full_name: "Dr. Brian Ochieng",
    professional_type: "Endocrinologist",
    initials: "BO",
  };

  const drGrace: ConsultantContext = {
    id: "c8e23456-789a-4bcd-ef01-23456789abcd",
    full_name: "Dr. Grace Wanjiku",
    professional_type: "Gynecologist",
    initials: "GW",
  };

  const testPatientUserId = "test-patient-user-5678";

  it("should generate a welcoming clinical greeting identifying the consultant", async () => {
    const reply = await ConsultantAiService.generateReply(
      drBrian,
      testPatientUserId,
      "Hello doctor, I just joined the app!"
    );

    expect(reply).toBeDefined();
    expect(typeof reply).toBe("string");
    expect(reply.length).toBeGreaterThan(20);
    expect(reply).toContain("Dr. Brian Ochieng");
    expect(reply.toLowerCase()).toMatch(/isf|hormone|telemetry|reading/);
  });

  it("should answer progesterone and luteal phase questions with clinical guidance", async () => {
    const reply = await ConsultantAiService.generateReply(
      drBrian,
      testPatientUserId,
      "What do my progesterone levels mean for my luteal phase?"
    );

    expect(reply).toBeDefined();
    expect(typeof reply).toBe("string");
    expect(reply.toLowerCase()).toContain("progesterone");
    expect(reply.toLowerCase()).toMatch(/luteal|lining|temperature|sleep|metabolic/);
  });

  it("should respond to androgen elevation and acne questions as an endocrinologist", async () => {
    const reply = await ConsultantAiService.generateReply(
      drBrian,
      testPatientUserId,
      "My androgen reading spiked and I'm getting acne on my chin"
    );

    expect(reply).toBeDefined();
    expect(typeof reply).toBe("string");
    expect(reply.toLowerCase()).toContain("free testosterone");
    expect(reply.toLowerCase()).toMatch(/trend|average|moving|monitor|observe/);
  });

  it("should provide specialized gynecological advice for Dr. Grace Wanjiku", async () => {
    const reply = await ConsultantAiService.generateReply(
      drGrace,
      testPatientUserId,
      "I have pelvic cramps and want to know if it is normal for my cycle phase"
    );

    expect(reply).toBeDefined();
    expect(typeof reply).toBe("string");
    expect(reply.toLowerCase()).toMatch(/discomfort|prostaglandin|fluctuation|cycle|symptom|cramp/);
  });

  it("should guide patients on PCOS / PMOS predictive risk indicators", async () => {
    const reply = await ConsultantAiService.generateReply(
      drBrian,
      testPatientUserId,
      "My dashboard shows a PMOS/PCOS risk percentage, what should I do?"
    );

    expect(reply).toBeDefined();
    expect(typeof reply).toBe("string");
    expect(reply.toLowerCase()).toMatch(/ratio|predictive|monitor|manageable|consult/);
  });

  it("should troubleshoot sensor patch adhesion and telemetry connectivity", async () => {
    const reply = await ConsultantAiService.generateReply(
      drGrace,
      testPatientUserId,
      "My ISF patch sensor battery is at 88% and I want to make sure it's transmitting"
    );

    expect(reply).toBeDefined();
    expect(typeof reply).toBe("string");
    expect(reply.toLowerCase()).toMatch(/patch|telemetry|microneedle|sensor|diffusion|skin/);
  });

  it("should handle multi-turn conversational context with history", async () => {
    const history = [
      { sender_type: "patient" as const, body: "Hi, I have a quick question about my readings." },
      { sender_type: "consultant" as const, body: "Hello! I am monitoring your telemetry. How can I help?" },
    ];

    const reply = await ConsultantAiService.generateReply(
      drBrian,
      testPatientUserId,
      "My androgen value seems slightly higher than last week",
      history
    );

    expect(reply).toBeDefined();
    expect(typeof reply).toBe("string");
    expect(reply.length).toBeGreaterThan(20);
  });

  describe("Curated Clinical FAQ hardcoded matches", () => {
    it("should match 'How are my latest hormone readings?' with accurate clinical telemetry answers", async () => {
      const reply = await ConsultantAiService.generateReply(
        drBrian,
        testPatientUserId,
        "How are my latest hormone readings?"
      );
      expect(reply).toContain("19.8 ng/mL");
      expect(reply).toContain("38.2 ng/dL");
      expect(reply.toLowerCase()).toContain("free testosterone");
    });

    it("should match 'What do my progesterone levels indicate?' with ovulatory confirmation", async () => {
      const reply = await ConsultantAiService.generateReply(
        drBrian,
        testPatientUserId,
        "What do my progesterone levels indicate?"
      );
      expect(reply).toContain("19.8 ng/mL");
      expect(reply.toLowerCase()).toContain("ovulation");
      expect(reply.toLowerCase()).toContain("secretory phase");
    });

    it("should match 'Can you explain my androgen pattern?' with stable baseline details", async () => {
      const reply = await ConsultantAiService.generateReply(
        drBrian,
        testPatientUserId,
        "Can you explain my androgen pattern?"
      );
      expect(reply).toContain("38.2 ng/dL");
      expect(reply.toLowerCase()).toContain("threshold of 45 ng/dl");
    });

    it("should match 'What lifestyle adjustments support my current cycle phase?' with clinical recommendations", async () => {
      const reply = await ConsultantAiService.generateReply(
        drBrian,
        testPatientUserId,
        "What lifestyle adjustments support my current cycle phase?"
      );
      expect(reply.toLowerCase()).toContain("magnesium");
      expect(reply.toLowerCase()).toContain("sleep");
    });
  });
});
