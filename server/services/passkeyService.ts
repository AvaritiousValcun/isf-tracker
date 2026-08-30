
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type RegistrationResponseJSON,
  type AuthenticatorTransportFuture,
} from "@simplewebauthn/server";

import { supabaseAdmin } from "../lib/supabaseAdmin.js";

const RP_NAME = process.env.WEBAUTHN_RP_NAME || "ISF Tracker";

const RP_ID =
  process.env.WEBAUTHN_RP_ID ||
  new URL(
    process.env.FRONTEND_URL || "http://localhost:5173",
  ).hostname;

const ORIGIN =
  process.env.WEBAUTHN_ORIGIN ||
  process.env.FRONTEND_URL ||
  "http://localhost:5173";

type StoredPasskey = {
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
 */
async function getCredentialsForUser(
  userId: string,
): Promise<StoredPasskey[]> {
  const { data, error } =
    await supabaseAdmin
      .from("passkeys")
      .select("*")
      .eq("user_id", userId);

  if (error) {
    throw error;
  }

  return (data || []) as StoredPasskey[];
}

/**
 * Find a passkey by its WebAuthn credential ID.
 */
async function getCredentialById(
  credentialId: string,
): Promise<StoredPasskey | null> {
  const { data, error } =
    await supabaseAdmin
      .from("passkeys")
      .select("*")
      .eq("credential_id", credentialId)
      .maybeSingle();

  if (error) {
    throw error;
  }

  return data as StoredPasskey | null;
}

/**
 * Store a WebAuthn challenge.
 */
async function storeChallenge(
  userId: string | null,
  challenge: string,
  type:
    | "registration"
    | "authentication",
): Promise<void> {
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
    throw error;
  }
}

/**
 * Validate and consume a challenge.
 *
 * Challenges are single-use and expire
 * after five minutes.
 */
async function consumeChallenge(
  challenge: string,
  type:
    | "registration"
    | "authentication",
  userId?: string,
): Promise<boolean> {
  let query = supabaseAdmin
    .from("passkey_challenges")
    .select(
      "id, user_id, challenge, expires_at",
    )
    .eq("challenge", challenge)
    .eq("type", type)
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

  const { data, error } =
    await query.maybeSingle();

  if (error) {
    throw error;
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
    throw deleteError;
  }

  return true;
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
   * Generate WebAuthn registration options.
   */
  static async getRegistrationOptions(
    userId: string,
    email?: string,
  ) {
    const existingCredentials =
      await getCredentialsForUser(
        userId,
      );

    const options =
      await generateRegistrationOptions({
        rpName: RP_NAME,
        rpID: RP_ID,
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
   */
  static async verifyRegistration(
    userId: string,
    response: RegistrationResponseJSON,
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

    let verification;

    try {
      verification =
        await verifyRegistrationResponse(
          {
            response,
            expectedChallenge:
              challenge,
            expectedOrigin:
              ORIGIN,
            expectedRPID:
              RP_ID,
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

    const {
      data,
      error,
    } = await supabaseAdmin
      .from("passkeys")
      .insert({
        user_id: userId,
        credential_id:
          credentialId,
        public_key: publicKey,
        counter,
        transports,
        device_name:
          "Biometric Authenticator",
        created_at:
          new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return {
      verified: true,
      credential: data,
    };
  }

  /**
   * Generate authentication options.
   */
  static async getAuthenticationOptions(
    email?: string,
  ) {
    let userId:
      | string
      | undefined;

    if (email) {
      const {
        data,
        error,
      } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("email", email)
        .maybeSingle();

      if (error) {
        throw error;
      }

      userId = data?.id;
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
          rpID: RP_ID,

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

    let verification;

    try {
      verification =
        await verifyAuthenticationResponse(
          {
            response,
            expectedChallenge:
              challenge,
            expectedOrigin:
              ORIGIN,
            expectedRPID:
              RP_ID,

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
      throw updateError;
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

    const {
      data,
      error,
    } = await supabaseAdmin
      .from("passkeys")
      .insert({
        user_id: userId,
        credential_id:
          credentialId,
        public_key: publicKey,
        counter,
        transports:
          normalizedTransports,
        device_name:
          "Biometric Authenticator",
        created_at:
          new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  }
}

