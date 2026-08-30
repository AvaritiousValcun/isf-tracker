import { Router } from "express";
import { z } from "zod";

import { requireAuth } from "../middleware/auth.js";
import { validateRequest } from "../middleware/validate.js";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";

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
    conversationId: z.string().uuid(),
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

      const { data: relationships, error } =
        await supabaseAdmin
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
            `,
          )
          .eq("patient_user_id", patientUserId)
          .eq("status", "active");

      if (error) {
        throw error;
      }

      const consultantIds = (relationships || [])
        .map((relationship: any) => relationship.consultant_id)
        .filter(Boolean);

      let consents: any[] = [];

      if (consultantIds.length > 0) {
        const {
          data,
          error: consentError,
        } = await supabaseAdmin
          .from("consent_records")
          .select(
            "id, consultant_id, status, scope, granted_at, revoked_at",
          )
          .eq("patient_user_id", patientUserId)
          .eq("purpose", "consultant_access")
          .in("consultant_id", consultantIds)
          .order("granted_at", {
            ascending: false,
          });

        if (consentError) {
          throw consentError;
        }

        consents = data || [];
      }

      const enriched = (relationships || [])
        .map((relationship: any) => {
          const consultant = Array.isArray(
            relationship.consultants,
          )
            ? relationship.consultants[0]
            : relationship.consultants;

          if (!consultant) {
            return null;
          }

          if (consultant.status !== "active") {
            return null;
          }

          const consent = consents.find(
            (item) =>
              item.consultant_id === consultant.id,
          );

          return {
            id: consultant.id,
            full_name: consultant.full_name,
            professional_type:
              consultant.professional_type,
            initials:
              consultant.initials ||
              consultant.full_name
                .split(/\s+/)
                .map(
                  (part: string) =>
                    part[0],
                )
                .join("")
                .slice(0, 2)
                .toUpperCase(),
            color:
              consultant.color ||
              "#2C4C5C",
            online:
              consultant.online ??
              false,
            consent_status:
              consent?.status ||
              "not-granted",
            consent_scope:
              consent?.scope ||
              null,
            relationship_id:
              relationship.id,
            relationship_status:
              relationship.status,
            started_at:
              relationship.started_at,
          };
        })
        .filter(Boolean);

      return res.json(enriched);
    } catch (error) {
      next(error);
    }
  },
);

/*
 * GET /api/chat/conversations
 */
router.get(
  "/conversations",
  requireAuth,
  async (req: any, res, next) => {
    try {
      const {
        data,
        error,
      } = await supabaseAdmin
        .from("conversations")
        .select(
          `
            id,
            patient_user_id,
            consultant_id,
            status,
            created_at,
            updated_at
          `,
        )
        .eq(
          "patient_user_id",
          req.user.id,
        )
        .order("updated_at", {
          ascending: false,
        });

      if (error) {
        throw error;
      }

      return res.json(data || []);
    } catch (error) {
      next(error);
    }
  },
);

/*
 * GET /api/chat/conversations/:conversationId/messages
 */
router.get(
  "/conversations/:conversationId/messages",
  requireAuth,
  async (req: any, res, next) => {
    try {
      const patientUserId =
        req.user.id;

      const conversationId =
        req.params.conversationId;

      const {
        data: conversation,
        error: conversationError,
      } = await supabaseAdmin
        .from("conversations")
        .select(
          "id, patient_user_id, consultant_id, status",
        )
        .eq("id", conversationId)
        .eq(
          "patient_user_id",
          patientUserId,
        )
        .maybeSingle();

      if (conversationError) {
        throw conversationError;
      }

      if (!conversation) {
        return res.status(404).json({
          error:
            "Conversation not found",
        });
      }

      const {
        data,
        error,
      } = await supabaseAdmin
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
          `,
        )
        .eq(
          "conversation_id",
          conversationId,
        )
        .order("created_at", {
          ascending: true,
        });

      if (error) {
        throw error;
      }

      return res.json(data || []);
    } catch (error) {
      next(error);
    }
  },
);

/*
 * POST /api/chat/consultants/:consultantId/consent
 *
 * Grants consultant-access consent and creates
 * an active conversation if necessary.
 */
