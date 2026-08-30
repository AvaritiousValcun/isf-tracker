
/**
 * ISF Tracker
 *
 * Canonical shared API/data contracts.
 *
 * This file is shared between the client and server.
 *
 * It contains:
 * 1. Canonical application data models
 * 2. API request/response contracts
 * 3. The canonical frontend API client
 *
 * IMPORTANT:
 * Database access belongs on the server.
 * The frontend must communicate with the backend through `api`.
 */

/* =========================================================
   API CLIENT
========================================================= */

type ApiRequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
};

async function getAccessToken(): Promise<string | null> {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const { supabase } = await import("../client/lib/supabase");
    const {
      data: { session },
    } = await supabase.auth.getSession();

    return session?.access_token ?? null;
  } catch {
    return null;
  }
}

async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const {
    method = "GET",
    body,
    headers = {},
  } = options;

  const token = await getAccessToken();

  const response = await fetch(path, {
    method,
    credentials: "include",
    headers: {
      ...(body !== undefined
        ? { "Content-Type": "application/json" }
        : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    ...(body !== undefined
      ? { body: JSON.stringify(body) }
      : {}),
  });

  let payload: unknown = null;

  const contentType =
    response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    payload = await response.json();
  } else {
    const text = await response.text();

    payload = text || null;
  }

  if (!response.ok) {
    let message = `Request failed with status ${response.status}.`;

    if (
      typeof payload === "object" &&
      payload !== null
    ) {
      const record = payload as {
        message?: unknown;
        error?: unknown;
      };

      if (typeof record.message === "string") {
        message = record.message;
      } else if (typeof record.error === "string") {
        message = record.error;
      }
    } else if (typeof payload === "string" && payload) {
      message = payload;
    }

    throw new Error(message);
  }

  return payload as T;
}

/**
 * Canonical frontend API client.
 *
 * All frontend API calls should go through this object.
 */
export const api = {
  get<T = unknown>(path: string): Promise<T> {
    return apiRequest<T>(path, {
      method: "GET",
    });
  },

  post<T = unknown>(
    path: string,
    body?: unknown,
  ): Promise<T> {
    return apiRequest<T>(path, {
      method: "POST",
      body,
    });
  },

  put<T = unknown>(
    path: string,
    body?: unknown,
  ): Promise<T> {
    return apiRequest<T>(path, {
      method: "PUT",
      body,
    });
  },

  patch<T = unknown>(
    path: string,
    body?: unknown,
  ): Promise<T> {
    return apiRequest<T>(path, {
      method: "PATCH",
      body,
    });
  },

  delete<T = unknown>(
    path: string,
  ): Promise<T> {
    return apiRequest<T>(path, {
      method: "DELETE",
    });
  },
};

/* =========================================================
   COMMON
========================================================= */

export type Language =
  | "en"
  | "sw";

export type SubscriptionPlan =
  | "free"
  | "premium";

export type SubscriptionStatus =
  | "free"
  | "active"
  | "cancelled"
  | "expired";

export type ConsentStatus =
  | "not-granted"
  | "granted"
  | "revoked";

export type MessageSenderType =
  | "patient"
  | "consultant"
  | "system"
  | "automated_alert";

/* =========================================================
   DEMO
========================================================= */

export interface DemoResponse {
  message: string;
}

/* =========================================================
   PATIENT PROFILE
========================================================= */

export interface PatientProfile {
  id: string;

  user_id: string;

  full_name: string;

  date_of_birth:
    | string
    | null;

  language: Language;

  timezone: string;

  weight_kg:
    | number
    | null;

  patient_reference:
    | string
    | null;

  created_at: string;

  updated_at: string;
}

/* =========================================================
   CONSULTANTS
========================================================= */

export interface ConsultantSummary {
  id: string;

  full_name: string;

  professional_type: string;

  initials: string;

  color: string;

  online: boolean;

  status: string;

  consent_status:
    | ConsentStatus
    | string;

  consent_scope:
    | Record<string, boolean>
    | null;

  relationship_id: string;

  relationship_status: string;

  started_at: string;
}

/* =========================================================
   CONSENT
========================================================= */

export interface ConsentRecord {
  id: string;

  patient_user_id: string;

  consultant_id:
    | string
    | null;

  purpose:
    | "consultant_access"
    | "predictive_analysis";

  scope: Record<string, boolean>;

  status: string;

  consent_version: string;

  granted_at:
    | string
    | null;

  revoked_at:
    | string
    | null;

  created_at: string;

  updated_at: string;
}

export interface ConsentRequest {
  scope?: Record<string, boolean>;
}

/* =========================================================
   HORMONE READINGS
========================================================= */

export interface HormoneReading {
  id: string;

  patient_user_id: string;

  androgen_value: number;

  progesterone_value: number;

  units: string;

  recorded_at: string;

  quality_status:
    | string
    | null;

  battery_percent:
    | number
    | null;

  created_at:
    | string
    | null;
}

/* =========================================================
   PATCH
========================================================= */

