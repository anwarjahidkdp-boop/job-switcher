// Service-role client. Bypasses RLS: use only in server code for system tasks
// (metering, inbound email, cron). Never import from client components.
import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { publicEnv, requireEnv } from "../env";

let cached: SupabaseClient | null = null;
export function createAdminClient(): SupabaseClient {
  if (!cached) cached = createClient(publicEnv.supabaseUrl || requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false, autoRefreshToken: false } });
  return cached;
}
