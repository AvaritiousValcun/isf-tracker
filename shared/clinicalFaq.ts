export interface ClinicalFaqItem {
  id: string;
  question: string;
  category: string;
  summary: string;
  consultantType?: "endocrinologist" | "nutritionist" | "gynecologist";
  answers: {
    endocrinologist?: string;
    nutritionist?: string;
    obgyn?: string;
    gynecologist?: string;
    default: string;
  };
}

export const CLINICAL_FAQ_ITEMS: ClinicalFaqItem[] = [
  // =========================================================================
  // DR. BRIAN OCHIENG - ENDOCRINOLOGIST (6 QUESTIONS)
  // =========================================================================
  {
    id: "latest-readings",
    question: "How are my latest hormone readings tracking?",
    category: "Hormone Readings",
    summary: "Progesterone at 19.8 ng/mL, Free Testosterone steady at 38.2 ng/dL, normal luteal plateau.",
    consultantType: "endocrinologist",
    answers: {
      endocrinologist:
        "Your latest continuous ISF readings show Progesterone at 19.8 ng/mL and Free Testosterone steady at 38.2 ng/dL. These concentrations confirm robust post-ovulatory luteal stability within ideal physiological reference ranges (progesterone 5–25 ng/mL; free testosterone within normal safety margins). Your transdermal patch is capturing continuous dermal interstitial flux accurately with zero detected anomalous spikes.",
      obgyn:
        "Your current dermal hormone telemetry shows healthy secretory luteal parameters: Progesterone is 19.8 ng/mL, confirming effective ovulatory corpus luteum function, and Free Testosterone levels remain well controlled at 38.2 ng/dL. Uterine lining support is optimal, and no hyperandrogenic surges or erratic fluctuations are present in your continuous stream.",
      gynecologist:
        "As your Gynecologist, I am continuously tracking your ISF telemetry: your Progesterone is holding strong at 19.8 ng/mL, and your Free Testosterone is balanced at 38.2 ng/dL. These values confirm healthy secretory endometrial support and strong luteal vascularity. Your hormone rhythm is stable with zero abnormal shifts or hyperandrogenic surges.",
      nutritionist:
        "Your latest continuous ISF telemetry reflects solid metabolic and endocrine stability: Progesterone sits at 19.8 ng/mL and Free Testosterone at 38.2 ng/dL. Your glycemic velocity and hormonal balance indicate that your nutritional substrate is adequately supporting your luteal metabolic demands.",
      default:
        "Your latest continuous ISF readings show Progesterone at 19.8 ng/mL and Free Testosterone at 38.2 ng/dL. Both biomarkers sit comfortably within expected mid-luteal physiological boundaries, indicating stable endocrine velocity and optimal patch diffusion.",
    },
  },
  {
    id: "progesterone-indication",
    question: "What do my progesterone levels indicate?",
    category: "Progesterone",
    summary: "Confirms mid-luteal ovulatory phase with robust corpus luteum support.",
    consultantType: "endocrinologist",
    answers: {
      endocrinologist:
        "Your progesterone reading of 19.8 ng/mL (averaging 18.2 ng/mL with a healthy luteal curve) indicates that successful ovulation occurred and you are currently in the mid-luteal secretory phase. In a normal ovulatory cycle, mid-luteal progesterone ranges between 5.0 and 25.0 ng/mL to maintain endometrial integrity and support thermogenic metabolic balance. The steady 24-hour plateau confirms healthy corpus luteum vascularization.",
      obgyn:
        "Your progesterone levels indicate strong ovulatory activity and adequate luteal phase support, averaging 18.2 ng/mL along a reassuring luteal curve. Because progesterone is sustaining near ~20 ng/mL without premature cliff drops, your endometrial lining is stable. Mild breast tenderness or slight temperature increases at this level are completely normal physiological responses to healthy progesterone.",
      gynecologist:
        "From a gynecological perspective, your 19.8 ng/mL progesterone reading (averaging 18.2 ng/mL across your luteal curve) confirms successful ovulation and mid-luteal secretory maturity. Progesterone stabilizes the uterine lining and prevents early spotting. Sensations like slight breast fullness or temperature rise at this concentration are healthy physiologic markers of robust luteal adequacy.",
      default:
        "Your progesterone reading of 19.8 ng/mL (averaging 18.2 ng/mL with a healthy luteal curve) confirms ovulatory confirmation and mid-luteal secretory stability. This level adequately supports endometrial maturation with no signs of premature luteal insufficiency.",
    },
  },
  {
    id: "androgen-pattern",
    question: "Can you explain my free testosterone pattern?",
    category: "Free Testosterone",
    summary: "Controlled at 38.2 ng/dL with no hyperandrogenic pulses or PCOS risk surges.",
    consultantType: "endocrinologist",
    answers: {
      endocrinologist:
        "Your continuous free testosterone pattern is currently holding stable at 38.2 ng/dL, comfortably below the clinical threshold of 45 ng/dL. Unlike in hyperandrogenic conditions such as classical PCOS, where androgen pulsatility shows elevated baseline surges, your continuous ISF profile exhibits minimal diurnal variance and smooth clearance, signaling balanced ovarian and adrenal enzymatic activity.",
      obgyn:
        "Your free testosterone pattern shows a stable, non-escalating baseline well within asymptomatic female physiological limits. We monitor this continuously through the patch to check for early micro-surges that could cause acne, hirsutism, or anovulatory follicular arrest. Your telemetry confirms clean clearance with no hyperandrogenic risks flagged.",
      gynecologist:
        "Your continuous free testosterone pattern is well controlled at 38.2 ng/dL, comfortably below the 45 ng/dL threshold. In gynecology, we evaluate this to rule out follicular arrest, hyperandrogenism, or ovulatory suppression. Your steady baseline confirms smooth ovarian clearing and balanced androgens.",
      default:
        "Your continuous free testosterone pattern is steady at 38.2 ng/dL (normal threshold <45 ng/dL). Daily interstitial fluid kinetics show smooth clearance without androgenic pulsatility or metabolic spikes.",
    },
  },
  {
    id: "lifestyle-support",
    question: "What lifestyle adjustments support my current cycle phase?",
    category: "Endocrine Lifestyle",
    summary: "Hydration, electrolyte balance, magnesium-rich foods, and 7–8 hours of rest.",
    consultantType: "endocrinologist",
    answers: {
      endocrinologist:
        "During this mid-luteal phase when progesterone is dominant, metabolic rate slightly increases. Staying hydrated with electrolyte-rich fluids, maintaining magnesium and B6 intake, and prioritizing 7–8 hours of consistent sleep will help mitigate luteal fluid retention and mood fluctuations.",
      obgyn:
        "In this luteal plateau, focus on complex carbohydrates, gentle endurance or restorative exercise, and adequate hydration. If you experience premenstrual fatigue, light evening stretching and reducing high-sodium meals can noticeably reduce bloating.",
      gynecologist:
        "In this mid-luteal plateau, focus on restorative pelvic health: gentle walking or pelvic floor stretching, adequate magnesium intake to ease cramping, balanced complex meals, and 7–8 hours of uninterrupted rest to support natural luteal thermoregulation.",
      default:
        "To support this luteal phase, prioritize adequate hydration, magnesium and vitamin B6 intake, consistent sleep schedules, and moderate physical activity.",
    },
  },
  {
    id: "endo-ratio-meaning",
    question: "What does my progesterone-to-testosterone ratio mean?",
    category: "Hormone Ratios",
    summary: "Optimal ratio indicating robust luteal dominance over circulating free androgens.",
    consultantType: "endocrinologist",
    answers: {
      endocrinologist:
        "Your continuous free testosterone-to-progesterone ratio is approximately 1.9, reflecting strong luteal dominance. In a healthy ovulatory cycle, high progesterone buffers target androgen receptors. When this ratio inverts due to insufficient progesterone or elevated androgens, it can trigger anovulatory symptoms or PMOS/PCOS risk markers. Your current ratio confirms balanced ovarian steroidogenesis.",
      default:
        "Your continuous progesterone-to-testosterone ratio reflects strong luteal dominance. Adequate progesterone counterbalances circulating free androgens, confirming normal ovulatory steroidogenesis without hyperandrogenic dominance.",
    },
  },
  {
    id: "endo-diurnal-fluctuations",
    question: "Why do my hormone levels fluctuate between morning and evening?",
    category: "Circadian Kinetics",
    summary: "Normal circadian adrenal rhythm and episodic corpus luteum pulses.",
    consultantType: "endocrinologist",
    answers: {
      endocrinologist:
        "Steroid hormones naturally exhibit diurnal circadian variations. Free testosterone typically peaks in the early morning hours alongside cortisol, while progesterone displays pulsatile secretion from the corpus luteum throughout the day. The ISF Tracker's moving average algorithm smooths these benign physiological pulses so you see true baseline velocity rather than temporary noise.",
      default:
        "Steroid hormones naturally follow diurnal circadian rhythms, with androgens peaking earlier in the day. The continuous patch algorithm normalizes these benign pulses to display your true physiological trajectory.",
    },
  },

  // =========================================================================
  // DR. SARAH CHEN - CLINICAL NUTRITIONIST (6 QUESTIONS)
  // =========================================================================
  {
    id: "chen-luteal-foods",
    question: "What foods best support my progesterone during this luteal phase?",
    category: "Luteal Nutrition",
    summary: "Magnesium-rich greens, pumpkin seeds, healthy fats, and complex carbohydrates.",
    consultantType: "nutritionist",
    answers: {
      nutritionist:
        "To support progesterone production and corpus luteum longevity, prioritize magnesium-rich foods like dark leafy greens, pumpkin seeds, and dark chocolate (>70%). Incorporate healthy fats from avocados, extra virgin olive oil, and wild-caught salmon to provide the cholesterol building blocks for steroidogenesis, paired with sweet potatoes and quinoa to support your elevated basal metabolic rate.",
      default:
        "During the luteal phase, prioritize foods rich in magnesium, vitamin B6, and omega-3 fatty acids like leafy greens, seeds, salmon, and complex carbs to provide the energetic substrate for progesterone synthesis.",
    },
  },
  {
    id: "chen-diet-testosterone",
    question: "How does my diet impact my continuous free testosterone levels?",
    category: "Glycemic & Androgens",
    summary: "High-glycemic spikes trigger insulin surges that stimulate excess ovarian androgen release.",
    consultantType: "nutritionist",
    answers: {
      nutritionist:
        "Diet directly modulates free testosterone through insulin dynamics. High-glycemic meals cause rapid insulin spikes, which stimulate ovarian theca cells to produce excess androgens while lowering sex hormone-binding globulin (SHBG). Eating fiber-rich whole foods, pairing carbs with protein, and incorporating unrefined grains keeps your insulin flat and your free testosterone in its healthy 38 ng/dL plateau.",
      default:
        "Diet impacts androgens primarily through insulin. Avoiding high-glycemic spikes and eating balanced protein and fiber maintains steady insulin levels, preventing compensatory surges in ovarian free testosterone.",
    },
  },
  {
    id: "chen-bloating-reduction",
    question: "Can certain foods reduce luteal water retention and bloating?",
    category: "Fluid Balance",
    summary: "Potassium-rich foods, dandelion tea, and limiting excess sodium.",
    consultantType: "nutritionist",
    answers: {
      nutritionist:
        "Luteal bloating occurs when progesterone and aldosterone alter fluid homeostasis. You can dramatically improve fluid balance by increasing potassium-rich foods (coconut water, bananas, spinach, cucumbers) to balance cellular sodium. Drinking warm dandelion leaf or ginger tea acts as a gentle natural diuretic, and avoiding ultra-processed salty snacks prevents fluid pooling in tissues.",
      default:
        "To minimize luteal fluid retention, focus on potassium-rich foods like bananas and greens, drink plenty of water, and reduce processed sodium intake to prevent aldosterone-mediated extracellular water retention.",
    },
  },
  {
    id: "chen-insulin-sensitivity",
    question: "What should I eat to improve my insulin sensitivity and metabolic score?",
    category: "Metabolic Health",
    summary: "Fiber-first meal sequencing, apple cider vinegar, and healthy fats.",
    consultantType: "nutritionist",
    answers: {
      nutritionist:
        "To maximize insulin sensitivity, practice food sequencing: eat your vegetables and fiber first, followed by protein and fats, leaving complex starches for last. This slows gastric emptying and reduces glucose velocity by up to 35%. Adding a tablespoon of raw apple cider vinegar in water before heavy meals and taking a brisk 10-minute walk post-meal also accelerates muscle glucose uptake.",
      default:
        "Improving insulin sensitivity involves eating fiber and vegetables before carbohydrates, incorporating cinnamon and healthy fats, and engaging in light walking after meals to blunt glycemic velocity.",
    },
  },
  {
    id: "chen-electrolytes-vitamins",
    question: "Are there specific vitamins or electrolytes I should prioritize right now?",
    category: "Micronutrients",
    summary: "Magnesium glycinate, Vitamin B6, Zinc, and Inositol.",
    consultantType: "nutritionist",
    answers: {
      nutritionist:
        "For this cycle phase, I recommend prioritizing Magnesium Glycinate (300–400 mg at bedtime to calm the nervous system and ease smooth muscle tension), Vitamin B6 (50–100 mg for progesterone receptor sensitivity and dopamine support), and Zinc (15–30 mg to support ovarian tissue repair and cellular hormone signaling).",
      default:
        "Key micronutrients for cycle support include magnesium glycinate for muscle relaxation, vitamin B6 for neurotransmitter and luteal support, and zinc for hormone enzyme synthesis.",
    },
  },
  {
    id: "chen-sugar-cravings",
    question: "Why do I experience intense sugar cravings in the second half of my cycle?",
    category: "Craving Management",
    summary: "Progesterone increases caloric burn by 100–300 kcal/day while serotonin dips.",
    consultantType: "nutritionist",
    answers: {
      nutritionist:
        "Luteal sugar cravings are biological, not a lack of willpower! Progesterone increases your resting metabolic rate by 100 to 300 calories per day, while brain serotonin levels drop slightly before menstruation. Your body craves quick glucose to rebuild serotonin. Counteract this by eating nutrient-dense complex carbs (berries, oats, roasted sweet potatoes) and eating enough protein (25–30g per meal) so your blood sugar stays stable.",
      default:
        "Premenstrual sugar cravings stem from an increased basal metabolic rate during progesterone dominance alongside transient dips in serotonin. Eating complex carbohydrates and sufficient protein prevents sharp blood sugar drops.",
    },
  },

  // =========================================================================
  // DR. GRACE WANJIKU - GYNECOLOGIST (6 QUESTIONS)
  // =========================================================================
  {
    id: "grace-ovulation-timing",
    question: "What do my progesterone readings reveal about my ovulation timing?",
    category: "Ovulation Timing",
    summary: "A sustained progesterone rise above 5 ng/mL to 19.8 ng/mL confirms ovulation occurred ~5-7 days ago.",
    consultantType: "gynecologist",
    answers: {
      gynecologist:
        "Your continuous ISF telemetry reveals a clear biphasic shift: your progesterone climbed from baseline (<1.5 ng/mL) into a sustained peak of 19.8 ng/mL. In clinical gynecology, a sustained reading above 5.0 ng/mL across several consecutive days is the gold standard confirmation that a dominant follicle successfully ruptured, releasing an oocyte and forming a functional corpus luteum approximately 5 to 7 days ago.",
      default:
        "Your sustained progesterone elevation above 5 ng/mL up to 19.8 ng/mL definitively confirms that successful ovulation occurred and you are currently in the mid-luteal secretory window.",
    },
  },
  {
    id: "grace-pcos-progression",
    question: "How does the ISF patch detect PMOS or PCOS risk progression?",
    category: "PCOS & PMOS Risk",
    summary: "Analyzes continuous free androgen pulsatility, luteal duration, and hormone kinetic slopes.",
    consultantType: "gynecologist",
    answers: {
      gynecologist:
        "The ISF Tracker's predictive engine continuously models your androgen-to-progesterone velocity. In Polycystic Ovary Syndrome (PCOS) and Post-Menarche Ovarian Syndrome (PMOS), we typically observe elevated androgen spikes without a corresponding progesterone surge, indicating anovulatory follicular arrest. Your current telemetry displays normal ovulatory progesterone and stable free testosterone (38.2 ng/dL), confirming low acute progression risk.",
      default:
        "The system monitors the ratio of free testosterone to progesterone over time. Stable progesterone alongside controlled androgens signals low risk of anovulatory follicular arrest or PCOS development.",
    },
  },
  {
    id: "grace-pelvic-cramping",
    question: "What causes my pelvic cramping and lower abdominal sensations?",
    category: "Pelvic Health",
    summary: "Local prostaglandin synthesis and normal luteal uterine vascularization.",
    consultantType: "gynecologist",
    answers: {
      gynecologist:
        "Mid-to-late luteal pelvic sensations are usually caused by local prostaglandin F2-alpha synthesis within the endometrium as well as increased pelvic vascular flow. Mild dull aches or twinges are a natural physiologic response to secretory uterine thickening. However, if you ever experience sudden, severe unilateral stabbing pain, high fever, or atypical heavy bleeding, that is a red flag requiring immediate in-person gynecological evaluation and urgent medical evaluation.",
      endocrinologist:
        "Pelvic twinges during the luteal phase commonly correlate with uterine prostaglandin activity and vascular congestion. Mild sensations are physiologic, but sudden sharp unilateral pain or severe bleeding requires immediate medical attention and urgent medical evaluation.",
      default:
        "Pelvic twinges during the luteal phase commonly correlate with uterine prostaglandin activity and vascular congestion. Mild sensations are physiologic, but sudden sharp unilateral pain or severe bleeding requires immediate medical attention and urgent medical evaluation.",
    },
  },
  {
    id: "grace-period-forecasting",
    question: "When is my next menstrual period expected based on cycle telemetry?",
    category: "Cycle Forecasting",
    summary: "Projected in approximately 6 to 7 days upon physiological corpus luteum regression.",
    consultantType: "gynecologist",
    answers: {
      gynecologist:
        "Based on your 7-day ISF kinetic trajectory, your corpus luteum is currently at peak secretory plateau (day 20-21 equivalent). Without fertilization, the corpus luteum will naturally regress over the next 4 to 5 days, causing progesterone to descend below the 3.0 ng/mL threshold. This triggers the onset of your menstrual flow in approximately 6 to 7 days. Tracking this daily ensures you are never surprised by your cycle.",
      default:
        "Based on your continuous progesterone curve, your luteal plateau will begin its natural decline in 4-5 days, with your next menstrual period anticipated in approximately 6 to 7 days.",
    },
  },
  {
    id: "grace-luteal-deficiency",
    question: "Can continuous hormone tracking identify a luteal phase deficiency?",
    category: "Luteal Adequacy",
    summary: "Measures continuous plateau duration (>10 days) and peak threshold (>10 ng/mL).",
    consultantType: "gynecologist",
    answers: {
      gynecologist:
        "Yes, continuous ISF tracking is uniquely equipped to diagnose Luteal Phase Deficiency (LPD). Traditional single blood tests miss intermittent drops, but our patch tracks both luteal duration (which should be at least 11 to 14 days) and progesterone amplitude (which should comfortably exceed 10 ng/mL). Your sustained 19.8 ng/mL plateau confirms robust luteal adequacy and healthy endometrial receptivity.",
      default:
        "Continuous ISF tracking verifies whether progesterone stays elevated above 10 ng/mL for at least 10–12 days, effectively ruling out luteal phase deficiency without multiple venous blood draws.",
    },
  },
  {
    id: "grace-cervical-discharge",
    question: "What are normal cervical and discharge changes during this phase?",
    category: "Reproductive Physiology",
    summary: "Progesterone causes thick, creamy, opaque mucus to seal the cervical canal.",
    consultantType: "gynecologist",
    answers: {
      gynecologist:
        "Under the influence of high luteal progesterone, cervical mucus shifts from the clear, stretchy, slippery 'egg-white' texture seen during ovulation to a thicker, creamier, and more opaque consistency. This is a protective mechanism that seals the cervical os. It is completely normal as long as there is no foul odor, intense itching, cottage-cheese texture, or burning sensations, which would suggest an infection.",
      default:
        "In the luteal phase, elevated progesterone thickens cervical secretions into a creamy, opaque barrier. This is a healthy physiological response, provided there is no itching, odor, or discomfort.",
    },
  },
];

