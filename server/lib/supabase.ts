import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "./env";

const supabaseUrl = env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const supabaseKey =
  env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  "";

let supabase: SupabaseClient;

if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
} else {
  console.warn(
    "[Supabase] Credentials not fully configured. API queries to Supabase may fail.",
  );
  // Fallback dummy client to avoid module crash on import
  supabase = createClient(
    supabaseUrl || "https://placeholder.supabase.co",
    supabaseKey || "placeholder-key",
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}

export { supabase };
