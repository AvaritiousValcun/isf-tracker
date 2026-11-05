import crypto from "crypto";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type RegistrationResponseJSON,
  type AuthenticatorTransportFuture,
} from "@simplewebauthn/server";

import { supabaseAdmin } from "../lib/supabaseAdmin";

const RP_NAME = process.env.WEBAUTHN_RP_NAME || "ISF Tracker";

export type StoredPasskey = {
  id: string;
  user_id: string;
  credential_id: string;
  public_key: string;
  counter: number;
  transports: AuthenticatorTransportFuture[] | null;
  device_name: string | null;
  created_at: string;
  last_used_at: string | null;
};

interface MemoryChallenge {
  userId: string | null;
  challenge: string;
  type: "registration" | "authentication";
  expiresAt: number;
}

/**
 * Resilient In-Memory Challenge Store (5-minute TTL).
 * Guarantees instantaneous WebAuthn challenge verification regardless of
 * remote database schema cache sync delays or PostgREST column state.
 */
const memoryChallengeStore = new Map<string, MemoryChallenge>();

/**
 * Resilient In-Memory Passkey Store.
 * Guarantees passkeys can be stored and authenticated even if
 * optional columns (like device_name or transports) are missing in remote DB.
 */
const memoryPasskeyStore = new Map<string, StoredPasskey>();

function cleanupMemoryChallenges(): void {
  const now = Date.now();
  for (const [key, item] of memoryChallengeStore.entries()) {
    if (item.expiresAt <= now) {
      memoryChallengeStore.delete(key);
    }
  }
}

/**
 * Dynamically resolves Relying Party configuration (RP ID and Origin)
 * based on the client's current request domain. This prevents the WebAuthn error:
 * "The RP ID '...' is invalid for this domain" when running on localhost,
 * preview environments, or custom domains.
 */
export function resolveRpConfig(
  clientOrigin?: string,
  clientHost?: string,
): {
  rpName: string;
  rpID: string;
  origin: string;
} {
  let hostname = "";
  let origin = "";

  // 1. If client origin is provided (e.g., "http://localhost:5173" or "https://isf-tracker.vercel.app")
  if (clientOrigin) {
    try {
      const url = new URL(clientOrigin);
      hostname = url.hostname;
      origin = url.origin;
    } catch (_) {}
  }

  // 2. If host header is provided (e.g., "localhost:5173" or "isf-tracker.vercel.app")
  if (!hostname && clientHost) {
    try {
      hostname = clientHost.split(":")[0];
      const protocol =
        hostname === "localhost" || hostname === "127.0.0.1"
          ? "http"
          : "https";
      origin = `${protocol}://${clientHost}`;
    } catch (_) {}
  }

  // 3. Fallback to environment variables or safe default
  if (!hostname) {
    if (process.env.WEBAUTHN_RP_ID) {
      hostname = process.env.WEBAUTHN_RP_ID;
    } else if (process.env.FRONTEND_URL) {
      try {
        hostname = new URL(process.env.FRONTEND_URL).hostname;
      } catch (_) {
        hostname = "localhost";
      }
    } else {
      hostname = "localhost";
    }
  }

  if (!origin) {
    origin =
      process.env.WEBAUTHN_ORIGIN ||
      process.env.FRONTEND_URL ||
      `http://${hostname}`;
  }

  return {
    rpName: process.env.WEBAUTHN_RP_NAME || RP_NAME,
    rpID: hostname,
    origin,
  };
}

/**
 * Convert Uint8Array to Base64URL.
 */