/**
 * Returns the curated 6 FAQ items specific to the selected consultant.
 */
export function getConsultantFaqItems(
  consultant?: { id?: string; professional_type?: string } | null
): ClinicalFaqItem[] {
  if (!consultant) return CLINICAL_FAQ_ITEMS.slice(0, 6);
  const type = (consultant.professional_type || "").toLowerCase();

  if (type.includes("nutritionist") || type.includes("diet")) {
    return CLINICAL_FAQ_ITEMS.filter((item) => item.consultantType === "nutritionist");
  }
  if (type.includes("gynecologist") || type.includes("ob/gyn") || type.includes("obstetrician")) {
    return CLINICAL_FAQ_ITEMS.filter((item) => item.consultantType === "gynecologist");
  }
  if (type.includes("endocrinologist") || type.includes("hormone")) {
    return CLINICAL_FAQ_ITEMS.filter((item) => item.consultantType === "endocrinologist");
  }

  return CLINICAL_FAQ_ITEMS.slice(0, 6);
}

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
        (clean.includes("androgen") || clean.includes("testosterone")) &&
        (clean.includes("pattern") || clean.includes("explain") || clean.includes("fluctuation"))
      );
    }

    if (item.id === "lifestyle-support") {
      return (
        (clean.includes("lifestyle") || clean.includes("recommendation")) &&
        (clean.includes("phase") || clean.includes("cycle") || clean.includes("current"))
      );
    }

    if (item.id === "endo-ratio-meaning") {
      return (
        clean.includes("ratio") &&
        (clean.includes("testosterone") || clean.includes("progesterone") || clean.includes("mean"))
      );
    }

    if (item.id === "endo-diurnal-fluctuations") {
      return (
        (clean.includes("fluctuat") || clean.includes("diurnal") || clean.includes("morning") || clean.includes("night")) &&
        clean.includes("hormone")
      );
    }

    if (item.id === "chen-luteal-foods") {
      return (
        (clean.includes("food") || clean.includes("eat")) &&
        (clean.includes("progesterone") || clean.includes("luteal"))
      );
    }

    if (item.id === "chen-diet-testosterone") {
      return (
        clean.includes("diet") &&
        (clean.includes("testosterone") || clean.includes("androgen") || clean.includes("impact"))
      );
    }

    if (item.id === "chen-bloating-reduction") {
      return (
        (clean.includes("bloat") || clean.includes("water retention")) &&
        (clean.includes("food") || clean.includes("reduce") || clean.includes("eat"))
      );
    }

    if (item.id === "chen-insulin-sensitivity") {
      return (
        clean.includes("insulin") &&
        (clean.includes("sensitiv") || clean.includes("score") || clean.includes("eat") || clean.includes("metabolic"))
      );
    }

    if (item.id === "chen-electrolytes-vitamins") {
      return (
        (clean.includes("vitamin") || clean.includes("electrolyte") || clean.includes("supplement")) &&
        (clean.includes("prioritize") || clean.includes("take") || clean.includes("recommend"))
      );
    }

    if (item.id === "chen-sugar-cravings") {
      return (
        (clean.includes("sugar") || clean.includes("craving") || clean.includes("sweet")) &&
        (clean.includes("period") || clean.includes("cycle") || clean.includes("luteal") || clean.includes("why"))
      );
    }

    if (item.id === "grace-ovulation-timing") {
      return (
        clean.includes("ovulation") &&
        (clean.includes("timing") || clean.includes("progesterone") || clean.includes("reveal") || clean.includes("when"))
      );
    }

    if (item.id === "grace-pcos-progression") {
      return (
        (clean.includes("pcos") || clean.includes("pmos")) &&
        (clean.includes("detect") || clean.includes("progression") || clean.includes("patch") || clean.includes("risk"))
      );
    }

    if (item.id === "grace-pelvic-cramping") {
      if (clean.includes("severe") || clean.includes("emergency") || clean.includes("urgent")) {
        return false;
      }
      return (
        (clean.includes("pelvic") || clean.includes("cramp") || clean.includes("abdominal")) &&
        (clean.includes("cause") || clean.includes("sensation") || clean.includes("why do i have"))
      );
    }

    if (item.id === "grace-period-forecasting") {
      return (
        (clean.includes("next period") || clean.includes("menstrual period") || clean.includes("when is my period")) &&
        (clean.includes("expect") || clean.includes("due") || clean.includes("telemetry") || clean.includes("when"))
      );
    }

    if (item.id === "grace-luteal-deficiency") {
      return (
        (clean.includes("luteal phase defect") || clean.includes("luteal phase deficiency") || clean.includes("lpd")) &&
        (clean.includes("identify") || clean.includes("track") || clean.includes("detect"))
      );
    }

    if (item.id === "grace-cervical-discharge") {
      return (
        (clean.includes("cervical") || clean.includes("discharge") || clean.includes("mucus")) &&
        (clean.includes("normal") || clean.includes("phase") || clean.includes("change"))
      );
    }

    return false;
  };

  const matched = CLINICAL_FAQ_ITEMS.find(isMatch);
  if (!matched) {
    return null;
  }

  const type = consultant?.professional_type?.toLowerCase() || "";
  if (type.includes("endocrinologist") && matched.answers.endocrinologist) {
    return matched.answers.endocrinologist;
  }
  if (type.includes("nutritionist") && matched.answers.nutritionist) {
    return matched.answers.nutritionist;
  }
  if (type.includes("gynecologist") && (matched.answers.gynecologist || matched.answers.obgyn)) {
    return matched.answers.gynecologist || matched.answers.obgyn!;
  }
  if ((type.includes("ob/gyn") || type.includes("obstetrician")) && matched.answers.obgyn) {
    return matched.answers.obgyn;
  }

  return matched.answers.default || matched.answers.endocrinologist || Object.values(matched.answers)[0]!;
}
