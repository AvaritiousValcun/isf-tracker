import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const rawUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").trim();
const rawAnonKey = (process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "").trim();
const rawServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "").trim();

const envSchema = z.object({
  SUPABASE_URL: z.string().min(1).default(rawUrl),
  SUPABASE_ANON_KEY: z.string().min(1).default(rawAnonKey),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).default(rawServiceKey),
  PORT: z.string().optional().default("3000"),
  NODE_ENV: z.string().optional().default("development"),
  FRONTEND_URL: z.string().optional().default("http://localhost:8080"),
  PAYMENT_MODE: z.string().optional().default("mock"),
  PAYMENT_WEBHOOK_SECRET: z.string().optional(),
  MPESA_CONSUMER_KEY: z.string().optional(),
  MPESA_CONSUMER_SECRET: z.string().optional(),
  MPESA_SHORTCODE: z.string().optional(),
  MPESA_PASSKEY: z.string().optional(),
  MPESA_CALLBACK_URL: z.string().optional(),
  MPESA_ENVIRONMENT: z.string().optional().default("sandbox"),
  WEBAUTHN_RP_NAME: z.string().optional().default("ISF Tracker"),
  WEBAUTHN_RP_ID: z.string().optional(),
  WEBAUTHN_ORIGIN: z.string().optional(),
});

const parsed = envSchema.safeParse({
  ...process.env,
  SUPABASE_URL: rawUrl,
  SUPABASE_ANON_KEY: rawAnonKey,
  SUPABASE_SERVICE_ROLE_KEY: rawServiceKey,
});

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("\n");

  console.warn(
    `[ISF Tracker] Environment validation warning:\n${details}`,
  );
}

export const env = parsed.success
  ? parsed.data
  : {
      SUPABASE_URL: rawUrl,
      SUPABASE_ANON_KEY: rawAnonKey,
      SUPABASE_SERVICE_ROLE_KEY: rawServiceKey,
      PORT: "3000",
      NODE_ENV: process.env.NODE_ENV || "development",
      FRONTEND_URL: "http://localhost:8080",
      PAYMENT_MODE: "mock",
      MPESA_ENVIRONMENT: "sandbox",
      WEBAUTHN_RP_NAME: "ISF Tracker",
    };
