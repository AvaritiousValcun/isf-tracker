import { describe, it, expect, beforeEach, vi } from "vitest";
import { PasskeyService, resolveRpConfig } from "./passkeyService";
import { supabaseAdmin } from "../lib/supabaseAdmin";

describe("PasskeyService Resilient Challenge and PostgREST Schema Fallback", () => {
  beforeEach(() => {
    PasskeyService.clearMemoryChallenges();
    vi.restoreAllMocks();

    // Default mock for supabaseAdmin to prevent external network calls during unit tests
    vi.spyOn(supabaseAdmin, "from").mockImplementation((table: string) => {
      return {
        insert: vi.fn().mockResolvedValue({ data: { id: "mock-id" }, error: null }),
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnThis(),
          gt: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          single: vi.fn().mockResolvedValue({ data: { id: "mock-id" }, error: null }),
        }),
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      } as any;
    });
  });

  describe("Dynamic RP ID & Origin Resolution", () => {
    it("correctly resolves localhost when client visits from local development port", () => {
      const config = resolveRpConfig("http://localhost:5173");
      expect(config.rpID).toBe("localhost");
      expect(config.origin).toBe("http://localhost:5173");
    });

    it("correctly resolves production Vercel domain when client visits from vercel.app", () => {
      const config = resolveRpConfig("https://isf-tracker.vercel.app");
      expect(config.rpID).toBe("isf-tracker.vercel.app");
      expect(config.origin).toBe("https://isf-tracker.vercel.app");
    });

    it("correctly resolves preview deployment domain from host header", () => {
      const config = resolveRpConfig(undefined, "isf-tracker-preview-git-test.vercel.app");
      expect(config.rpID).toBe("isf-tracker-preview-git-test.vercel.app");
      expect(config.origin).toBe("https://isf-tracker-preview-git-test.vercel.app");
    });

    it("generates options with dynamic rp.id matching client origin to avoid domain invalid errors", async () => {
      const userId = "00000000-0000-4000-a000-000000000001";
      const localOptions = await PasskeyService.getRegistrationOptions(
        userId,
        "test@example.com",
        "http://localhost:5173",
      );
      expect(localOptions.rp.id).toBe("localhost");

      const vercelOptions = await PasskeyService.getRegistrationOptions(
        userId,
        "test@example.com",
        "https://isf-tracker.vercel.app",
      );
      expect(vercelOptions.rp.id).toBe("isf-tracker.vercel.app");
    });
  });

  describe("In-Memory Challenge Management", () => {
    it("successfully stores and consumes a registration challenge", async () => {
      const challenge = "test-challenge-registration-123";
      const userId = "00000000-0000-4000-a000-000000000001";

      await PasskeyService.storeChallenge(userId, challenge, "registration");
      expect(PasskeyService.getMemoryStoreSize()).toBeGreaterThanOrEqual(1);

      const consumed = await PasskeyService.consumeChallenge(
        challenge,
        "registration",
        userId,
      );
      expect(consumed).toBe(true);

      // Challenge is single-use; subsequent consumption should fail
      const secondConsume = await PasskeyService.consumeChallenge(
        challenge,
        "registration",
        userId,
      );
      expect(secondConsume).toBe(false);
    });

    it("successfully stores and consumes an authentication challenge without user ID", async () => {
      const challenge = "test-challenge-auth-456";

      await PasskeyService.storeChallenge(null, challenge, "authentication");
      const consumed = await PasskeyService.consumeChallenge(
        challenge,
        "authentication",
      );
      expect(consumed).toBe(true);
    });

    it("rejects challenge consumption if type does not match", async () => {
      const challenge = "test-challenge-mismatch-789";
      const userId = "00000000-0000-4000-a000-000000000001";

      await PasskeyService.storeChallenge(userId, challenge, "registration");

      // Trying to consume as authentication
      const consumed = await PasskeyService.consumeChallenge(
        challenge,
        "authentication",
        userId,
      );
      expect(consumed).toBe(false);
    });

    it("rejects challenge consumption if user ID does not match", async () => {
      const challenge = "test-challenge-user-mismatch-101";
      const userA = "00000000-0000-4000-a000-000000000001";
      const userB = "00000000-0000-4000-a000-000000000002";

      await PasskeyService.storeChallenge(userA, challenge, "registration");

      const consumed = await PasskeyService.consumeChallenge(
        challenge,
        "registration",
        userB,
      );
      expect(consumed).toBe(false);
    });
  });

  describe("Tolerance to Supabase Schema Cache & Missing Column Errors", () => {
    it("handles PostgREST 'Could not find the type column' error without failing challenge storage or consumption", async () => {
      let insertAttemptedWithoutType = false;

      // Mock supabaseAdmin insert to simulate the exact PostgREST schema cache error reported by user
      vi.spyOn(supabaseAdmin, "from").mockImplementation((table: string) => {
        if (table === "passkey_challenges") {
          return {
            insert: vi.fn().mockImplementation((payload: any) => {
              if (payload.type) {
                return Promise.resolve({
                  error: {
                    message: "Could not find the 'type' column of 'passkey_challenges' in the schema cache",
                    code: "PGRST204",
                  },
                });
              }
              // Fallback insert without type succeeds
              insertAttemptedWithoutType = true;
              return Promise.resolve({ data: { id: "mock-id" }, error: null });
            }),
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnThis(),
              gt: vi.fn().mockReturnThis(),
              order: vi.fn().mockReturnThis(),
              limit: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({
                data: null,
                error: {
                  message: "Could not find the 'type' column of 'passkey_challenges' in the schema cache",
                },
              }),
            }),
            delete: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          } as any;
        }
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        } as any;
      });

      const challenge = "resilient-schema-cache-challenge-999";
      const userId = "00000000-0000-4000-a000-000000000001";

      // Should not throw even though DB returned the schema cache error!
      await expect(
        PasskeyService.storeChallenge(userId, challenge, "registration"),
      ).resolves.not.toThrow();

      expect(insertAttemptedWithoutType).toBe(true);

      // Should consume successfully via resilient in-memory store
      const consumed = await PasskeyService.consumeChallenge(
        challenge,
        "registration",
        userId,
      );
      expect(consumed).toBe(true);
    });

    it("generates registration options without throwing when schema cache has issues", async () => {
      const userId = "00000000-0000-4000-a000-000000000001";
      const email = "patient@example.com";

      const options = await PasskeyService.getRegistrationOptions(userId, email);
      expect(options).toBeDefined();
      expect(options.challenge).toBeTruthy();
      expect(options.rp.name).toBe("ISF Tracker");
      expect(options.user.name).toBe(email);

      // Verify that the generated challenge is stored and consumable
      const isChallengeValid = await PasskeyService.consumeChallenge(
        options.challenge,
        "registration",
        userId,
      );
      expect(isChallengeValid).toBe(true);
    });

    it("generates authentication options without throwing", async () => {
      const options = await PasskeyService.getAuthenticationOptions();
      expect(options).toBeDefined();
      expect(options.challenge).toBeTruthy();

      const isChallengeValid = await PasskeyService.consumeChallenge(
        options.challenge,
        "authentication",
      );
      expect(isChallengeValid).toBe(true);
    });
  });
});
