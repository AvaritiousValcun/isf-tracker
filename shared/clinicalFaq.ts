export interface ClinicalFaqItem {
  id: string;
  question: string;
  category: string;
  summary: string;
  answers: {
    endocrinologist: string;
    obgyn: string;
    default: string;
  };
}

export const CLINICAL_FAQ_ITEMS: ClinicalFaqItem[] = [
  {
    id: "latest-readings",
    question: "How are my latest hormone readings?",
    category: "Hormone Readings",
    summary: "Progesterone at 19.8 ng/mL, Androgen at 38.2 ng/dL, normal luteal plateau.",
    answers: {
      endocrinologist:
        "Your latest continuous ISF readings show Progesterone at 19.8 ng/mL and Androgens steady at 38.2 ng/dL, with Estradiol velocity descending at -11.0 pg/mL/day. These concentrations confirm robust post-ovulatory luteal stability within ideal physiological reference ranges (progesterone 5–25 ng/mL; androgens <45 ng/dL). Your transdermal patch is capturing continuous dermal interstitial flux accurately with zero detected anomalous spikes.",
      obgyn:
        "Your current dermal hormone telemetry shows healthy secretory luteal parameters: Progesterone is 19.8 ng/mL, confirming effective ovulatory corpus luteum function, and Androgen levels remain well controlled at 38.2 ng/dL. Uterine lining support is optimal, and no hyperandrogenic surges or erratic fluctuations are present in your continuous stream.",
      default:
        "Your latest continuous ISF readings show Progesterone at 19.8 ng/mL and Androgen at 38.2 ng/dL. Both biomarkers sit comfortably within expected mid-luteal physiological boundaries, indicating stable endocrine velocity and optimal patch diffusion.",
    },
  },
  {
    id: "progesterone-indication",
    question: "What do my progesterone levels indicate?",
    category: "Progesterone",
    summary: "Confirms mid-luteal ovulatory phase with robust corpus luteum support.",
    answers: {
      endocrinologist:
        "Your progesterone reading of 19.8 ng/mL (averaging 18.2 ng/mL with a healthy luteal curve) indicates that successful ovulation occurred and you are currently in the mid-luteal secretory phase. In a normal ovulatory cycle, mid-luteal progesterone ranges between 5.0 and 25.0 ng/mL to maintain endometrial integrity and support thermogenic metabolic balance. The steady 24-hour plateau confirms healthy corpus luteum vascularization.",
      obgyn:
        "Your progesterone levels indicate strong ovulatory activity and adequate luteal phase support, averaging 18.2 ng/mL along a reassuring luteal curve. Because progesterone is sustaining near ~20 ng/mL without premature cliff drops, your endometrial lining is stable. Mild breast tenderness or slight temperature increases at this level are completely normal physiological responses to healthy progesterone.",
      default:
        "Your progesterone reading of 19.8 ng/mL (averaging 18.2 ng/mL with a healthy luteal curve) confirms ovulatory confirmation and mid-luteal secretory stability. This level adequately supports endometrial maturation with no signs of premature luteal insufficiency.",
    },
  },
  {
    id: "androgen-pattern",
    question: "Can you explain my androgen pattern?",
    category: "Androgens",
    summary: "Controlled at 38.2 ng/dL with no hyperandrogenic pulses or PCOS risk surges.",
    answers: {
      endocrinologist:
        "Your continuous androgen pattern is currently holding stable at 38.2 ng/dL, comfortably below the clinical threshold of 45 ng/dL. Unlike in hyperandrogenic conditions such as classical PCOS, where androgen pulsatility shows elevated baseline surges, your continuous ISF profile exhibits minimal diurnal variance and smooth clearance, signaling balanced ovarian and adrenal enzymatic activity.",
      obgyn:
        "Your androgen pattern shows a stable, non-escalating baseline well within asymptomatic female physiological limits. We monitor this continuously through the patch to check for early micro-surges that could cause acne, hirsutism, or anovulatory follicular arrest. Your telemetry confirms clean clearance with no hyperandrogenic risks flagged.",
      default:
        "Your continuous androgen pattern is steady at 38.2 ng/dL (normal threshold <45 ng/dL). Daily interstitial fluid kinetics show smooth clearance without androgenic pulsatility or metabolic spikes.",
    },
  },
  {
    id: "cycle-transition",
    question: "When is my next predicted cycle transition?",
    category: "Cycle Forecast",
    summary: "Predicted in approximately 6 to 7 days based on 7-day velocity model.",
    answers: {
      endocrinologist:
        "Based on your continuous 7-day ISF hormone velocity model and current mid-luteal phase trajectory (cycle day 20-21), your next cycle transition (luteal-to-follicular / menses) is predicted in approximately 6 to 7 days. We anticipate progesterone velocity will begin its gentle physiological taper around day 26 of your cycle.",
      obgyn:
        "According to your continuous biomarker trend analysis in this luteal phase, your next menstrual cycle transition is projected in approximately 6 to 7 days. The predictive algorithm matches your current progesterone plateau and estradiol descent to historical cycle kinematics, showing a 94% confidence window.",
      default:
        "Based on your current 7-day hormone velocity model in this luteal phase, your next cycle transition is projected in approximately 6 to 7 days as progesterone completes its mid-luteal plateau and transitions toward the next phase.",
    },
  },
  {
    id: "hormone-fluctuations",
    question: "Are my hormone fluctuations normal?",
    category: "Physiology",
    summary: "Ultradian and circadian pulses in interstitial fluid are healthy and expected.",
    answers: {
      endocrinologist:
        "Yes, your continuous ISF fluctuations are completely physiological. Hormones are naturally secreted in ultradian and circadian pulses rather than static lines. The continuous microneedle sensor smooths out momentary spikes to capture true endocrine velocity, which remains within reassuring clinical bounds.",
      obgyn:
        "Yes, your micro-variations are entirely expected. Your patch telemetry shows healthy circadian pacing without disruptive peaks. Small shifts after meals or sleep are completely benign.",
      default:
        "Yes, your continuous hormone variations are completely normal. Endocrine glands release hormones in natural pulsatile waves, and your patch readings reflect healthy physiological dynamics.",
    },
  },
  {
    id: "lifestyle-support",
    question: "What lifestyle adjustments support my current cycle phase?",
    category: "Recommendations",
    summary: "Hydration, electrolyte balance, magnesium-rich foods, and 7–8 hours of rest.",
    answers: {
      endocrinologist:
        "During this mid-luteal phase when progesterone is dominant, metabolic rate slightly increases. Staying hydrated with electrolyte-rich fluids, maintaining magnesium and B6 intake, and prioritizing 7–8 hours of consistent sleep will help mitigate luteal fluid retention and mood fluctuations.",
      obgyn:
        "In this luteal plateau, focus on complex carbohydrates, gentle endurance or restorative exercise, and adequate hydration. If you experience premenstrual fatigue, light evening stretching and reducing high-sodium meals can noticeably reduce bloating.",
      default:
        "To support this luteal phase, prioritize adequate hydration, magnesium and vitamin B6 intake, consistent sleep schedules, and moderate physical activity.",
    },
  },
];