export interface PatchDevice {
  id: string;

  device_identifier: string;

  battery_percent:
    | number
    | null;

  connected: boolean;

  status: string;

  last_seen_at:
    | string
    | null;

  created_at:
    | string
    | null;

  updated_at:
    | string
    | null;
}

export interface PatientPatch {
  id: string;

  patient_user_id: string;

  patch_id: string;

  assignment_status: string;

  assigned_at: string;

  activated_at:
    | string
    | null;

  replacement_due_at:
    | string
    | null;

  device_identifier:
    | string
    | null;

  battery_percent:
    | number
    | null;

  connected: boolean;

  status: string;

  last_seen_at:
    | string
    | null;

  patch:
    | PatchDevice
    | null;
}

/* =========================================================
   CONVERSATIONS
========================================================= */

export interface Conversation {
  id: string;

  patient_user_id: string;

  consultant_id: string;

  status: string;

  created_at: string;

  updated_at: string;
}

/* =========================================================
   MESSAGES
========================================================= */

export interface ChatMessage {
  id: string;

  conversation_id: string;

  sender_type:
    MessageSenderType;

  sender_id:
    | string
    | null;

  message_type: string;

  body: string;

  metadata:
    | Record<string, unknown>
    | null;

  created_at: string;

  read_at:
    | string
    | null;
}

export interface MessageRequest {
  conversationId: string;

  message: string;
}

/* =========================================================
   SUBSCRIPTION
========================================================= */

export interface Subscription {
  id: string;

  patient_user_id: string;

  plan: SubscriptionPlan;

  status: SubscriptionStatus;

  provider:
    | string
    | null;

  renewal_at:
    | string
    | null;

  created_at: string;

  updated_at: string;
}

export interface SubscriptionRequest {
  plan: SubscriptionPlan;
}

export interface CheckoutResponse {
  providerReference: string;

  paymentId: string;

  subscriptionId: string;

  [key: string]:
    | string
    | number
    | boolean
    | null
    | undefined;
}

/* =========================================================
   PREDICTIVE CONSENT
========================================================= */

export interface PredictiveConsent {
  id: string;

  patient_user_id: string;

  status: string;

  granted_at:
    | string
    | null;

  revoked_at:
    | string
    | null;

  created_at: string;
}

export interface PredictiveConsentRequest {
  granted: boolean;
}

/* =========================================================
   PREDICTIONS
========================================================= */

export interface Prediction {
  id: string;

  patient_user_id: string;

  condition: string;

  risk_category: string;

  risk_percentage:
    | number
    | null;

  calculated_at: string;

  trend:
    | string
    | null;

  model_version:
    | string
    | null;
}

/* =========================================================
   TREND EVENTS
========================================================= */

export interface TrendEvent {
  id: string;

  patient_user_id: string;

  hormone: string;

  event_type: string;

  severity: string;

  status: string;

  started_at: string;

  ended_at:
    | string
    | null;

  created_at: string;
}

/* =========================================================
   REFERENCE RANGES
========================================================= */

export interface ReferenceRange {
  id?: string;

  hormone: string;

  lower_normal: number;

  upper_normal: number;

  unit: string;

  created_at?: string;
}

/* =========================================================
   TEMPORARY QR ACCESS
========================================================= */

export interface TemporaryAccessToken {
  id: string;

  scope: Record<string, boolean>;

  expires_at: string;

  revoked_at:
    | string
    | null;

  created_at: string;
}

export interface TemporaryQrAccess {
  sessionId: string;

  token: string;

  expiresAt: string;

  scope: Record<string, boolean>;
}

/* =========================================================
   CANONICAL APPLICATION STATE
========================================================= */

export interface IsfState {
  patient:
    | PatientProfile
    | null;

  consultants: ConsultantSummary[];

  readings: HormoneReading[];

  patch:
    | PatientPatch
    | null;

  conversations: Conversation[];

  messages: ChatMessage[];

  subscription:
    | Subscription
    | null;

  predictiveConsent: boolean;

  predictions: Prediction[];

  trendEvents: TrendEvent[];
}

/* =========================================================
   API RESPONSE TYPES
========================================================= */

export interface ApiErrorResponse {
  error?: string;

  message?: string;

  code?: string;
}

export interface ApiSuccessResponse<T> {
  data: T;
}

/* =========================================================
   CANONICAL API ENDPOINT CONTRACTS
========================================================= */

/**
 * These constants prevent frontend files from scattering
 * endpoint strings throughout the application.
 */
export const API_ENDPOINTS = {
  profile: "/api/profile",

  readings: "/api/readings",

  referenceRanges:
    "/api/readings/reference-ranges",

  patch: "/api/patch",

  consultants:
    "/api/chat/consultants",

  conversations:
    "/api/chat/conversations",

  predictiveConsent:
    "/api/predictions/consent",

  predictions:
    "/api/predictions",

  trends:
    "/api/trends",

  subscription:
    "/api/subscription",

  share:
    "/api/share",

  qr:
    "/api/share/qr",
} as const;


