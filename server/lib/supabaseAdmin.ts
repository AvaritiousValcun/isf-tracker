import { createClient } from '@supabase/supabase-js';
import { env } from './env';

const supabaseUrl =
  env.SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  'https://placeholder.supabase.co';

const supabaseKey =
  env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  'placeholder-key';

// This client bypasses RLS. It must ONLY be used for server-authoritative logic.
export const supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
