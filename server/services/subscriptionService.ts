
import { supabaseAdmin } from "../lib/supabaseAdmin";
import {
  createPaymentProvider,
  type PaymentProvider,
} from "./paymentProvider";

const paymentProvider: PaymentProvider =
  createPaymentProvider();

const PREMIUM_PRICE_KES = 250;

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

    const { data: payment, error } =
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
        .single();

    if (error) {
      throw error;
    }

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

    const { data: payment, error } =
      await supabaseAdmin
        .from("payments")
        .select("*, subscriptions!inner(patient_user_id)")
        .eq("id", paymentId)
        .maybeSingle();

    if (error) {
      throw error;
    }

    if (!payment || payment.subscriptions?.patient_user_id !== patientUserId) {
      throw new Error("Payment not found.");
    }

    return this.activatePremiumFromPayment(
      payment,
      payment.provider_reference,
      true,
    );
  }

  static async handleWebhook(
    providerReference: string,
    status:
      | "completed"
      | "failed",
  ) {
    const { data: payment, error } =
      await supabaseAdmin
        .from("payments")
        .select("*")
        .eq(
          "provider_reference",
          providerReference,
        )
        .maybeSingle();

    if (error) {
      throw error;
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
      const { error: updateError } =
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

      if (updateError) {
        throw updateError;
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
      throw subscriptionError;
    }

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
      throw paymentUpdateError;
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
      console.error(
        "[Subscription] Audit log error:",
        error,
      );
    }
  }
}

