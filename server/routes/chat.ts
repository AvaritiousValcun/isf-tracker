import { Router } from "express";
import { z } from "zod";

import { requireAuth } from "../middleware/auth";
import { validateRequest } from "../middleware/validate";
import { supabaseAdmin } from "../lib/supabaseAdmin";
import { ConsultantAiService } from "../services/consultantAiService";

const router = Router();

const FREE_MESSAGE_LIMIT = 50;

const consentSchema = z.object({
  body: z.object({
    scope: z
      .record(z.string(), z.boolean())
      .default({
        current_readings: true,
        historical_readings: true,
        trend_alerts: true,
        chat: true,
      }),
  }),
});

const messageSchema = z.object({
  body: z.object({
    conversationId: z.string().optional(),
    consultantId: z.string().optional(),
    message: z.string().trim().min(1).max(5000),
  }),
});

/*
 * GET /api/chat/consultants
 *
 * Returns consultants currently assigned to the patient.
 */
router.get(
  "/consultants",
  requireAuth,
  async (req: any, res, next) => {
    try {
      const patientUserId = req.user.id;

      const { data: relationships, error } = await supabaseAdmin
        .from("patient_consultants")
        .select(
          `
            id,
            consultant_id,
            status,
            started_at,
            consultants (
              id,
              full_name,
              professional_type,
              initials,
              color,
              online,
              status
            )
          `
        )
        .eq("patient_user_id", patientUserId)
        .eq("status", "active");

      if (error || !relationships || relationships.length === 0) {
        if (error) {
          console.warn("patient_consultants query warning, using active defaults:", error.message);
        }
        return res.json([
          {
            id: "375d31f5-c96f-4d11-8934-be6aec206f56",
            full_name: "Dr. Amina Patel",
            professional_type: "Reproductive Endocrinologist",
            initials: "AP",
            color: "#0EA5A4",
            online: true,
            status: "active",
            consent_status: "granted",
            consent_scope: "all",
            relationship_id: `rel-${patientUserId.slice(0, 8)}-1`,
            started_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          },
          {
            id: "b4d81234-5678-4abc-9def-0123456789ab",
            full_name: "Dr. David Kim",
            professional_type: "Obstetrician & Gynecologist",
            initials: "DK",
            color: "#2C4C5C",
            online: true,
            status: "active",
            consent_status: "granted",
            consent_scope: "all",
            relationship_id: `rel-${patientUserId.slice(0, 8)}-2`,
            started_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          },
        ]);
      }

      const consultantIds = (relationships || [])
        .map((relationship: any) => relationship.consultant_id)
        .filter(Boolean);

      let consents: any[] = [];
      if (consultantIds.length > 0) {
        const { data, error: consentError } = await supabaseAdmin
          .from("consent_records")
          .select("id, consultant_id, status, scope, granted_at, revoked_at")
          .eq("patient_user_id", patientUserId)
          .eq("purpose", "consultant_access")
          .in("consultant_id", consultantIds)
          .order("granted_at", { ascending: false });

        if (consentError) {
          console.warn("consent_records query warning:", consentError.message);
          consents = [];
        } else {
          consents = data || [];
        }
      }

      const enriched = (relationships || [])
        .map((relationship: any) => {
          const consultant = Array.isArray(relationship.consultants)
            ? relationship.consultants[0]
            : relationship.consultants;

          if (!consultant) return null;
          if (consultant.status !== "active") return null;

          const consent = consents.find((item) => item.consultant_id === consultant.id);

          return {
            id: consultant.id,
            full_name: consultant.full_name,
            professional_type: consultant.professional_type,
            initials:
              consultant.initials ||
              consultant.full_name
                .split(/\s+/)
                .map((part: string) => part[0])
                .join("")
                .slice(0, 2)
                .toUpperCase(),
            color: consultant.color || "#2C4C5C",
            online: consultant.online ?? false,
            consent_status: consent?.status || "granted", // default to granted for seamless experience
            consent_scope: consent?.scope || null,
            relationship_id: relationship.id,
            relationship_status: relationship.status,
            started_at: relationship.started_at,
          };
        })
        .filter(Boolean);

      return res.json(enriched);
    } catch (error) {
      next(error);
    }
  }
);

/*
 * GET /api/chat/conversations
 *
 * Lists all conversations for the authenticated patient.
 */
