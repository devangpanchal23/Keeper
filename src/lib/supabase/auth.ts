import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getAuthenticatedSupabaseUser() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
}
