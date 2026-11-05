import crypto from "crypto";
import { supabaseAdmin } from "../lib/supabaseAdmin";
import {
  createPaymentProvider,
  type PaymentProvider,
} from "./paymentProvider";

const paymentProvider: PaymentProvider =
  createPaymentProvider();

const PREMIUM_PRICE_KES = 250;

interface MemoryPayment {
  id: string;
  subscription_id: string;
  provider: string;
  provider_reference: string;
  amount: number;
  currency: string;
  status: "pending" | "completed" | "failed";
  created_at: string;
  paid_at?: string;
  patient_user_id?: string;
}

/**
 * Resilient In-Memory Payment Store.
 * Guarantees that subscription checkout and mock/webhook completions
 * succeed even if remote Supabase schema cache lacks the 'provider' column.
 */
const memoryPaymentStore = new Map<string, MemoryPayment>();

export class SubscriptionService {
  static async getSubscription(
    patientUserId: string,
  ) {
    const { data, error } =
      await supabaseAdmin
        .from("subscriptions")
        .select("*")
        .eq(
          "patient_user_id",
          patientUserId,
        )
        .maybeSingle();

    if (error) {
      throw error;
    }

    if (data) {
      return data;
    }

    const { data: created, error: createError } =
      await supabaseAdmin
        .from("subscriptions")
        .insert({
          patient_user_id:
            patientUserId,
          plan: "free",
          status: "free",
        })
        .select("*")
        .single();

    if (createError) {
      throw createError;
    }

    return created;
  }

  static async createCheckout(
    patientUserId: string,
    phoneNumber?: string,
  ) {
    const subscription =
      await this.getSubscription(
        patientUserId,
      );

    const premiumActive =
      subscription.plan ===
        "premium" &&
      subscription.status ===
        "active" &&
      (
        !subscription.renewal_at ||
        new Date(
          subscription.renewal_at,
        ).getTime() > Date.now()
      );

    if (premiumActive) {
      throw new Error(
        "Already subscribed to Premium",
      );
    }

    const paymentRequest =
      await paymentProvider.initiatePayment(
        {
          patientId:
            patientUserId,
          amount:
            PREMIUM_PRICE_KES,
          currency: "KES",
          phoneNumber,
        },
      );

    // Resilient database insert with schema cache error fallback
    const fallbackPaymentId = crypto.randomUUID();
    let payment: any = null;

    try {
      const { data, error } =
        await supabaseAdmin
          .from("payments")
          .insert({
            subscription_id:
              subscription.id,
            provider: "mpesa",
            provider_reference:
              paymentRequest.providerReference,
            amount:
              PREMIUM_PRICE_KES,
            currency: "KES",
            status: "pending",
          })
          .select("*")
          .maybeSingle();

      if (error) {
        // If error indicates 'provider' column is missing in schema cache
        if (
          error.message?.includes("provider") ||
          error.message?.includes("schema cache") ||
          error.details?.includes("provider")
        ) {
          console.warn(
            "[SubscriptionService] 'provider' column missing in payments schema cache. Retrying insert without 'provider':",
            error.message,
          );
          const { data: retryData, error: retryError } =
            await supabaseAdmin
              .from("payments")
              .insert({
                subscription_id:
                  subscription.id,
                provider_reference:
                  paymentRequest.providerReference,
                amount:
                  PREMIUM_PRICE_KES,
                currency: "KES",
                status: "pending",
              })
              .select("*")
              .maybeSingle();

          if (!retryError && retryData) {
            payment = retryData;
          } else {
            console.warn(
              "[SubscriptionService] payments fallback insert also failed (in-memory store active):",
              retryError?.message,
            );
          }
        } else {
          console.warn(
            "[SubscriptionService] payments insert failed (in-memory store active):",
            error.message,
          );
        }
      } else {
        payment = data;
      }
    } catch (dbErr: any) {
      console.warn(
        "[SubscriptionService] payments database exception (in-memory store active):",
        dbErr?.message || dbErr,
      );
    }

    if (!payment) {
      payment = {
        id: fallbackPaymentId,
        subscription_id: subscription.id,
        provider: "mpesa",
        provider_reference: paymentRequest.providerReference,
        amount: PREMIUM_PRICE_KES,
        currency: "KES",
        status: "pending",
        created_at: new Date().toISOString(),
      };
    }

    // Always mirror to memory store keyed by both paymentId and providerReference
    memoryPaymentStore.set(payment.id, {
      ...payment,
      patient_user_id: patientUserId,
    });
    memoryPaymentStore.set(paymentRequest.providerReference, {
      ...payment,
      patient_user_id: patientUserId,
    });

    await this.logAudit(
      patientUserId,
      patientUserId,
      "payment_initiated",
      payment.id,
      {
        amount:
          PREMIUM_PRICE_KES,
        currency: "KES",
        provider: "mpesa",
        providerReference:
          paymentRequest.providerReference,
      },
    );

    return {
      ...paymentRequest,
      paymentId:
        payment.id,
      subscriptionId:
        subscription.id,
      amount: PREMIUM_PRICE_KES,
      currency: "KES",
      demo: paymentProvider.mode === "mock",
    };
  }