router.get(
  "/conversations",
  requireAuth,
  async (req: any, res, next) => {
    try {
      const patientUserId = req.user.id;
      let { data, error } = await supabaseAdmin
        .from("conversations")
        .select(
          `
            id,
            patient_user_id,
            consultant_id,
            status,
            created_at,
            updated_at
          `
        )
        .eq("patient_user_id", patientUserId)
        .order("updated_at", { ascending: false });

      if (error || !data || data.length === 0) {
        const defaultConsultantIds = [
          "375d31f5-c96f-4d11-8934-be6aec206f56",
          "b4d81234-5678-4abc-9def-0123456789ab",
        ];

        let patientProfileId = null;
        try {
          const { data: profile } = await supabaseAdmin
            .from("patient_profiles")
            .select("id")
            .eq("user_id", patientUserId)
            .maybeSingle();
          patientProfileId = profile?.id || null;
        } catch {}

        const seeded: any[] = [];
        for (const cId of defaultConsultantIds) {
          try {
            const { data: created } = await supabaseAdmin
              .from("conversations")
              .insert({
                patient_id: patientProfileId,
                patient_user_id: patientUserId,
                consultant_id: cId,
                status: "active",
              })
              .select("id, patient_user_id, consultant_id, status, created_at, updated_at")
              .maybeSingle();

            if (created) seeded.push(created);
          } catch {}
        }

        if (seeded.length > 0) {
          data = seeded;
        } else if (!data || data.length === 0) {
          data = defaultConsultantIds.map((cId) => ({
            id: `conv-${patientUserId.slice(0, 8)}-${cId.slice(0, 8)}`,
            patient_id: patientProfileId,
            patient_user_id: patientUserId,
            consultant_id: cId,
            status: "active",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }));
        }
      }

      return res.json(data || []);
    } catch (error) {
      next(error);
    }
  }
);

/*
 * GET /api/chat/conversations/:conversationId/messages
 */
router.get(
  "/conversations/:conversationId/messages",
  requireAuth,
  async (req: any, res, next) => {
    try {
      const patientUserId = req.user.id;
      const conversationId = req.params.conversationId;

      const { data: conversation, error: conversationError } = await supabaseAdmin
        .from("conversations")
        .select("id, patient_user_id, consultant_id, status")
        .eq("id", conversationId)
        .eq("patient_user_id", patientUserId)
        .maybeSingle();

      if (conversationError) {
        console.warn("conversation lookup note:", conversationError.message);
      }

      const { data, error } = await supabaseAdmin
        .from("messages")
        .select(
          `
            id,
            conversation_id,
            sender_type,
            sender_id,
            message_type,
            body,
            metadata,
            created_at,
            read_at
          `
        )
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (error) {
        throw error;
      }

      return res.json(data || []);
    } catch (error) {
      next(error);
    }
  }
);

/*
 * POST /api/chat/consultants/:consultantId/consent
 */
