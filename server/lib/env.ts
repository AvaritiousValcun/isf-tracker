import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

// Fallback to VITE_ variables if backend ones are missing on Vercel
const envSource = {
  ...process.env,
  SUPABASE_URL: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY,
};

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

const parsed = envSchema.safeParse(envSource);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => ${issue.path.join(".")}: )
    .join("\n");

  console.error(
    [ISF Tracker] Missing or invalid environment variables:\n,
  );
  
  // Don't crash immediately so we can see the logs in Vercel
  throw new Error(
    [ISF Tracker] Missing or invalid environment variables:\n,
  );
}

export const env = parsed.data;
