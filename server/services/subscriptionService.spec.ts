import { describe, it, expect, beforeEach, vi } from "vitest";
import { SubscriptionService } from "./subscriptionService";
import { supabaseAdmin } from "../lib/supabaseAdmin";

describe("SubscriptionService Resilient Payment & Schema Handling", () => {
  const patientUserId = "00000000-0000-4000-a000-000000000001";
  const mockSubscription = {
    id: "sub-12345",
    patient_user_id: patientUserId,
    plan: "free",
    status: "free",
    renewal_at: null,
  };

  beforeEach(() => {
    SubscriptionService.clearMemoryPayments();
    vi.restoreAllMocks();

    vi.spyOn(supabaseAdmin, "from").mockImplementation((table: string) => {
      if (table === "subscriptions") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: mockSubscription,
                error: null,
              }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        } as any;
      }

      if (table === "payments") {
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: "payment-db-999",
                  subscription_id: mockSubscription.id,
                  provider: "mpesa",
                  provider_reference: "WS-REF-123",
                  amount: 250,
                  currency: "KES",
                  status: "pending",
                },
                error: null,
              }),
            }),
          }),
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: "payment-db-999",
                  subscription_id: mockSubscription.id,
                  provider_reference: "WS-REF-123",
                  subscriptions: { patient_user_id: patientUserId },
                },
                error: null,
              }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        } as any;
      }

      return {
        insert: vi.fn().mockResolvedValue({ error: null }),
      } as any;
    });
  });

  it("successfully creates a checkout session and stores in memory cache", async () => {
    const checkout = await SubscriptionService.createCheckout(patientUserId, "254712345678");

    expect(checkout).toBeDefined();
    expect(checkout.paymentId).toBeTruthy();
    expect(checkout.amount).toBe(250);
    expect(checkout.currency).toBe("KES");
    expect(SubscriptionService.getMemoryPaymentStoreSize()).toBeGreaterThanOrEqual(1);
  });

  it("tolerates PostgREST 'Could not find the provider column' error without failing checkout", async () => {
    let fallbackAttempted = false;

    vi.spyOn(supabaseAdmin, "from").mockImplementation((table: string) => {
      if (table === "subscriptions") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: mockSubscription,
                error: null,
              }),
            }),
          }),
        } as any;
      }

      if (table === "payments") {
        return {
          insert: vi.fn().mockImplementation((payload: any) => {
            if (payload.provider) {
              return {
                select: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: null,
                    error: {
                      message: "Could not find the 'provider' column of 'payments' in the schema cache",
                      code: "PGRST204",
                    },
                  }),
                }),
              };
            }
            // Fallback insert without provider
            fallbackAttempted = true;
            return {
              select: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: "payment-fallback-111",
                    subscription_id: mockSubscription.id,
                    provider_reference: payload.provider_reference,
                    amount: 250,
                    currency: "KES",
                    status: "pending",
                  },
                  error: null,
                }),
              }),
            };
          }),
        } as any;
      }

      return {
        insert: vi.fn().mockResolvedValue({ error: null }),
      } as any;
    });

    const checkout = await SubscriptionService.createCheckout(patientUserId, "254700000000");

    expect(checkout).toBeDefined();
    expect(checkout.paymentId).toBe("payment-fallback-111");
    expect(fallbackAttempted).toBe(true);
  });

  it("completes mock payment successfully and activates premium", async () => {
    const checkout = await SubscriptionService.createCheckout(patientUserId, "254712345678");
    const result = await SubscriptionService.completeMockPayment(patientUserId, checkout.paymentId);

    expect(result.status).toBe("processed_success");
    expect(result.renewalAt).toBeDefined();
  });
});
