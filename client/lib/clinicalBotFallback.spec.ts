import { describe, it, expect } from "vitest";
import { generateClientConsultantReply } from "./clinicalBotFallback";

describe("generateClientConsultantReply", () => {
  const consultant = {
    full_name: "Dr. Brian Ochieng",
    professional_type: "Endocrinologist",
  };

  it("responds to greetings with doctor introduction", () => {
    const reply = generateClientConsultantReply(consultant, "Hello Dr. Brian!");
    expect(reply).toContain("Dr. Brian Ochieng");
    expect(reply).toContain("Endocrinologist");
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

  it("handles common courtesies like thank you and welcome", () => {
    const thanksReply = generateClientConsultantReply(consultant, "Thank you so much doctor!");
    expect(thanksReply.toLowerCase()).toContain("welcome");

    const welcomeReply = generateClientConsultantReply(consultant, "You're welcome!");
    expect(welcomeReply.toLowerCase()).toContain("delighted to be part of your dedicated care team");

    const howAreYou = generateClientConsultantReply(consultant, "How are you doing today?");
    expect(howAreYou).toContain("19.8 ng/mL");
    expect(howAreYou).toContain("38.2 ng/dL");
  });

  it("answers hardware and patch questions like waterproofing and microneedles", () => {
    const waterReply = generateClientConsultantReply(consultant, "Can I shower or swim with the patch?");
    expect(waterReply).toContain("IP68");

    const needleReply = generateClientConsultantReply(consultant, "Does the microneedle patch hurt when applying?");
    expect(needleReply.toLowerCase()).toContain("painless");

    const batteryReply = generateClientConsultantReply(consultant, "How do I charge the patch battery?");
    expect(batteryReply).toContain("14-day");
  });
});
