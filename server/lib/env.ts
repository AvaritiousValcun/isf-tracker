import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const envSource = {
  ...process.env,
  SUPABASE_URL: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://example.com",
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "missing",
};

export const env = {
  SUPABASE_URL: envSource.SUPABASE_URL,
  SUPABASE_ANON_KEY: envSource.SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || "missing",
  PORT: process.env.PORT || "3000",
  NODE_ENV: process.env.NODE_ENV || "development",
  FRONTEND_URL: process.env.FRONTEND_URL || "http://localhost:8080",
  PAYMENT_MODE: process.env.PAYMENT_MODE || "mock",
  WEBAUTHN_RP_NAME: process.env.WEBAUTHN_RP_NAME || "ISF Tracker",
  WEBAUTHN_RP_ID: process.env.WEBAUTHN_RP_ID || "isf-tracker.vercel.app",
  WEBAUTHN_ORIGIN: process.env.WEBAUTHN_ORIGIN || "https://isf-tracker.vercel.app",
  MPESA_CONSUMER_KEY: process.env.MPESA_CONSUMER_KEY || "",
  MPESA_CONSUMER_SECRET: process.env.MPESA_CONSUMER_SECRET || "",
  MPESA_SHORTCODE: process.env.MPESA_SHORTCODE || "",
  MPESA_PASSKEY: process.env.MPESA_PASSKEY || "",
  MPESA_CALLBACK_URL: process.env.MPESA_CALLBACK_URL || "",
  MPESA_ENVIRONMENT: process.env.MPESA_ENVIRONMENT || "sandbox",
  PAYMENT_WEBHOOK_SECRET: process.env.PAYMENT_WEBHOOK_SECRET || "",
};
