import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const envSource = {
  ...process.env,
  SUPABASE_URL: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY,
};

const envSchema = z.object({
  SUPABASE_URL: z.string().url().optional().default("https://example.com"),
  SUPABASE_ANON_KEY: z.string().optional().default("missing"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional().default("missing"),
  PORT: z.string().optional().default("3000"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  FRONTEND_URL: z.string().url().optional().default("http://localhost:8080"),
  PAYMENT_MODE: z.enum(["mock", "daraja"]).optional().default("mock"),
  WEBAUTHN_RP_NAME: z.string().optional().default("ISF Tracker"),
  WEBAUTHN_RP_ID: z.string().optional(),
  WEBAUTHN_ORIGIN: z.string().optional(),
});

export const env = envSchema.parse(envSource);
