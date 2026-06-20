// Supabase client — the single entry point to the cloud layer.
//
// Local-first contract: the whole cloud feature is OPT-IN. When the two env
// vars are absent (the default for a plain `npm run dev`/static build), this
// returns null and every caller no-ops, so the app runs exactly as before on
// localStorage alone. Configure NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY to switch
// the cloud on. The anon key is public-safe — Row-Level Security guards data.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** True when both env vars are present and the cloud layer is active. */
export const cloudEnabled: boolean = Boolean(url && anonKey);

let client: SupabaseClient | null = null;

/** The shared client, or null when the cloud is not configured. */
export function getSupabase(): SupabaseClient | null {
  if (!cloudEnabled) return null;
  if (client) return client;
  // url/anonKey are non-null here (cloudEnabled gate above).
  client = createClient(url as string, anonKey as string, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      // The OAuth redirect lands on /auth/callback with the session in the URL.
      detectSessionInUrl: true,
    },
  });
  return client;
}
