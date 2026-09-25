import { GoogleGenAI } from "@google/genai";
import { supabaseAdmin } from "./supabaseAdmin.js";
import { env } from "./env.js";

const ai = new GoogleGenAI(env.GEMINI_API_KEY ? { apiKey: env.GEMINI_API_KEY } : {});

export async function generateConsultantReply(
  conversationId: string,
  consultantId: string,
  patientUserId: string
) {
  if (!env.GEMINI_API_KEY) {
    console.log("Skipping AI consultant reply: GEMINI_API_KEY is not set.");
    return;
  }

  try {
    const { data: consultant, error: consultantError } = await supabaseAdmin
      .from("consultants")
      .select("full_name, professional_type")
      .eq("id", consultantId)
      .single();

    if (consultantError || !consultant) {
      console.error("Failed to fetch consultant for AI bot:", consultantError);
      return;
    }

    const { data: messages, error: messagesError } = await supabaseAdmin
      .from("messages")
      .select("body, sender_type, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(10);

    if (messagesError) {
      console.error("Failed to fetch messages for AI bot:", messagesError);
      return;
    }

    const chatHistory = (messages || []).reverse();

    const systemPrompt = `You are ${consultant.full_name}, a professional ${consultant.professional_type}.
You are responding to your patient through a secure medical portal.
Keep your response concise, empathetic, and professional. 
Do not provide definitive medical diagnoses, but you can discuss general health, synthetic data trends, or offer supportive advice.
You are acting as a demo AI consultant for this application.`;

    let conversationText = "";
    for (const msg of chatHistory) {
      const role = msg.sender_type === "patient" ? "Patient" : "You";
      conversationText += `${role}: ${msg.body}\n`;
    }

    const fullPrompt = `${systemPrompt}\n\nRecent Conversation:\n${conversationText}\nYou:`;

    let aiText = "I'm sorry, I am currently experiencing high demand. Please try again later.";
    try {
      const response = await ai.models.generateContent({
          model: 'gemini-flash-latest',
          contents: fullPrompt,
      });
      if (response.text) {
        aiText = response.text;
      }
    } catch (apiError) {
      console.error("Gemini API Error:", apiError);
    }

    const { error: insertError } = await supabaseAdmin
      .from("messages")
      .insert({
        conversation_id: conversationId,
        sender_type: "consultant",
        sender_id: consultantId,
        message_type: "text",
        body: aiText.trim(),
        metadata: { is_ai_generated: true },
      });

    if (insertError) {
      console.error("Failed to insert AI consultant reply:", insertError);
      return;
    }

    await supabaseAdmin
      .from("conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", conversationId);

  } catch (error) {
    console.error("Error generating AI consultant reply:", error);
  }
}