/**
 * Match a patient question against curated clinical FAQ items.
 */
export function matchClinicalFaq(
  patientMessage: string,
  consultant?: { full_name?: string; professional_type?: string } | null
): string | null {
  if (!patientMessage || typeof patientMessage !== "string") {
    return null;
  }

  const clean = patientMessage.toLowerCase().trim();

  // Helper to test if message matches an item
  const isMatch = (item: ClinicalFaqItem): boolean => {
    const qClean = item.question.toLowerCase().replace(/[\?\!\.\,]/g, "");
    const mClean = clean.replace(/[\?\!\.\,]/g, "");

    // Exact or near-exact match
    if (mClean === qClean || mClean.includes(qClean) || qClean.includes(mClean)) {
      return true;
    }

    // Specific intent matching
    if (item.id === "latest-readings") {
      return (
        (clean.includes("latest") || clean.includes("current") || clean.includes("how are my")) &&
        (clean.includes("reading") || clean.includes("hormone") || clean.includes("levels"))
      );
    }

    if (item.id === "progesterone-indication") {
      return (
        clean.includes("progesterone") &&
        (clean.includes("indicate") || clean.includes("mean") || clean.includes("level") || clean.includes("show"))
      );
    }

    if (item.id === "androgen-pattern") {
      return (
        clean.includes("androgen") &&
        (clean.includes("pattern") || clean.includes("explain") || clean.includes("testosterone") || clean.includes("level"))
      );
    }

    if (item.id === "cycle-transition") {
      return (
        (clean.includes("cycle transition") || clean.includes("next transition") || clean.includes("predicted cycle") || clean.includes("next period") || clean.includes("when is my next")) &&
        (clean.includes("cycle") || clean.includes("transition") || clean.includes("period"))
      );
    }

    if (item.id === "hormone-fluctuations") {
      return (
        clean.includes("fluctuation") &&
        (clean.includes("normal") || clean.includes("expected") || clean.includes("hormone"))
      );
    }

    if (item.id === "lifestyle-support") {
      return (
        (clean.includes("lifestyle") || clean.includes("support") || clean.includes("recommendation") || clean.includes("diet")) &&
        (clean.includes("phase") || clean.includes("cycle") || clean.includes("current"))
      );
    }

    return false;
  };

  const matched = CLINICAL_FAQ_ITEMS.find(isMatch);
  if (!matched) {
    return null;
  }

  const type = consultant?.professional_type?.toLowerCase() || "";
  if (type.includes("endocrinologist")) {
    return matched.answers.endocrinologist;
  }
  if (type.includes("gynecologist") || type.includes("ob/gyn") || type.includes("obstetrician")) {
    return matched.answers.obgyn;
  }

  return matched.answers.default || matched.answers.endocrinologist;
}