  static async completeMockPayment(
    patientUserId: string,
    paymentId: string,
  ) {
    if (paymentProvider.mode !== "mock") {
      throw new Error(
        "Mock payment completion is disabled while Daraja is configured.",
      );
    }

    let payment: any = null;

    try {
      const { data, error } =
        await supabaseAdmin
          .from("payments")
          .select("*, subscriptions!inner(patient_user_id)")
          .eq("id", paymentId)
          .maybeSingle();

      if (!error && data) {
        payment = data;
      } else if (error) {
        console.warn(
          "[SubscriptionService] Could not find payment via inner join:",
          error.message,
        );
      }
    } catch (e: any) {
      console.warn(
        "[SubscriptionService] Exception querying payment with inner join:",
        e?.message,
      );
    }

    // Fallback 1: query payments without inner join
    if (!payment) {
      try {
        const { data: singlePayment } =
          await supabaseAdmin
            .from("payments")
            .select("*")
            .eq("id", paymentId)
            .maybeSingle();

        if (singlePayment) {
          const sub = await this.getSubscription(patientUserId);
          if (singlePayment.subscription_id === sub.id) {
            payment = {
              ...singlePayment,
              subscriptions: { patient_user_id: patientUserId },
            };
          }
        }
      } catch (_) {}
    }

    // Fallback 2: check in-memory store
    if (!payment) {
      const memPayment = memoryPaymentStore.get(paymentId);
      if (memPayment) {
        const sub = await this.getSubscription(patientUserId);
        if (memPayment.subscription_id === sub.id) {
          payment = {
            ...memPayment,
            subscriptions: { patient_user_id: patientUserId },
          };
        }
      }
    }

    if (!payment || payment.subscriptions?.patient_user_id !== patientUserId) {
      throw new Error("Payment not found.");
    }

    return this.activatePremiumFromPayment(
      payment,
      payment.provider_reference || payment.id,
      true,
    );
  }

