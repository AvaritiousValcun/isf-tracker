import { createClient } from '@supabase/supabase-js';
import { env } from './env.js';

// This client bypasses RLS. It must ONLY be used for server-authoritative logic.
export const supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);