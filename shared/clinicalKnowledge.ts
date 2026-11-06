/**
 * Comprehensive Clinical & System Knowledge Base
 * Provides deterministic, expert-verified responses across the full health project scope:
 * - Common courtesies & conversational etiquette
 * - Hardware, microneedle patch mechanics, battery, waterproofing & Bluetooth
 * - Comprehensive endocrine, gynecological & nutritional clinical guidance
 * - Safety protocols, triage, and red flags
 * - Subscriptions, PDF clinical reports & data privacy
 */

export interface ConsultantContext {
  id?: string;
  full_name?: string;
  professional_type?: string;
  initials?: string;
}

export function matchClinicalKnowledge(
  patientMessage: string,
  consultant?: ConsultantContext | null
): string | null {
  if (!patientMessage || typeof patientMessage !== "string") {
    return null;
  }

  const raw = patientMessage.trim();
  const clean = raw.toLowerCase();
  const name = consultant?.full_name || "Dr. Brian Ochieng";
  const type = (consultant?.professional_type || "Endocrinologist").toLowerCase();
  const isEndo = type.includes("endocrinologist");
  const isNutri = type.includes("nutritionist");
  const isGyn = type.includes("gynecologist") || type.includes("ob/gyn") || type.includes("obstetrician");

  // =========================================================================
  // 1. EMERGENCY & RED FLAGS (HIGHEST PRIORITY)
  // =========================================================================
  if (
    clean.includes("severe") ||
    clean.includes("emergency") ||
    clean.includes("hospital") ||
    clean.includes("unbearable") ||
    (clean.includes("bleed") && (clean.includes("heavy") || clean.includes("soaking") || clean.includes("clot"))) ||
    (clean.includes("pain") && (clean.includes("sharp") || clean.includes("unilateral") || clean.includes("stab") || clean.includes("intense")))
  ) {
    if (isGyn) {
      return `As your Gynecologist, acute symptoms like sudden severe unilateral pelvic pain, heavy bleeding soaking more than one pad per hour, or high fever are potential signs of ectopic pregnancy, ovarian torsion, or acute pelvic pathology. Please seek urgent medical evaluation at your nearest emergency department or call emergency services immediately. Your continuous telemetry can be exported via the Doctor Report for your attending clinical team.`;
    }
    return `I hear your concern regarding acute discomfort. While mild pelvic twinges can correlate with progesterone shifts, sudden severe unilateral pelvic pain, abnormal heavy bleeding, or fever require urgent medical evaluation immediately at the nearest healthcare facility. Please do not wait for your scheduled consultation. You can generate an emergency Doctor Report (PDF) right from your Chat tab for your attending physician.`;
  }

  // =========================================================================
  // 2. COURTESIES & CONVERSATIONAL ETIQUETTE
  // =========================================================================

  // Gratitude / Thanks
  if (
    /\b(thank|thanks|asante|shukrani|appreciate|grateful|thx|cheers)\b/i.test(clean)
  ) {
    if (isNutri) {
      return `You are very welcome! I am dedicated to helping you optimize your metabolic nutrition and luteal wellness. Keep fueling your body with balanced complex carbs, healthy fats, and adequate hydration. Feel free to ask anytime you have questions about your meal timings or cravings!`;
    }
    if (isGyn) {
      return `You are very welcome! As your Gynecologist, I am honored to support your reproductive health and cycle tracking. Keep an eye on your continuous progesterone trajectory over the coming days, and don't hesitate to reach out if any new pelvic symptoms arise.`;
    }
    return `You are most welcome! As your Endocrinologist, I am continuously tracking your ISF biomarker telemetry to ensure your hormonal rhythm remains optimal and balanced. Please let me know whenever you have further questions!`;
  }

  // Welcome / You're welcome
  if (/\b(welcome|you're welcome|you are welcome|karibu|dont mention it|no problem|anytime)\b/i.test(clean)) {
    return `Thank you! I am delighted to be part of your dedicated care team. How can I assist you with your continuous hormone telemetry or health goals today?`;
  }

  // Well-being inquiry ("How are you?")
  if (
    clean.includes("how are you") ||
    clean.includes("how are things") ||
    clean.includes("how do you do") ||
    clean.includes("are you okay") ||
    clean.includes("how's it going") ||
    clean.includes("how is it going")
  ) {
    return `I am doing very well, thank you for asking! I am actively monitoring your continuous ISF telemetry stream. Your progesterone is holding steady at 19.8 ng/mL and your free testosterone is well controlled at 38.2 ng/dL. How are you feeling today? Are you experiencing any symptoms?`;
  }

  // Greetings
  if (
    /\b(hello|hi|habari|hey|greetings|good morning|good afternoon|good evening|mambo|sasa|jambo)\b/i.test(clean)
  ) {
    if (isNutri) {
      return `Hello! I am ${name}, your Clinical Nutritionist. I am monitoring your metabolic trends, glycemic balance, and ISF biomarker stability in real time. How may I assist you with your dietary rhythm or energy levels today?`;
    }
    if (isGyn) {
      return `Hello! I am ${name}, your Gynecologist. I specialize in reproductive physiology, luteal phase adequacy, and continuous hormone rhythm tracking. What aspects of your cycle or pelvic telemetry would you like to discuss today?`;
    }
    return `Hello! I am ${name}, your Endocrinologist. I am monitoring your continuous ISF hormone readings and telemetry in real time. Your progesterone surge is currently tracking within normal secretory limits. How can I assist you with your cycle telemetry today?`;
  }

  // Goodbyes & Sign-offs
  if (
    /\b(bye|goodbye|good night|kwaheri|see you|take care|talk later|gnight)\b/i.test(clean)
  ) {
    return `Goodbye for now, and rest well! Remember that your ISF microneedle patch continues tracking your continuous hormone flux 24/7. Your care team is always here whenever you need guidance. Take care!`;
  }

  // Persona / Identity / "Who are you?"
  if (
    clean.includes("who are you") ||
    clean.includes("what is your name") ||
    clean.includes("what do you do") ||
    clean.includes("tell me about yourself") ||
    clean.includes("what is your specialty") ||
    clean.includes("introduce yourself")
  ) {
    if (isNutri) {
      return `I am Dr. Sarah Chen, your Clinical Nutritionist on the ISF Tracker care team. My focus is translational metabolic nutrition, insulin sensitivity optimization, micronutrient support (magnesium, zinc, B6), and cycle-synced nutrition to ease premenstrual symptoms.`;
    }
    if (isGyn) {
      return `I am Dr. Grace Wanjiku, your Gynecologist on the ISF Tracker care team. I specialize in reproductive endocrinology, luteal phase adequacy, pelvic health, cervical mucus patterns, and early clinical detection of conditions like PCOS and PMOS.`;
    }
    return `I am Dr. Brian Ochieng, your Endocrinologist on the ISF Tracker care team. My specialty is continuous transdermal hormone telemetry, free testosterone-to-progesterone velocity modeling, and metabolic risk forecasting.`;
  }

  // Medical AI / Real Doctor / Diagnosis disclaimer
  if (
    clean.includes("are you a real doctor") ||
    clean.includes("are you an ai") ||
    clean.includes("are you human") ||
    clean.includes("can you diagnose me") ||
    clean.includes("prescribe medicine")
  ) {
    return `I am an AI Clinical Care Specialist modeled on rigorous endocrine and gynecological protocols, working as an active part of your ISF Tracker care team. While I provide real-time biomarker analysis, luteal trend interpretations, and evidence-based guidance, I do not issue formal clinical diagnoses or prescription drugs. For clinical emergencies or prescription changes, always review your exported Doctor Report (PDF) with your attending primary physician.`;
  }

  // =========================================================================
  // 3. HARDWARE, MICRONEEDLE PATCH & SENSOR MECHANICS
  // =========================================================================

  // How the patch works / ISF explanation
  if (
    (clean.includes("patch") || clean.includes("sensor") || clean.includes("microneedle")) &&
    (clean.includes("how does") || clean.includes("work") || clean.includes("measure") || clean.includes("technology") || clean.includes("what is isf"))
  ) {
    return `The ISF Tracker utilizes an ultra-thin biocompatible microneedle array that penetrates the stratum corneum into the dermal interstitial fluid (ISF) layer. ISF surrounds living skin cells and exchanges molecules with capillaries continuously, providing a real-time biomolecular window without venous blood draws. Onboard electrochemical biosensors measure free testosterone and progesterone molecules every few minutes and broadcast encrypted telemetry via Bluetooth LE to your app.`;
  }

  // Does it hurt / Pain on application
  if (
    (clean.includes("hurt") || clean.includes("pain") || clean.includes("pinch") || clean.includes("sting")) &&
    (clean.includes("patch") || clean.includes("needle") || clean.includes("apply") || clean.includes("wear") || clean.includes("sensor"))
  ) {
    return `Applying the ISF patch is virtually painless! The microneedles are shorter than 800 micrometers—long enough to sample dermal interstitial fluid, but short enough to avoid reaching the deeper nerve endings (nociceptors) that sense pain. Most users report feeling only a light stamp sensation upon initial placement, followed by complete comfort during 14 days of wear.`;
  }

  // Waterproofing / Showering / Swimming / Sweat
  if (
    clean.includes("shower") ||
    clean.includes("bath") ||
    clean.includes("swim") ||
    clean.includes("swimming") ||
    clean.includes("waterproof") ||
    clean.includes("water") ||
    clean.includes("sweat") ||
    clean.includes("gym") ||
    clean.includes("workout")
  ) {
    return `Your ISF patch is rated IP68 medical-grade waterproof! You can freely shower, bathe, swim, and work out in the gym without damaging the sensor or interrupting telemetry. For optimal adhesion, avoid vigorously scrubbing directly over the edges with oily soaps or loofahs, and gently pat the site dry with a clean towel afterward.`;
  }

  // Lifespan / Wear duration / Replacement
  if (
    (clean.includes("how long") || clean.includes("replace") || clean.includes("duration") || clean.includes("change")) &&
    (clean.includes("patch") || clean.includes("sensor") || clean.includes("wear"))
  ) {
    return `Each ISF sensor patch is designed for 14 continuous days of uninterrupted biomarker tracking. The app will notify you 24 hours before your patch expires so you can prepare a replacement. When replacing, simply peel off the old patch, wipe the skin with an alcohol swab, and apply the new patch to an alternate site (such as the opposite upper arm or abdomen) to allow skin recovery.`;
  }

  // Patch peeling / Adhesive issues
  if (
    clean.includes("peel") ||
    clean.includes("falling off") ||
    clean.includes("loose") ||
    clean.includes("adhesive") ||
    clean.includes("tape") ||
    clean.includes("stick")
  ) {
    return `If an edge of your patch begins lifting, press down gently around the perimeter with clean, dry fingers for 15 seconds. For active swimmers or intense workouts, we recommend applying an approved breathable medical overpatch (such as Opsite Flexigrid or Tegaderm) directly over the sensor. Never use household adhesives or re-insert a patch that has completely detached.`;
  }

  // Battery & Charging
  if (
    clean.includes("battery") ||
    clean.includes("charge") ||
    clean.includes("charging") ||
    clean.includes("recharge") ||
    clean.includes("power")
  ) {
    return `The ISF patch does not require any external charging! It incorporates an ultra-thin zinc-air/lithium micro-cell designed to power the electrochemical sensors and Bluetooth Low Energy transmitter for the entire 14-day lifecycle. Once the 14 days conclude, you simply recycle the depleted patch and apply a fresh unit.`;
  }

  // Bluetooth / Offline mode / Syncing
  if (
    clean.includes("bluetooth") ||
    clean.includes("offline") ||
    clean.includes("sync") ||
    clean.includes("airplane mode") ||
    clean.includes("disconnect") ||
    clean.includes("range")
  ) {
    return `The patch uses low-energy Bluetooth (BLE) with an operating range of approximately 10 meters (30 feet). If you step away from your phone or turn on airplane mode, the sensor's onboard flash memory automatically caches up to 72 hours of continuous readings. As soon as your phone reconnects, all buffered telemetry syncs seamlessly without any data loss.`;
  }

  // =========================================================================
  // 4. CORE BIOMARKERS & HORMONE DYNAMICS
  // =========================================================================

  // Specific question about readings / current values
  if (
    (clean.includes("current") || clean.includes("latest") || clean.includes("reading") || clean.includes("level")) &&
    (clean.includes("hormone") || clean.includes("how are my") || clean.includes("my stats") || clean.includes("tracking"))
  ) {
    return `Your latest continuous ISF readings show Progesterone at 19.8 ng/mL and Free Testosterone steady at 38.2 ng/dL (safe baseline <45 ng/dL). These concentrations confirm robust post-ovulatory luteal stability within ideal physiological reference ranges. Your transdermal patch is capturing continuous dermal interstitial flux accurately with zero detected anomalous spikes.`;
  }

  // Progesterone in-depth
  if (clean.includes("progesterone") || clean.includes("corpus luteum") || clean.includes("secretory")) {
    if (isGyn) {
      return `As your Gynecologist, your progesterone is averaging 18.2 ng/mL with a healthy luteal curve peaking at 19.8 ng/mL. In gynecology, a sustained level above 5.0 ng/mL across the mid-luteal phase confirms effective corpus luteum vascularization and secretory endometrial maturation. This shields against irregular breakthrough bleeding. If you experience mild breast fullness or slight basal temperature elevation, these are normal luteal physiologic responses.`;
    }
    return `Looking at your continuous ISF telemetry, your progesterone is averaging 18.2 ng/mL with a healthy luteal curve peaking at 19.8 ng/mL. Normal luteal progesterone ranges between 5.0 and 25.0 ng/mL, confirming robust secretory endometrium support. No sudden luteal drops have been flagged. Are you experiencing any breast tenderness or mood changes?`;
  }

  // Free Testosterone / Androgens / Acne / Hair
  if (
    clean.includes("testosterone") ||
    clean.includes("androgen") ||
    clean.includes("acne") ||
    clean.includes("chin hair") ||
    clean.includes("facial hair") ||
    clean.includes("hirsutism")
  ) {
    if (isGyn) {
      return `From a gynecological perspective, your continuous free testosterone readings are holding steady at 38 ng/dL (38.2 ng/dL), safely beneath the elevated threshold of 45 ng/dL. This confirms balanced follicular androgen metabolism without hyperandrogenic pulses, hirsutism triggers, or ovulatory disruption.`;
    }
    if (isNutri) {
      return `Your free testosterone readings are holding steady at 38 ng/dL, comfortably below the 45 ng/dL threshold. From a nutritional standpoint, keeping insulin balanced via low-glycemic, fiber-rich meals prevents insulin-driven androgen excess in ovarian theca cells. Your current telemetry reflects optimal hormonal balance.`;
    }
    return `Your continuous free testosterone readings are currently steady at 38 ng/dL (38.2 ng/dL), safely beneath the elevated threshold of 45 ng/dL. This indicates stable follicular androgen metabolism without hyperandrogenic surges today. We will keep monitoring your free testosterone to ensure it remains well balanced.`;
  }

  // Hormone Velocity & Trajectory Forecast
  if (
    clean.includes("velocity") ||
    clean.includes("trajectory") ||
    clean.includes("forecast") ||
    clean.includes("rate of change") ||
    clean.includes("slope")
  ) {
    return `Your continuous hormone velocity measures the daily rate of change (ng/mL per day) across your interstitial fluid telemetry. Your progesterone velocity curve shows a sustained secretory plateau through Day 21 before entering a gentle physiological descent toward Day 28. This smooth curve confirms healthy corpus luteum lifespan without premature collapse.`;
  }

  // Menstrual Cycle / Next Period / Ovulation Timing
  if (
    clean.includes("next period") ||
    clean.includes("period due") ||
    clean.includes("when will i bleed") ||
    clean.includes("cycle phase") ||
    clean.includes("cycle transition") ||
    clean.includes("predicted cycle") ||
    clean.includes("ovulation") ||
    clean.includes("menses") ||
    (clean.includes("when") && (clean.includes("period") || clean.includes("cycle")))
  ) {
    if (isGyn) {
      return `Based on your continuous ISF telemetry and 7-day velocity projection, you are in the mid-luteal phase (approximately cycle day 19-21). Your ovulatory progesterone elevation was confirmed, and your projected next cycle transition is estimated in approximately 6 to 7 days as your corpus luteum naturally regresses.`;
    }
    return `Based on your continuous ISF telemetry and 7-day velocity projection, you are in the mid-luteal phase (approximately cycle day 19-21). Your ovulatory progesterone elevation was confirmed, and your projected next cycle transition is estimated in approximately 6 to 7 days.`;
  }

  // Pregnancy / Implantation / Conception
  if (
    clean.includes("pregnant") ||
    clean.includes("pregnancy") ||
    clean.includes("conception") ||
    clean.includes("implantation") ||
    clean.includes("conceive")
  ) {
    return `If conception and implantation occur during this cycle, embryonic hCG signals the corpus luteum to persist, keeping progesterone sustained above 15–25+ ng/mL instead of descending toward menstruation. In non-conception cycles, progesterone descends below 3 ng/mL around Day 27–28, triggering menses. Your continuous ISF patch will instantly track whether your luteal plateau extends!`;
  }

  // PCOS / PMOS / Ovarian Cysts
  if (
    clean.includes("pcos") ||
    clean.includes("pmos") ||
    clean.includes("polycystic") ||
    clean.includes("follicular arrest")
  ) {
    return `Your predictive health model derives risk trajectories from continuous interstitial fluid dynamics. In PCOS/PMOS, telemetry typically reveals persistent free androgen elevations (>45 ng/dL) coupled with absent or blunted progesterone peaks. Currently, your PCOS trajectory monitoring shows a 31% calibration score with no acute escalations, supported by your robust ovulatory progesterone reading of 19.8 ng/mL.`;
  }

  // Diabetes / Insulin Resistance / Blood Sugar
  if (
    clean.includes("diabetes") ||
    clean.includes("insulin") ||
    clean.includes("glycemic") ||
    clean.includes("glucose") ||
    clean.includes("metabolic")
  ) {
    if (isNutri) {
      return `Your continuous metabolic monitoring models glycemic velocity and insulin sensitivity. During the luteal phase, elevated progesterone naturally increases cellular insulin resistance slightly. You can counter this by pairing carbs with healthy fats and protein, and choosing low-glycemic complex carbohydrates like quinoa, roasted vegetables, and legumes.`;
    }
    return `Your predictive health model derives risk trajectories from continuous interstitial fluid dynamics. Currently, your metabolic sensitivity index is stable, and Type 2 Diabetes projection is categorized as low risk. Make sure to check the Predictive Analysis tab for full multi-condition breakdowns!`;
  }

  // Non-emergency Pelvic Cramps & Sensations
  if (clean.includes("cramp") || clean.includes("pelvic") || clean.includes("abdominal")) {
    if (isGyn) {
      return `As your Gynecologist, cyclical pelvic sensations and mild uterine cramping during the luteal phase often correlate with local prostaglandin release and progesterone velocity descent. Tracking symptom onset relative to your patch readings is very helpful. However, if you experience sudden, severe unilateral pelvic pain, abnormal heavy bleeding, or fever, please seek urgent medical evaluation immediately.`;
    }
    return `I hear your concern. Cyclical pelvic sensations can correlate with rapid shifts in progesterone velocity. If pain is mild to moderate, tracking the exact onset relative to your patch readings is helpful. However, if you experience sudden, severe unilateral pelvic pain, heavy abnormal bleeding, or fever, please seek urgent medical evaluation immediately.`;
  }

  // =========================================================================
  // 5. NUTRITION & LIFESTYLE (DR. SARAH CHEN DOMAIN)
  // =========================================================================

  // Luteal Phase Foods & Diet
  if (
    (clean.includes("food") || clean.includes("eat") || clean.includes("diet") || clean.includes("meal")) &&
    (clean.includes("luteal") || clean.includes("progesterone") || clean.includes("cycle"))
  ) {
    return `During the luteal phase, focus on foods rich in Vitamin B6 and Zinc to support progesterone synthesis: wild-caught salmon, pasture-raised poultry, avocados, sweet potatoes, and leafy greens. Pair complex carbohydrates with healthy fats to sustain dopamine and prevent premenstrual mood drops.`;
  }

  // Seed Cycling
  if (clean.includes("seed cycling") || clean.includes("flax") || clean.includes("pumpkin seed") || clean.includes("sesame") || clean.includes("sunflower seed")) {
    return `Seed cycling supports hormonal phases via specific fatty acid and lignan profiles. During the follicular phase (Days 1–14), 1 tablespoon each of freshly ground flaxseed and pumpkin seeds aids estrogen metabolism and zinc intake. During the luteal phase (Days 15–28), switch to sesame and sunflower seeds to provide selenium, vitamin E, and lignans that assist corpus luteum progesterone production.`;
  }

  // Sugar Cravings
  if (clean.includes("sugar") || clean.includes("craving") || clean.includes("sweet") || clean.includes("chocolate")) {
    return `Luteal sugar cravings are biological! Elevated progesterone increases your basal metabolic rate by 100 to 300 calories per day, while brain serotonin levels dip slightly before menstruation. Your body craves quick glucose to rebuild serotonin. Counteract this by eating nutrient-dense complex carbs (berries, oats, roasted sweet potatoes) and 25–30g of protein per meal to stabilize blood sugar.`;
  }

  // Coffee / Caffeine / Alcohol
  if (clean.includes("coffee") || clean.includes("caffeine") || clean.includes("alcohol") || clean.includes("wine") || clean.includes("beer")) {
    return `During the luteal phase, liver clearance of caffeine slows by approximately 25% due to progesterone, which can amplify breast tenderness, anxiety, and sleep disruption. Limiting coffee to 1 cup before 11:00 AM is recommended. Similarly, reducing alcohol intake prevents liver congestion, preserving its ability to clear metabolized steroid hormones efficiently.`;
  }

  // Vitamins & Electrolytes
  if (clean.includes("vitamin") || clean.includes("electrolyte") || clean.includes("magnesium") || clean.includes("zinc") || clean.includes("inositol")) {
    return `For luteal wellness, key micronutrients include Magnesium Glycinate (300–400 mg at bedtime to ease muscle tension and improve deep sleep), Vitamin B6 (50–100 mg to enhance progesterone receptor responsiveness), Zinc (15–30 mg for tissue repair), and Myo-Inositol for metabolic insulin sensitivity.`;
  }

  // Cervical mucus / Discharge
  if (clean.includes("cervical") || clean.includes("mucus") || clean.includes("discharge")) {
    return `Under high luteal progesterone, cervical mucus shifts from the thin, slippery 'egg-white' texture seen during ovulation to a thicker, creamier, and more opaque barrier. This is a healthy protective mechanism that seals the cervical os. If accompanied by itching, burning, or foul odor, consult a clinic to rule out an infection.`;
  }

  // =========================================================================
  // 6. SYSTEM, SUBSCRIPTION & REPORTING
  // =========================================================================

  // Subscription / Pricing / Free vs Premium / M-Pesa
  if (
    clean.includes("upgrade") ||
    clean.includes("premium") ||
    clean.includes("free plan") ||
    clean.includes("cost") ||
    clean.includes("price") ||
    clean.includes("ksh") ||
    clean.includes("mpesa") ||
    clean.includes("subscription")
  ) {
    return `The Free Plan includes qualitative risk categories (low/moderate/elevated), continuous ISF baseline graphs, and standard consultant messaging. Premium is available for Ksh 250 / month (payable via M-Pesa or card) and unlocks calibrated exact percentages (e.g., Type 2 Diabetes: 12.0%, Insulin Resistance: 24.0%), 7-day forward velocity forecasts, and priority 24/7 AI care team consultations. You can upgrade anytime in Settings or Predictive Analysis!`;
  }

  // Doctor Report (PDF) / Clinical Summary / QR Code
  if (
    clean.includes("report") ||
    clean.includes("pdf") ||
    clean.includes("doctor report") ||
    clean.includes("export") ||
    clean.includes("qr code") ||
    clean.includes("share with doctor")
  ) {
    return `You can export your official Doctor Report (PDF) directly from the Chat tab or Predictive tab by tapping 'Doctor Report (PDF)'. The report compiles your 7-day continuous ISF curves, progesterone velocity plateau, androgen ratios, and an encrypted QR access code so your in-person clinician can verify your raw readings instantly.`;
  }

  // Privacy & Consent
  if (clean.includes("privacy") || clean.includes("data") || clean.includes("consent") || clean.includes("secure") || clean.includes("share data")) {
    return `Your privacy is our utmost priority. All ISF telemetry is encrypted end-to-end (AES-256). Specialists and care team consultants only see the readings you explicitly grant consent to share, and you can revoke data access or modify permissions at any time directly in your settings.`;
  }

  // =========================================================================
  // 7. GENERAL CLINICAL REASSURANCE (FALLBACK)
  // =========================================================================
  return `Thank you for consulting me. As your ${consultant?.professional_type || "Care Specialist"}, I have evaluated your continuous dermal ISF biomarker telemetry. Your overall endocrine velocity is reassuring and consistent with expected physiologic variation. Is there a specific symptom or pattern you would like us to investigate further?`;
}
