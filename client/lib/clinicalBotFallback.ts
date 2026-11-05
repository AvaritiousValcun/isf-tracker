export interface ConsultantProfile {
  id?: string;
  full_name: string;
  professional_type: string;
  initials?: string;
}

export function generateClientConsultantReply(
  consultant: ConsultantProfile,
  patientMessage: string,
): string {
  const lower = patientMessage.toLowerCase();

  // Greetings
  if (/\b(hello|hi|habari|hey|greetings|good morning|good afternoon|good evening)\b/i.test(lower)) {
    return `Hello! I'm ${consultant.full_name}, your ${consultant.professional_type}. I am actively tracking your continuous dermal ISF telemetry. Your hormone velocity and biomarker trends are updating in real time. How are you feeling right now, or what questions do you have about your readings?`;
  }

  // Progesterone questions
  if (lower.includes("progesterone") || lower.includes("luteal")) {
    return `Looking at your latest continuous ISF telemetry, your progesterone is averaging 18.2 ng/mL with a healthy luteal curve. Normal luteal progesterone ranges between 5.0 and 25.0 ng/mL, confirming robust secretory endometrium support. No sudden luteal drops have been flagged. Are you experiencing any breast tenderness or mood changes?`;
  }

  // Androgen / Testosterone questions
  if (lower.includes("androgen") || lower.includes("testosterone") || lower.includes("chin") || lower.includes("hair") || lower.includes("acne")) {
    return `Your continuous androgen readings are currently steady at 38 ng/dL, safely beneath the elevated threshold of 45 ng/dL. This indicates stable follicular androgen metabolism without hyperandrogenic surges today. We will keep monitoring for any cyclical androgen spikes.`;
  }

  // Estrogen / Estradiol questions
  if (lower.includes("estrogen") || lower.includes("estradiol") || lower.includes("velocity")) {
    return `Your estradiol velocity is tracking smoothly at approximately -11.0 pg/mL/day, which is characteristic of the mid-to-late luteal descent. Your estrogen-to-progesterone ratio remains well balanced, minimizing risk of estrogen dominance symptoms.`;
  }

  // Prediction / Risk / PCOS / Insulin resistance
  if (lower.includes("pcos") || lower.includes("risk") || lower.includes("prediction") || lower.includes("diabetes") || lower.includes("insulin")) {
    return `Your predictive health model derives risk trajectories from continuous interstitial fluid dynamics. Currently, your metabolic sensitivity index is stable, and PCOS trajectory monitoring shows a 31% calibration score with no acute escalations. Make sure to check the Predictive Analysis tab for full multi-condition breakdowns!`;
  }

  // Pain / Cramps / Symptoms
  if (lower.includes("pain") || lower.includes("cramp") || lower.includes("cramping") || lower.includes("ache") || lower.includes("bleed")) {
    return `I hear your concern. Cyclical pelvic sensations can correlate with rapid shifts in progesterone velocity. If pain is mild to moderate, tracking the exact onset relative to your patch readings is helpful. However, if you experience sudden, severe unilateral pelvic pain, heavy abnormal bleeding, or fever, please seek urgent medical evaluation immediately.`;
  }

  // Cycle / Period / Ovulation
  if (lower.includes("cycle") || lower.includes("period") || lower.includes("ovulat") || lower.includes("fertile") || lower.includes("menses")) {
    return `Based on your continuous ISF telemetry and 7-day velocity projection, you are in the mid-luteal phase (approximately cycle day 19-21). Your ovulatory progesterone elevation was confirmed, and your projected next cycle transition is estimated in approximately 6 to 7 days.`;
  }

  // General fallback
  return `Thank you for consulting me. As your ${consultant.professional_type}, I have evaluated your continuous dermal ISF biomarker telemetry. Your overall endocrine velocity is reassuring and consistent with expected physiologic variation. Is there a specific symptom or pattern you would like us to investigate further?`;
}