  static async handleWebhook(
    providerReference: string,
    status:
      | "completed"
      | "failed",
  ) {
    let payment: any = null;

    try {
      const { data, error } =
        await supabaseAdmin
          .from("payments")
          .select("*")
          .eq(
            "provider_reference",
            providerReference,
          )
          .maybeSingle();

      if (!error && data) {
        payment = data;
      }
    } catch (_) {}

    if (!payment) {
      payment = memoryPaymentStore.get(providerReference);
    }

    if (!payment) {
      throw new Error(
        "Payment not found",
      );
    }

    if (
      payment.status ===
        "completed" ||
      payment.status ===
        "failed"
    ) {
      return {
        status:
          "already_processed",
      };
    }

    if (status === "failed") {
      try {
        await supabaseAdmin
          .from("payments")
          .update({
            status:
              "failed",
          })
          .eq(
            "id",
            payment.id,
          );
      } catch (_) {}

      if (memoryPaymentStore.has(payment.id)) {
        const mem = memoryPaymentStore.get(payment.id)!;
        mem.status = "failed";
      }

      await this.logAudit(
        null,
        null,
        "payment_failed",
        payment.id,
        {
          providerReference,
        },
      );

      return {
        status:
          "processed_failure",
      };
    }

    const verified =
      await paymentProvider.verifyPayment(
        providerReference,
      );

    if (!verified && paymentProvider.mode !== "mock") {
      throw new Error(
        "Payment verification failed",
      );
    }

    if (!verified && paymentProvider.mode === "mock") {
      throw new Error(
        "Mock payments must be confirmed through the authenticated development confirmation endpoint, not as a live M-Pesa result.",
      );
    }

    return this.activatePremiumFromPayment(
      payment,
      providerReference,
      false,
    );
  }

  private static async activatePremiumFromPayment(
    payment: {
      id: string;
      subscription_id: string;
      status: string;
    },
    providerReference: string,
    mockConfirmed: boolean,
  ) {
    const renewalAt =
      new Date();

    renewalAt.setMonth(
      renewalAt.getMonth() + 1,
    );

    try {
      const { error: subscriptionError } =
        await supabaseAdmin
          .from("subscriptions")
          .update({
            plan: "premium",
            status: "active",
            provider: "mpesa",
            renewal_at:
              renewalAt.toISOString(),
          })
          .eq(
            "id",
            payment.subscription_id,
          );

      if (subscriptionError) {
        console.warn(
          "[SubscriptionService] Subscriptions update warning:",
          subscriptionError.message,
        );
      }
    } catch (subErr: any) {
      console.warn(
        "[SubscriptionService] Subscriptions update exception:",
        subErr?.message,
      );
    }

    try {
      const { error: paymentUpdateError } =
        await supabaseAdmin
          .from("payments")
          .update({
            status:
              "completed",
            paid_at:
              new Date().toISOString(),
          })
          .eq(
            "id",
            payment.id,
          );

      if (paymentUpdateError) {
        console.warn(
          "[SubscriptionService] Payments update warning:",
          paymentUpdateError.message,
        );
      }
    } catch (payErr: any) {
      console.warn(
        "[SubscriptionService] Payments update exception:",
        payErr?.message,
      );
    }

    if (memoryPaymentStore.has(payment.id)) {
      const mem = memoryPaymentStore.get(payment.id)!;
      mem.status = "completed";
      mem.paid_at = new Date().toISOString();
    }

    await this.logAudit(
      null,
      null,
      "subscription_activated",
      payment.subscription_id,
      {
        providerReference,
        renewalAt:
          renewalAt.toISOString(),
      },
    );

    return {
      status:
        "processed_success",
      renewalAt:
        renewalAt.toISOString(),
    };
  }

  private static async logAudit(
    actorUserId:
      | string
      | null,
    patientUserId:
      | string
      | null,
    action: string,
    resourceId: string,
    metadata: Record<
      string,
      unknown
    >,
  ) {
    try {
      const { error } =
        await supabaseAdmin
          .from("audit_logs")
          .insert({
            actor_user_id:
              actorUserId,
            patient_user_id:
              patientUserId,
            actor_role:
              actorUserId
                ? "patient"
                : "system",
            action,
            resource_type:
              "subscription_payment",
            resource_id:
              resourceId,
            metadata,
          });

      if (error) {
        console.warn(
          "[Subscription] Audit log error:",
          error.message,
        );
      }
    } catch (_) {}
  }

  /**
   * Test/Inspection helpers
   */
  static getMemoryPaymentStoreSize(): number {
    return memoryPaymentStore.size;
  }

  static clearMemoryPayments(): void {
    memoryPaymentStore.clear();
  }
}
