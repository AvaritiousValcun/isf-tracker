import { describe, it, expect } from "vitest";
import { generateClientConsultantReply } from "./clinicalBotFallback";

describe("generateClientConsultantReply", () => {
  const consultant = {
    full_name: "Dr. Amina Patel",
    professional_type: "Reproductive Endocrinologist",
  };

  it("responds to greetings with doctor introduction", () => {
    const reply = generateClientConsultantReply(consultant, "Hello Dr. Amina!");
    expect(reply).toContain("Dr. Amina Patel");
    expect(reply).toContain("Reproductive Endocrinologist");
    expect(reply).toContain("telemetry");
  });

  it("responds to progesterone questions with clinical values", () => {
    const reply = generateClientConsultantReply(consultant, "What does my progesterone look like?");
    expect(reply).toContain("progesterone");
    expect(reply).toContain("18.2 ng/mL");
    expect(reply).toContain("luteal");
  });

  it("responds to androgen and facial hair questions with clinical stability", () => {
    const reply = generateClientConsultantReply(consultant, "I have acne and chin hair, are my androgens high?");
    expect(reply).toContain("androgen");
    expect(reply).toContain("38 ng/dL");
  });

  it("flags emergency symptoms like severe pain and abnormal bleeding", () => {
    const reply = generateClientConsultantReply(consultant, "I have severe pelvic pain and cramping");
    expect(reply).toContain("urgent medical evaluation");
  });

  it("handles cycle and ovulation questions", () => {
    const reply = generateClientConsultantReply(consultant, "When is my next cycle period due?");
    expect(reply).toContain("luteal phase");
    expect(reply).toContain("6 to 7 days");
  });

  it("provides reassuring clinical fallback for general inquiries", () => {
    const reply = generateClientConsultantReply(consultant, "Can you review my profile overall?");
    expect(reply).toContain("physiologic variation");
  });
});
