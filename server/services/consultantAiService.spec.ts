import { describe, it, expect } from "vitest";
import { ConsultantAiService, type ConsultantContext } from "./consultantAiService";

describe("ConsultantAiService - Care Team AI Bot", () => {
  const drAmina: ConsultantContext = {
    id: "375d31f5-c96f-4d11-8934-be6aec206f56",
    full_name: "Dr. Amina Patel",
    professional_type: "Reproductive Endocrinologist",
    initials: "AP",
  };

  const drDavid: ConsultantContext = {
    id: "b4d81234-5678-4abc-9def-0123456789ab",
    full_name: "Dr. David Kim",
    professional_type: "Obstetrician & Gynecologist",
    initials: "DK",
  };

  const testPatientUserId = "test-patient-user-5678";

  it("should generate a welcoming clinical greeting identifying the consultant", async () => {
    const reply = await ConsultantAiService.generateReply(
      drAmina,
      testPatientUserId,
      "Hello doctor, I just joined the app!"
    );

    expect(reply).toBeDefined();
    expect(typeof reply).toBe("string");
    expect(reply.length).toBeGreaterThan(20);
    expect(reply).toContain("Dr. Amina Patel");
    expect(reply.toLowerCase()).toMatch(/isf|hormone|telemetry|reading/);
  });

  it("should answer progesterone and luteal phase questions with clinical guidance", async () => {
    const reply = await ConsultantAiService.generateReply(
      drAmina,
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
      drAmina,
      testPatientUserId,
      "My androgen reading spiked and I'm getting acne on my chin"
    );

    expect(reply).toBeDefined();
    expect(typeof reply).toBe("string");
    expect(reply.toLowerCase()).toContain("androgen");
    expect(reply.toLowerCase()).toMatch(/trend|average|moving|monitor|observe/);
  });

  it("should provide specialized OB/GYN advice for Dr. David Kim", async () => {
    const reply = await ConsultantAiService.generateReply(
      drDavid,
      testPatientUserId,
      "I have pelvic cramps and want to know if it is normal for my cycle phase"
    );

    expect(reply).toBeDefined();
    expect(typeof reply).toBe("string");
    expect(reply.toLowerCase()).toMatch(/discomfort|prostaglandin|fluctuation|cycle|symptom/);
  });

  it("should guide patients on PCOS / PMOS predictive risk indicators", async () => {
    const reply = await ConsultantAiService.generateReply(
      drAmina,
      testPatientUserId,
      "My dashboard shows a PMOS/PCOS risk percentage, what should I do?"
    );

    expect(reply).toBeDefined();
    expect(typeof reply).toBe("string");
    expect(reply.toLowerCase()).toMatch(/ratio|predictive|monitor|manageable|consult/);
  });

  it("should troubleshoot sensor patch adhesion and telemetry connectivity", async () => {
    const reply = await ConsultantAiService.generateReply(
      drDavid,
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
      drAmina,
      testPatientUserId,
      "My androgen value seems slightly higher than last week",
      history
    );

    expect(reply).toBeDefined();
    expect(typeof reply).toBe("string");
    expect(reply.length).toBeGreaterThan(20);
  });
});
