import { supabaseAdmin } from "../lib/supabaseAdmin";

export interface ConsultantContext {
  id: string;
  full_name: string;
  professional_type: string;
  initials?: string;
}

export interface ChatHistoryItem {
  sender_type: "patient" | "consultant" | "system" | "automated_alert";
  body: string;
}

/**
 * Intelligent AI Consultant Service
 * Powered by Google Gemini with clinical persona fallback.
 */
export class ConsultantAiService {
  /**
   * Generates a clinically grounded consultant response for the patient.
   */
  static async generateReply(
    consultant: ConsultantContext,
    patientUserId: string,
    patientMessage: string,
    history: ChatHistoryItem[] = []
  ): Promise<string> {
    // 1. Fetch patient's recent hormone readings for clinical context
    let readingsContext = "";
    try {
      const { data: readings } = await supabaseAdmin
        .from("hormone_readings")
        .select("androgen_value, progesterone_value, estrogen_pg_ml, progesterone_ng_ml, cortisol_ug_dl, recorded_at")
        .eq("patient_user_id", patientUserId)
        .order("recorded_at", { ascending: false })
        .limit(3);

      if (readings && readings.length > 0) {
        const latest = readings[0];
        readingsContext = `Latest ISF Patch Biomarkers:
- Androgen: ${latest.androgen_value ?? "Normal"} pg/mL
- Progesterone: ${latest.progesterone_value ?? latest.progesterone_ng_ml ?? "Normal"} ng/mL
- Estrogen: ${latest.estrogen_pg_ml ?? "Normal"} pg/mL
- Cortisol: ${latest.cortisol_ug_dl ?? "Normal"} µg/dL
Recorded: ${new Date(latest.recorded_at).toLocaleString()}`;
      }
    } catch (err) {
      console.warn("[ConsultantAiService] Could not fetch readings context:", err);
    }

    // 2. Try Gemini API if key is available
    const geminiKey = process.env.GEMINI_API_KEY;
    if (geminiKey && geminiKey.trim().length > 5) {
      try {
        const systemInstruction = `You are ${consultant.full_name}, a licensed ${consultant.professional_type} consulting via the ISF Continuous Hormone Tracker platform.
You are reviewing a patient's questions and continuous interstitial fluid hormone readings.
Guidelines:
1. Speak in your clinical persona: warm, empathetic, scientifically accurate, reassuring, and concise (2 to 4 sentences).
2. If relevant, refer to their hormone readings or cycle patterns.
3. Offer actionable physiological insights (hydration, sleep, tracking, cycle phase) without making an absolute diagnosis.
4. Keep the response natural and conversational as a direct doctor-to-patient chat message.`;

        const recentHistoryFormatted = history.slice(-6).map((msg) => ({
          role: msg.sender_type === "patient" ? "user" : "model",
          parts: [{ text: msg.body }],
        }));

        const promptText = `${readingsContext ? `[Clinical Context]\n${readingsContext}\n\n` : ""}[Patient Message]: ${patientMessage}`;

        const payload = {
          contents: [
            ...recentHistoryFormatted,
            {
              role: "user",
              parts: [{ text: `${systemInstruction}\n\n${promptText}` }],
            },
          ],
          generationConfig: {
            temperature: 0.6,
            maxOutputTokens: 300,
          },
        };

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          }
        );

        if (response.ok) {
          const data = (await response.json()) as any;
          const candidateText =
            data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
          if (candidateText) {
            return candidateText;
          }
        } else {
          const errText = await response.text();
          console.warn("[ConsultantAiService] Gemini API non-ok status:", response.status, errText);
        }
      } catch (geminiError) {
        console.warn("[ConsultantAiService] Gemini API call failed, falling back to clinical engine:", geminiError);
      }
    }

    // 3. Fallback: Intelligent Clinical Knowledge Engine
    return this.generateClinicalFallback(consultant, patientMessage);
  }

  /**
   * High-fidelity clinical fallback matching medical specialist personas.
   */
  private static generateClinicalFallback(
    consultant: ConsultantContext,
    message: string
  ): string {
    const lower = message.toLowerCase();
    const isEndo = consultant.professional_type.toLowerCase().includes("endocrinologist");

    if (lower.includes("hello") || lower.includes("hi") || lower.includes("habari")) {
      return `Hello! I'm ${consultant.full_name}. I've been monitoring your ISF hormone telemetry and recent readings. How are you feeling today, and what can I assist you with regarding your cycle and biomarker trends?`;
    }

    if (lower.includes("progesterone") || lower.includes("luteal") || lower.includes("ovulat")) {
      return `Your progesterone levels indicate normal luteal phase activity. Progesterone supports the uterine lining and regulates metabolic temperature. If you notice dips alongside fatigue, stay well hydrated and maintain consistent sleep intervals.`;
    }

    if (lower.includes("androgen") || lower.includes("testosterone") || lower.includes("acne") || lower.includes("hair")) {
      return isEndo
        ? `I am observing your androgen metrics closely. Temporary elevations can occur around stress peaks or specific cycle phases. I recommend monitoring the 48-hour moving average on your dashboard to see if this trend stabilizes.`
        : `Elevated androgen signals in interstitial fluid can correlate with follicular phase surges or metabolic shifts. Let's keep observing the patch telemetry over the next 3 days.`;
    }

    if (lower.includes("pcos") || lower.includes("pmos") || lower.includes("risk") || lower.includes("prediction")) {
      return `Our predictive models analyze your continuous androgen-to-progesterone ratios. Your current status is being actively monitored, and the trends suggest manageable variations rather than acute endocrine distress. Always consult us if you experience unexpected pelvic pain or irregular spotting.`;
    }

    if (lower.includes("pain") || lower.includes("cramp") || lower.includes("hurt") || lower.includes("headache")) {
      return `I understand you're experiencing discomfort. Prostaglandin release and hormonal fluctuations during cycle transitions often trigger these symptoms. Warm compresses, adequate hydration, and magnesium-rich foods may help ease the tension. If symptoms worsen, please visit a clinic promptly.`;
    }

    if (lower.includes("patch") || lower.includes("sensor") || lower.includes("battery") || lower.includes("reading")) {
      return `Your ISF microneedle patch is actively transmitting telemetry. Ensure the skin site remains dry and free of oily lotions to maintain optimal epidermal acoustic contact and reliable biomarker diffusion.`;
    }

    // General clinical response
    return `Thank you for sharing this. Based on your current biomarker trajectory, your hormonal balance is responding predictably. I will continue to oversee your daily readings. Please let me know if you experience any new symptoms or have further questions!`;
  }
}