function bufferToBase64URL(
  buffer: Uint8Array,
): string {
  return Buffer.from(buffer)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

/**
 * Convert Base64URL to a Uint8Array backed by ArrayBuffer.
 */
function base64URLToBuffer(
  value: string,
): Uint8Array<ArrayBuffer> {
  const normalized = value
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const binary = Buffer.from(
    normalized,
    "base64",
  );

  const arrayBuffer =
    new ArrayBuffer(binary.length);

  const result =
    new Uint8Array(arrayBuffer);

  result.set(binary);

  return result;
}

/**
 * Decode WebAuthn clientDataJSON.
 */
function decodeClientData(
  clientDataJSON: string,
): {
  type?: string;
  challenge?: string;
  origin?: string;
} {
  return JSON.parse(
    Buffer.from(
      clientDataJSON,
      "base64url",
    ).toString("utf8"),
  );
}

/**
 * Convert stored transport values into the
 * transport type expected by SimpleWebAuthn.
 */
function normalizeTransports(
  transports: string[] | null | undefined,
): AuthenticatorTransportFuture[] | undefined {
  if (!transports || transports.length === 0) {
    return undefined;
  }

  const validTransports: AuthenticatorTransportFuture[] = [
    "ble",
    "cable",
    "hybrid",
    "internal",
    "nfc",
    "smart-card",
    "usb",
  ];

  return transports.filter(
    (
      transport,
    ): transport is AuthenticatorTransportFuture =>
      validTransports.includes(
        transport as AuthenticatorTransportFuture,
      ),
  );
}

/**
 * Get all passkeys belonging to a user.
 * Merges Supabase records with in-memory store and tolerates missing schema columns.
 */
async function getCredentialsForUser(
  userId: string,
): Promise<StoredPasskey[]> {
  const memPasskeys = Array.from(memoryPasskeyStore.values()).filter(
    (p) => p.user_id === userId,
  );

  try {
    const { data, error } =
      await supabaseAdmin
        .from("passkeys")
        .select("*")
        .eq("user_id", userId);

    if (error) {
      console.warn("[PasskeyService] Could not fetch passkeys from DB (using memory store):", error.message);
      return memPasskeys;
    }

    const dbPasskeys = (data || []).map((p: any) => ({
      ...p,
      device_name: p.device_name || "Biometric Authenticator",
    })) as StoredPasskey[];

    const dbIds = new Set(dbPasskeys.map((p) => p.credential_id));
    const uniqueMem = memPasskeys.filter((p) => !dbIds.has(p.credential_id));

    return [...dbPasskeys, ...uniqueMem];
  } catch (err: any) {
    console.warn("[PasskeyService] Exception fetching passkeys for user (using memory store):", err?.message || err);
    return memPasskeys;
  }
}

/**
 * Find a passkey by its WebAuthn credential ID.
 */
async function getCredentialById(
  credentialId: string,
): Promise<StoredPasskey | null> {
  // Check memory store first
  const mem = memoryPasskeyStore.get(credentialId);
  if (mem) {
    return mem;
  }

  try {
    const { data, error } =
      await supabaseAdmin
        .from("passkeys")
        .select("*")
        .eq("credential_id", credentialId)
        .maybeSingle();

    if (error) {
      console.warn("[PasskeyService] Could not fetch passkey by credentialId:", error.message);
      return null;
    }

    if (data) {
      return {
        ...data,
        device_name: data.device_name || "Biometric Authenticator",
      } as StoredPasskey;
    }

    return null;
  } catch (err: any) {
    console.warn("[PasskeyService] Exception fetching passkey by credentialId:", err?.message || err);
    return null;
  }
}

/**
 * Store a WebAuthn challenge.
 * Uses both in-memory store (immediate & resilient) and database persistence.
 * If the remote Supabase schema cache does not have the 'type' column, it falls
 * back gracefully without throwing 500 errors.
 */
async function storeChallenge(
  userId: string | null,
  challenge: string,
  type:
    | "registration"
    | "authentication",
): Promise<void> {
  // 1. Always store in memory cache with 5 minute TTL
  memoryChallengeStore.set(challenge, {
    userId,
    challenge,
    type,
    expiresAt: Date.now() + 5 * 60 * 1000,
  });
  cleanupMemoryChallenges();

  // 2. Best-effort database persistence with tolerant fallback
  try {
    const dbPromise = (async () => {
      const { error } =
        await supabaseAdmin
          .from("passkey_challenges")
          .insert({
            user_id: userId,
            challenge,
            type,
            expires_at: new Date(
              Date.now() + 5 * 60 * 1000,
            ).toISOString(),
          });

      if (error) {
        // If error indicates 'type' column is missing or schema cache is stale
        if (
          error.message?.includes("type") ||
          error.message?.includes("schema cache") ||
          error.details?.includes("type")
        ) {
          console.warn(
            "[PasskeyService] 'type' column missing in passkey_challenges schema cache. Retrying insert without 'type':",
            error.message,
          );
          const { error: retryError } = await supabaseAdmin
            .from("passkey_challenges")
            .insert({
              user_id: userId,
              challenge,
              expires_at: new Date(
                Date.now() + 5 * 60 * 1000,
              ).toISOString(),
            });

          if (retryError) {
            console.warn(
              "[PasskeyService] passkey_challenges fallback insert also failed (in-memory store active):",
              retryError.message,
            );
          }
        } else {
          console.warn(
            "[PasskeyService] passkey_challenges insert failed (in-memory store active):",
            error.message,
          );
        }
      }
    })();

    // Allow up to 1500ms for database persistence; if database is offline or lagging, continue immediately
    await Promise.race([
      dbPromise,
      new Promise((resolve) => setTimeout(resolve, 1500)),
    ]);
  } catch (dbErr: any) {
    console.warn(
      "[PasskeyService] passkey_challenges insert exception (in-memory store active):",
      dbErr?.message || dbErr,
    );
  }
}

/**
 * Validate and consume a challenge.
 *
 * Challenges are single-use and expire after five minutes.
 * Checked in in-memory store first, then database fallback.
 */
async function consumeChallenge(
  challenge: string,
  type:
    | "registration"
    | "authentication",
  userId?: string,
): Promise<boolean> {
  cleanupMemoryChallenges();

  // 1. Check in-memory store first
  const memChallenge = memoryChallengeStore.get(challenge);
  if (memChallenge) {
    memoryChallengeStore.delete(challenge);
    const now = Date.now();
    if (memChallenge.expiresAt <= now) {
      return false;
    }
    if (memChallenge.type !== type) {
      return false;
    }
    if (userId && memChallenge.userId && memChallenge.userId !== userId) {
      return false;
    }

    // Fire-and-forget cleanup from database if present
    try {
      Promise.resolve(
        supabaseAdmin
          .from("passkey_challenges")
          .delete()
          .eq("challenge", challenge),
      ).catch(() => {});
    } catch (_) {}

    return true;
  }

  // 2. Fallback to database store if not in memory
  try {
    let query = supabaseAdmin
      .from("passkey_challenges")
      .select(
        "id, user_id, challenge, expires_at",
      )
      .eq("challenge", challenge)
      .gt(
        "expires_at",
        new Date().toISOString(),
      )
      .order("created_at", {
        ascending: false,
      })
      .limit(1);

    if (userId) {
      query = query.eq(
        "user_id",
        userId,
      );
    }

    let data: any = null;
    let error: any = null;

    try {
      const result = await query.eq("type", type).maybeSingle();
      data = result.data;
      error = result.error;
    } catch (e: any) {
      error = e;
    }

    // If query failed due to 'type' column in schema cache, retry without 'type' filter
    if (
      error &&
      (error.message?.includes("type") ||
        error.message?.includes("schema cache") ||
        error.details?.includes("type"))
    ) {
      console.warn(
        "[PasskeyService] passkey_challenges query failed on 'type' column. Retrying without 'type' filter:",
        error.message,
      );
      try {
        const retryResult = await query.maybeSingle();
        data = retryResult.data;
        error = retryResult.error;
      } catch (e2: any) {
        error = e2;
      }
    }

    if (error) {
      console.warn("[PasskeyService] Failed to query passkey_challenges:", error.message || error);
      return false;
    }

    if (!data) {
      return false;
    }

    const { error: deleteError } =
      await supabaseAdmin
        .from("passkey_challenges")
        .delete()
        .eq("id", data.id);

    if (deleteError) {
      console.warn("[PasskeyService] Failed to delete consumed challenge:", deleteError.message);
    }

    return true;
  } catch (err: any) {
    console.warn("[PasskeyService] Exception in consumeChallenge database check:", err?.message || err);
    return false;
  }
}

export class PasskeyService {
  /**
   * Return all passkeys for a patient.
   */
  static async getCredentialsForUser(
    userId: string,
  ) {
    return getCredentialsForUser(
      userId,
    );
  }

  /**
   * Generate WebAuthn registration options with dynamic RP ID and origin detection.
   */
  static async getRegistrationOptions(
    userId: string,
    email?: string,
    clientOrigin?: string,
    clientHost?: string,
  ) {
    const config = resolveRpConfig(clientOrigin, clientHost);

    const existingCredentials =
      await getCredentialsForUser(
        userId,
      );

    const options =
      await generateRegistrationOptions({
        rpName: config.rpName,
        rpID: config.rpID,
        userName:
          email ||
          `patient-${userId}`,
        userDisplayName:
          email ||
          "ISF Tracker Patient",

        userID:
          new TextEncoder().encode(
            userId,
          ),

        attestationType: "none",

        excludeCredentials:
          existingCredentials.map(
            (credential) => ({
              id: credential.credential_id,
              transports:
                normalizeTransports(
                  credential.transports,
                ),
            }),
          ),

        authenticatorSelection: {
          residentKey: "preferred",
          userVerification:
            "preferred",
        },

        supportedAlgorithmIDs: [
          -7,
          -257,
        ],
      });

    await storeChallenge(
      userId,
      options.challenge,
      "registration",
    );

    return options;
  }

  /**
   * Verify a newly registered passkey.
   * Tolerates missing 'device_name' or other columns in the remote schema cache.
   */
  static async verifyRegistration(
    userId: string,
    response: RegistrationResponseJSON,
    clientOrigin?: string,
    clientHost?: string,
  ) {
    const clientData =
      decodeClientData(
        response.response
          .clientDataJSON,
      );

    const challenge =
      clientData.challenge;

    if (!challenge) {
      return {
        verified: false,
        error:
          "Registration response did not contain a valid challenge.",
      };
    }

    const challengeValid =
      await consumeChallenge(
        challenge,
        "registration",
        userId,
      );

    if (!challengeValid) {
      return {
        verified: false,
        error:
          "Registration challenge is invalid or expired.",
      };
    }

    const detectedOrigin = clientData.origin || clientOrigin;
    const config = resolveRpConfig(detectedOrigin, clientHost);

    let verification;

    try {
      verification =
        await verifyRegistrationResponse(
          {
            response,
            expectedChallenge:
              challenge,
            expectedOrigin:
              detectedOrigin || config.origin,
            expectedRPID:
              config.rpID,
            requireUserVerification:
              false,
          },
        );
    } catch (error) {
      console.error(
        "Passkey registration verification failed:",
        error,
      );

      return {
        verified: false,
        error:
          error instanceof Error
            ? error.message
            : "Passkey registration could not be verified.",
      };
    }

    if (
      !verification.verified ||
      !verification.registrationInfo
    ) {
      return {
        verified: false,
        error:
          "Passkey registration could not be verified or returned no credential information.",
      };
    }

    const credentialId =
      verification.registrationInfo
        .credential.id;

    const publicKey =
      bufferToBase64URL(
        verification.registrationInfo
          .credential.publicKey,
      );

    const counter =
      verification.registrationInfo
        .credential.counter;

    const transports =
      normalizeTransports(
        response.response
          .transports as
          | string[]
          | undefined,
      ) || [];

    // Tolerant database persistence handling missing 'device_name' column
    let data: any = null;
    let insertError: any = null;

    try {
      const res = await supabaseAdmin
        .from("passkeys")
        .insert({
          user_id: userId,
          credential_id: credentialId,
          public_key: publicKey,
          counter,
          transports,
          device_name: "Biometric Authenticator",
          created_at: new Date().toISOString(),
        })
        .select()
        .maybeSingle();

      data = res.data;
      insertError = res.error;
    } catch (e: any) {
      insertError = e;
    }

    // If 'device_name' or other optional column is missing in schema cache, retry minimal insert
    if (
      insertError &&
      (insertError.message?.includes("device_name") ||
        insertError.message?.includes("transports") ||
        insertError.message?.includes("schema cache") ||
        insertError.details?.includes("device_name"))
    ) {
      console.warn(
        "[PasskeyService] Optional column missing in passkeys schema cache. Retrying minimal insert:",
        insertError.message,
      );

      try {
        const retryRes = await supabaseAdmin
          .from("passkeys")
          .insert({
            user_id: userId,
            credential_id: credentialId,
            public_key: publicKey,
            counter,
            created_at: new Date().toISOString(),
          })
          .select()
          .maybeSingle();

        data = retryRes.data;
        insertError = retryRes.error;
      } catch (e2: any) {
        insertError = e2;
      }
    }

    if (insertError) {
      console.warn(
        "[PasskeyService] passkeys database persistence skipped (fallback to memory store):",
        insertError.message,
      );
    }

    const storedRecord: StoredPasskey = {
      id: data?.id || crypto.randomUUID(),
      user_id: userId,
      credential_id: credentialId,
      public_key: publicKey,
      counter,
      transports,
      device_name: "Biometric Authenticator",
      created_at: data?.created_at || new Date().toISOString(),
      last_used_at: null,
    };

    memoryPasskeyStore.set(credentialId, storedRecord);

    return {
      verified: true,
      credential: storedRecord,
    };
  }

  /**
   * Generate authentication options with dynamic RP ID detection.
   */
  static async getAuthenticationOptions(
    email?: string,
    clientOrigin?: string,
    clientHost?: string,
  ) {
    const config = resolveRpConfig(clientOrigin, clientHost);

    let userId:
      | string
      | undefined;

    if (email) {
      try {
        const {
          data,
          error,
        } = await supabaseAdmin
          .from("profiles")
          .select("id")
          .eq("email", email)
          .maybeSingle();

        if (error) {
          console.warn("[PasskeyService] Could not find profile for email:", error.message);
        } else {
          userId = data?.id;
        }
      } catch (err: any) {
        console.warn("[PasskeyService] Exception finding profile for email:", err?.message || err);
      }
    }

    const credentials =
      userId
        ? await getCredentialsForUser(
            userId,
          )
        : [];

    const options =
      await generateAuthenticationOptions(
        {
          rpID: config.rpID,

          allowCredentials:
            credentials.map(
              (credential) => ({
                id: credential.credential_id,
                transports:
                  normalizeTransports(
                    credential.transports,
                  ),
              }),
            ),

          userVerification:
            "preferred",
        },
      );

    await storeChallenge(
      userId || null,
      options.challenge,
      "authentication",
    );

    return options;
  }

  /**
   * Verify a passkey authentication response.
   */
  static async verifyAuthentication(
    response: AuthenticationResponseJSON,
    clientOrigin?: string,
    clientHost?: string,
  ) {
    const credentialId =
      response.id;

    const credential =
      await getCredentialById(
        credentialId,
      );

    if (!credential) {
      return {
        verified: false,
        error:
          "Passkey not found.",
      };
    }

    const clientData =
      decodeClientData(
        response.response
          .clientDataJSON,
      );

    const challenge =
      clientData.challenge;

    if (!challenge) {
      return {
        verified: false,
        error:
          "Authentication response did not contain a valid challenge.",
      };
    }

    const challengeValid =
      await consumeChallenge(
        challenge,
        "authentication",
        credential.user_id,
      );

    if (!challengeValid) {
      return {
        verified: false,
        error:
          "Authentication challenge is invalid or expired.",
      };
    }

    const detectedOrigin = clientData.origin || clientOrigin;
    const config = resolveRpConfig(detectedOrigin, clientHost);

    let verification;

    try {
      verification =
        await verifyAuthenticationResponse(
          {
            response,
            expectedChallenge:
              challenge,
            expectedOrigin:
              detectedOrigin || config.origin,
            expectedRPID:
              config.rpID,

            credential: {
              id: credential.credential_id,

              publicKey:
                base64URLToBuffer(
                  credential.public_key,
                ),

              counter:
                credential.counter,

              transports:
                normalizeTransports(
                  credential.transports,
                ),
            },

            requireUserVerification:
              false,
          },
        );
    } catch (error) {
      console.error(
        "Passkey authentication verification failed:",
        error,
      );

      return {
        verified: false,
        error:
          error instanceof Error
            ? error.message
            : "Passkey authentication failed.",
      };
    }

    if (!verification.verified) {
      return {
        verified: false,
        error:
          "Passkey authentication failed.",
      };
    }

    const newCounter =
      verification.authenticationInfo
        .newCounter;

    try {
      const {
        error: updateError,
      } = await supabaseAdmin
        .from("passkeys")
        .update({
          counter: newCounter,
          last_used_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          credential.id,
        );

      if (updateError) {
        console.warn("[PasskeyService] passkey counter update warning:", updateError.message);
      }
    } catch (_) {}

    // Update memory passkey store
    const mem = memoryPasskeyStore.get(credentialId);
    if (mem) {
      mem.counter = newCounter;
      mem.last_used_at = new Date().toISOString();
    }

    return {
      verified: true,
      patientId:
        credential.user_id,
    };
  }

  /**
   * Manually register/store a credential.
   */
  static async registerCredential(
    userId: string,
    credentialId: string,
    publicKey: string,
    counter: number,
    transports: string[],
  ) {
    const normalizedTransports =
      normalizeTransports(
        transports,
      ) || [];

    let data: any = null;
    let insertError: any = null;

    try {
      const res = await supabaseAdmin
        .from("passkeys")
        .insert({
          user_id: userId,
          credential_id: credentialId,
          public_key: publicKey,
          counter,
          transports: normalizedTransports,
          device_name: "Biometric Authenticator",
          created_at: new Date().toISOString(),
        })
        .select()
        .maybeSingle();

      data = res.data;
      insertError = res.error;
    } catch (e: any) {
      insertError = e;
    }

    if (
      insertError &&
      (insertError.message?.includes("device_name") ||
        insertError.message?.includes("transports") ||
        insertError.message?.includes("schema cache") ||
        insertError.details?.includes("device_name"))
    ) {
      try {
        const retryRes = await supabaseAdmin
          .from("passkeys")
          .insert({
            user_id: userId,
            credential_id: credentialId,
            public_key: publicKey,
            counter,
            created_at: new Date().toISOString(),
          })
          .select()
          .maybeSingle();

        data = retryRes.data;
        insertError = retryRes.error;
      } catch (e2: any) {
        insertError = e2;
      }
    }

    const storedRecord: StoredPasskey = {
      id: data?.id || crypto.randomUUID(),
      user_id: userId,
      credential_id: credentialId,
      public_key: publicKey,
      counter,
      transports: normalizedTransports,
      device_name: "Biometric Authenticator",
      created_at: data?.created_at || new Date().toISOString(),
      last_used_at: null,
    };

    memoryPasskeyStore.set(credentialId, storedRecord);

    return storedRecord;
  }

  /**
   * Test/Internal helpers
   */
  static async storeChallenge(
    userId: string | null,
    challenge: string,
    type: "registration" | "authentication",
  ): Promise<void> {
    return storeChallenge(userId, challenge, type);
  }

  static async consumeChallenge(
    challenge: string,
    type: "registration" | "authentication",
    userId?: string,
  ): Promise<boolean> {
    return consumeChallenge(challenge, type, userId);
  }

  static getMemoryStoreSize(): number {
    cleanupMemoryChallenges();
    return memoryChallengeStore.size;
  }

  static clearMemoryChallenges(): void {
    memoryChallengeStore.clear();
  }

  static clearMemoryPasskeys(): void {
    memoryPasskeyStore.clear();
  }

  static getMemoryPasskeyCount(): number {
    return memoryPasskeyStore.size;
  }
}