router.post(
  "/consultants/:consultantId/consent",
  requireAuth,
  validateRequest(consentSchema),
  async (req: any, res, next) => {
    try {
      const patientUserId =
        req.user.id;

      const consultantId =
        req.params.consultantId;

      const {
        data: relationship,
        error,
      } = await supabaseAdmin
        .from("patient_consultants")
        .select("id, status")
        .eq(
          "patient_user_id",
          patientUserId,
        )
        .eq(
          "consultant_id",
          consultantId,
        )
        .eq("status", "active")
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (!relationship) {
        return res.status(404).json({
          error:
            "Active consultant relationship not found",
        });
      }

      const {
        data: existingConsent,
        error:
          consentLookupError,
      } = await supabaseAdmin
        .from("consent_records")
        .select("*")
        .eq(
          "patient_user_id",
          patientUserId,
        )
        .eq(
          "consultant_id",
          consultantId,
        )
        .eq(
          "purpose",
          "consultant_access",
        )
        .eq("status", "granted")
        .order("granted_at", {
          ascending: false,
        })
        .limit(1)
        .maybeSingle();

      if (consentLookupError) {
        throw consentLookupError;
      }

      let consent =
        existingConsent;

      if (!consent) {
        const {
          data: createdConsent,
          error:
            createConsentError,
        } = await supabaseAdmin
          .from("consent_records")
          .insert({
            patient_user_id:
              patientUserId,
            consultant_id:
              consultantId,
            purpose:
              "consultant_access",
            scope:
              req.body.scope,
            status:
              "granted",
            consent_version:
              "1.0",
            granted_at:
              new Date().toISOString(),
            revoked_at:
              null,
          })
          .select("*")
          .single();

        if (createConsentError) {
          throw createConsentError;
        }

        consent =
          createdConsent;
      }

      const {
        data: existingConversation,
        error:
          conversationLookupError,
      } = await supabaseAdmin
        .from("conversations")
        .select("*")
        .eq(
          "patient_user_id",
          patientUserId,
        )
        .eq(
          "consultant_id",
          consultantId,
        )
        .eq("status", "active")
        .limit(1)
        .maybeSingle();

      if (conversationLookupError) {
        throw conversationLookupError;
      }

      let conversation =
        existingConversation;

      const isNewConversation =
        !existingConversation;

      if (!conversation) {
        const {
          data: createdConversation,
          error:
            createConversationError,
        } = await supabaseAdmin
          .from("conversations")
          .insert({
            patient_user_id:
              patientUserId,
            consultant_id:
              consultantId,
            status: "active",
          })
          .select("*")
          .single();

        if (createConversationError) {
          /*
           * The database unique index is the final
           * concurrency protection. If two requests race,
           * recover the already-created active conversation.
           */
          if (
            createConversationError.code ===
            "23505"
          ) {
            const {
              data:
                racedConversation,
              error:
                racedLookupError,
            } = await supabaseAdmin
              .from("conversations")
              .select("*")
              .eq(
                "patient_user_id",
                patientUserId,
              )
              .eq(
                "consultant_id",
                consultantId,
              )
              .eq("status", "active")
              .limit(1)
              .maybeSingle();

            if (racedLookupError) {
              throw racedLookupError;
            }

            if (!racedConversation) {
              throw createConversationError;
            }

            conversation =
              racedConversation;
          } else {
            throw createConversationError;
          }
        } else {
          conversation =
            createdConversation;
        }
      }

      /*
       * The consent-notice system message is written here, using
       * the service-role client, which bypasses RLS by design.
       * This is intentional: after the messages RLS fix
       * (20260829040000_messages_sender_type_rls_fix.sql), the
       * `authenticated` role can never write sender_type = 'system'
       * -- only server code using supabaseAdmin can.
       */
      if (
        isNewConversation &&
        conversation
      ) {
        const {
          error: noticeError,
        } = await supabaseAdmin
          .from("messages")
          .insert({
            conversation_id:
              conversation.id,
            sender_type: "system",
            message_type:
              "consent_notice",
            body: "Consent granted. This consultant can now access your ISF readings.",
          });

        if (noticeError) {
          console.error(
            "[Chat] Failed to write consent notice message:",
            noticeError,
          );
        }
      }

      return res.status(201).json({
        consent,
        conversation,
      });
    } catch (error) {
      next(error);
    }
  },
);

/*
 * POST /api/chat/messages
 *
 * Sends a patient message.
 *
 * Free users are limited to 50 patient-authored
 * messages across all of their conversations.
 */
