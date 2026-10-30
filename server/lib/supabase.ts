import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error(
    "[Supabase] SUPABASE_URL is missing from the environment."
  );
}

if (!supabaseServiceRoleKey) {
  throw new Error(
    "[Supabase] SUPABASE_SERVICE_ROLE_KEY is missing from the environment."
  );
}

const supabase = createClient(
  supabaseUrl,
  supabaseServiceRoleKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

export { supabase };