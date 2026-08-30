import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const envSchema = z.object({
  SUPABASE_URL: z.string().url({
    message: "SUPABASE_URL must be a valid URL.",
  }),
  SUPABASE_ANON_KEY: z.string().min(1, {
    message: "SUPABASE_ANON_KEY is required.",
  }),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, {
    message: "SUPABASE_SERVICE_ROLE_KEY is required on the server.",
  }),
  PORT: z.string().optional().default("3000"),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  FRONTEND_URL: z
    .string()
    .url()
    .optional()
    .default("http://localhost:8080"),
  PAYMENT_MODE: z.enum(["mock", "daraja"]).optional().default("mock"),
  PAYMENT_WEBHOOK_SECRET: z.string().optional(),
  MPESA_CONSUMER_KEY: z.string().optional(),
  MPESA_CONSUMER_SECRET: z.string().optional(),
  MPESA_SHORTCODE: z.string().optional(),
  MPESA_PASSKEY: z.string().optional(),
  MPESA_CALLBACK_URL: z.string().optional(),
  MPESA_ENVIRONMENT: z.enum(["sandbox", "production"]).optional().default("sandbox"),
  WEBAUTHN_RP_NAME: z.string().optional().default("ISF Tracker"),
  WEBAUTHN_RP_ID: z.string().optional(),
  WEBAUTHN_ORIGIN: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("\n");

  throw new Error(
    `[ISF Tracker] Missing or invalid environment variables:\n${details}`,
  );
}

export const env = parsed.data;