router.post(
  "/messages",
  requireAuth,
  validateRequest(messageSchema),
  async (req: any, res, next) => {
    try {
      const patientUserId =
        req.user.id;

      const {
        conversationId,
        message,
      } = req.body;

      const {
        data: conversation,
        error: conversationError,
      } = await supabaseAdmin
        .from("conversations")
        .select(
          "id, consultant_id, status",
        )
        .eq(
          "id",
          conversationId,
        )
        .eq(
          "patient_user_id",
          patientUserId,
        )
        .maybeSingle();

      if (conversationError) {
        throw conversationError;
      }

      if (!conversation) {
        return res.status(404).json({
          error:
            "Conversation not found",
        });
      }

      if (
        conversation.status !==
        "active"
      ) {
        return res.status(409).json({
          error:
            "Conversation is not active",
        });
      }

      const {
        data: consent,
        error: consentError,
      } = await supabaseAdmin
        .from("consent_records")
        .select("id, scope")
        .eq(
          "patient_user_id",
          patientUserId,
        )
        .eq(
          "consultant_id",
          conversation.consultant_id,
        )
        .eq(
          "purpose",
          "consultant_access",
        )
        .eq(
          "status",
          "granted",
        )
        .order("granted_at", {
          ascending: false,
        })
        .limit(1)
        .maybeSingle();

      if (consentError) {
        throw consentError;
      }

      if (!consent) {
        return res.status(403).json({
          error:
            "Consultant consent is required",
        });
      }

      const {
        data: subscription,
        error:
          subscriptionError,
      } = await supabaseAdmin
        .from("subscriptions")
        .select(
          "plan, status, renewal_at",
        )
        .eq(
          "patient_user_id",
          patientUserId,
        )
        .order("created_at", {
          ascending: false,
        })
        .limit(1)
        .maybeSingle();

      if (subscriptionError) {
        throw subscriptionError;
      }

      const isPremium =
        subscription?.plan ===
          "premium" &&
        subscription?.status ===
          "active" &&
        (
          !subscription.renewal_at ||
          new Date(
            subscription.renewal_at,
          ).getTime() >
            Date.now()
        );

      /*
       * =========================================================
       * FREE PLAN ENFORCEMENT
       * =========================================================
       *
       * Only sender_type = patient is counted.
       */
      if (!isPremium) {
        const {
          data:
            patientConversations,
          error:
            conversationsError,
        } = await supabaseAdmin
          .from("conversations")
          .select("id")
          .eq(
            "patient_user_id",
            patientUserId,
          );

        if (conversationsError) {
          throw conversationsError;
        }

        const conversationIds =
          (
            patientConversations ||
            []
          ).map(
            (conversation) =>
              conversation.id,
          );

        let messagesSent = 0;

        if (
          conversationIds.length >
          0
        ) {
          const {
            count,
            error:
              countError,
          } = await supabaseAdmin
            .from("messages")
            .select("id", {
              count: "exact",
              head: true,
            })
            .eq(
              "sender_type",
              "patient",
            )
            .in(
              "conversation_id",
              conversationIds,
            );

          if (countError) {
            throw countError;
          }

          messagesSent =
            count ?? 0;
        }

        if (
          messagesSent >=
          FREE_MESSAGE_LIMIT
        ) {
          return res.status(403).json({
            error:
              "Message quota exceeded. Please upgrade to Premium.",
            quota_limit:
              FREE_MESSAGE_LIMIT,
            messages_sent:
              messagesSent,
            premium_required:
              true,
          });
        }
      }

      const {
        data: createdMessage,
        error: messageError,
      } = await supabaseAdmin
        .from("messages")
        .insert({
          conversation_id:
            conversationId,
          sender_type:
            "patient",
          sender_id:
            patientUserId,
          message_type:
            "text",
          body:
            message,
          metadata: {},
        })
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
          `,
        )
        .single();

      if (messageError) {
        throw messageError;
      }

      const {
        error:
          conversationUpdateError,
      } = await supabaseAdmin
        .from("conversations")
        .update({
          updated_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          conversationId,
        );

      if (conversationUpdateError) {
        throw conversationUpdateError;
      }

      return res.status(201).json(
        createdMessage,
      );
    } catch (error) {
      next(error);
    }
  },
);

export default router;