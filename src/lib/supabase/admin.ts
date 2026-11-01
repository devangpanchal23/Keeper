import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "@/lib/supabase/config";

export function createSupabaseAdminClient() {
  const { url, serviceRoleKey, key } = getSupabaseConfig();
  const effectiveKey = serviceRoleKey || key;
  if (!url || !effectiveKey) {
    throw new Error("Supabase service role or API key is not configured on this server.");
  }
  return createClient(url, effectiveKey, { auth: { autoRefreshToken: false, persistSession: false } });
}