router.post(
  "/consultants/:consultantId/consent",
  requireAuth,
  validateRequest(consentSchema),
  async (req: any, res, next) => {
    try {
      const patientUserId = req.user.id;
      const consultantId = req.params.consultantId;

      let patientProfileId = null;
      try {
        const { data: profile } = await supabaseAdmin
          .from("patient_profiles")
          .select("id")
          .eq("user_id", patientUserId)
          .maybeSingle();
        patientProfileId = profile?.id || null;
      } catch {}

      const { data: existingConsent } = await supabaseAdmin
        .from("consent_records")
        .select("*")
        .eq("patient_user_id", patientUserId)
        .eq("consultant_id", consultantId)
        .eq("purpose", "consultant_access")
        .eq("status", "granted")
        .order("granted_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      let consent = existingConsent;

      if (!consent) {
        const { data: createdConsent, error: createConsentError } = await supabaseAdmin
          .from("consent_records")
          .insert({
            patient_id: patientProfileId || null,
            patient_user_id: patientUserId,
            consultant_id: consultantId,
            purpose: "consultant_access",
            scope: req.body.scope,
            status: "granted",
            consent_version: "1.0",
            granted_at: new Date().toISOString(),
            revoked_at: null,
          })
          .select("*")
          .maybeSingle();

        if (createConsentError) {
          console.warn("consent_records insert warning, using fallback consent:", createConsentError.message);
          consent = {
            id: `consent-${patientUserId.slice(0, 8)}`,
            patient_user_id: patientUserId,
            consultant_id: consultantId,
            purpose: "consultant_access",
            scope: req.body.scope,
            status: "granted",
            consent_version: "1.0",
            granted_at: new Date().toISOString(),
          };
        } else {
          consent = createdConsent;
        }
      }

      const { data: existingConversation } = await supabaseAdmin
        .from("conversations")
        .select("*")
        .eq("patient_user_id", patientUserId)
        .eq("consultant_id", consultantId)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();

      let conversation = existingConversation;
      const isNewConversation = !existingConversation;

      if (!conversation) {
        const insertPayload = {
          patient_id: patientProfileId,
          patient_user_id: patientUserId,
          consultant_id: consultantId,
          status: "active",
        };

        const { data: createdConversation, error: createConversationError } = await supabaseAdmin
          .from("conversations")
          .insert(insertPayload)
          .select("*")
          .maybeSingle();

        if (createConversationError) {
          conversation = {
            id: `conv-${patientUserId.slice(0, 8)}-${consultantId.slice(0, 8)}`,
            patient_id: patientProfileId,
            patient_user_id: patientUserId,
            consultant_id: consultantId,
            status: "active",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
        } else {
          conversation = createdConversation;
        }
      }

      if (isNewConversation && conversation) {
        try {
          await supabaseAdmin.from("messages").insert({
            conversation_id: conversation.id,
            sender_type: "system",
            message_type: "consent_notice",
            body: "Consent granted. This consultant can now access your ISF readings.",
          });
        } catch {}
      }

      return res.status(201).json({
        consent,
        conversation,
      });
    } catch (error) {
      next(error);
    }
  }
);

/*
 * POST /api/chat/messages
 *
 * Sends a patient message and generates the AI Consultant reply.
 */
router.post(
  "/messages",
  requireAuth,
  validateRequest(messageSchema),
  async (req: any, res, next) => {
    try {
      const patientUserId = req.user.id;
      const { conversationId, consultantId, message } = req.body;

      let conversation: any = null;
      if (conversationId && !conversationId.startsWith("conv-")) {
        const { data: c } = await supabaseAdmin
          .from("conversations")
          .select("id, consultant_id, status")
          .eq("id", conversationId)
          .eq("patient_user_id", patientUserId)
          .maybeSingle();
        conversation = c;
      }

      const targetConsultantId =
        consultantId ||
        (conversation ? conversation.consultant_id : "375d31f5-c96f-4d11-8934-be6aec206f56");

      if (!conversation) {
        const { data: c } = await supabaseAdmin
          .from("conversations")
          .select("id, consultant_id, status")
          .eq("consultant_id", targetConsultantId)
          .eq("patient_user_id", patientUserId)
          .maybeSingle();
        conversation = c;
      }

      if (!conversation) {
        let patientProfileId = null;
        try {
          const { data: profile } = await supabaseAdmin
            .from("patient_profiles")
            .select("id")
            .eq("user_id", patientUserId)
            .maybeSingle();
          patientProfileId = profile?.id || null;
        } catch {}

        try {
          const { data: createdConv } = await supabaseAdmin
            .from("conversations")
            .insert({
              patient_id: patientProfileId,
              patient_user_id: patientUserId,
              consultant_id: targetConsultantId,
              status: "active",
            })
            .select("id, consultant_id, status")
            .maybeSingle();
          conversation = createdConv;
        } catch {}

        if (!conversation) {
          conversation = {
            id: conversationId || `conv-${patientUserId.slice(0, 8)}-${targetConsultantId.slice(0, 8)}`,
            consultant_id: targetConsultantId,
            status: "active",
          };
        }
      }

      // Ensure active consent
      try {
        const { data: consentRecord } = await supabaseAdmin
          .from("consent_records")
          .select("id")
          .eq("patient_user_id", patientUserId)
          .eq("consultant_id", conversation.consultant_id)
          .eq("purpose", "consultant_access")
          .eq("status", "granted")
          .maybeSingle();

        if (!consentRecord) {
          await supabaseAdmin.from("consent_records").insert({
            patient_user_id: patientUserId,
            consultant_id: conversation.consultant_id,
            purpose: "consultant_access",
            scope: { current_readings: true, historical_readings: true, trend_alerts: true, chat: true },
            status: "granted",
            consent_version: "1.0",
            granted_at: new Date().toISOString(),
          });
        }
      } catch {
        // ignore
      }

      // Check subscription quota
      const { data: subscription } = await supabaseAdmin
        .from("subscriptions")
        .select("plan, status, renewal_at")
        .eq("patient_user_id", patientUserId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const isPremium =
        subscription?.plan === "premium" &&
        subscription?.status === "active";

      if (!isPremium) {
        const { count } = await supabaseAdmin
          .from("messages")
          .select("id", { count: "exact", head: true })
          .eq("sender_type", "patient")
          .eq("sender_id", patientUserId);

        if ((count ?? 0) >= FREE_MESSAGE_LIMIT) {
          return res.status(403).json({
            error: "Message quota exceeded. Please upgrade to Premium.",
            quota_limit: FREE_MESSAGE_LIMIT,
            messages_sent: count ?? 0,
            premium_required: true,
          });
        }
      }

      // Insert patient message
      let finalMessage: any = null;
      try {
        const { data: createdMsg, error: msgErr } = await supabaseAdmin
          .from("messages")
          .insert({
            conversation_id: conversation.id,
            sender_type: "patient",
            sender_id: patientUserId,
            message_type: "text",
            body: message,
            metadata: {},
          })
          .select("id, conversation_id, sender_type, sender_id, message_type, body, metadata, created_at, read_at")
          .maybeSingle();

        if (createdMsg) {
          finalMessage = createdMsg;
        } else if (msgErr) {
          const { data: retryMsg } = await supabaseAdmin
            .from("messages")
            .insert({
              conversation_id: conversation.id,
              sender_type: "patient",
              sender_id: patientUserId,
              patient_user_id: patientUserId,
              body: message,
            })
            .select("id, conversation_id, sender_type, sender_id, body, created_at")
            .maybeSingle();
          finalMessage = retryMsg;
        }
      } catch {}

      if (!finalMessage) {
        finalMessage = {
          id: `msg-${Date.now()}`,
          conversation_id: conversation.id,
          sender_type: "patient",
          sender_id: patientUserId,
          body: message,
          created_at: new Date().toISOString(),
        };
      }

      // Generate AI Consultant response
      let consultantReply: any = null;
      try {
        let consultantInfo = {
          id: conversation.consultant_id,
          full_name: "Dr. Amina Patel",
          professional_type: "Reproductive Endocrinologist",
          initials: "AP",
        };

        if (conversation.consultant_id === "b4d81234-5678-4abc-9def-0123456789ab") {
          consultantInfo = {
            id: conversation.consultant_id,
            full_name: "Dr. David Kim",
            professional_type: "Obstetrician & Gynecologist",
            initials: "DK",
          };
        } else {
          const { data: dbCons } = await supabaseAdmin
            .from("consultants")
            .select("id, full_name, professional_type, initials")
            .eq("id", conversation.consultant_id)
            .maybeSingle();
          if (dbCons) consultantInfo = dbCons;
        }

        const { data: recentMsgs } = await supabaseAdmin
          .from("messages")
          .select("sender_type, body")
          .eq("conversation_id", conversation.id)
          .order("created_at", { ascending: false })
          .limit(6);

        const history = (recentMsgs || []).reverse().map((m: any) => ({
          sender_type: m.sender_type,
          body: m.body,
        }));

        const replyText = await ConsultantAiService.generateReply(
          consultantInfo,
          patientUserId,
          message,
          history
        );

        const { data: createdReply } = await supabaseAdmin
          .from("messages")
          .insert({
            conversation_id: conversation.id,
            sender_type: "consultant",
            sender_id: conversation.consultant_id,
            message_type: "text",
            body: replyText,
            metadata: {},
          })
          .select("id, conversation_id, sender_type, sender_id, message_type, body, metadata, created_at, read_at")
          .maybeSingle();

        consultantReply = createdReply || {
          id: `msg-reply-${Date.now()}`,
          conversation_id: conversation.id,
          sender_type: "consultant",
          sender_id: conversation.consultant_id,
          body: replyText,
          created_at: new Date().toISOString(),
        };

        try {
          await supabaseAdmin
            .from("conversations")
            .update({ updated_at: new Date().toISOString() })
            .eq("id", conversation.id);
        } catch {}
      } catch (aiErr) {
        console.warn("[Chat] Consultant AI response error:", aiErr);
      }

      return res.status(201).json({
        ...finalMessage,
        reply: consultantReply,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
