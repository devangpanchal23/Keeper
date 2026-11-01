import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { authSessionCookieOptions } from "@/lib/supabase/auth-session";
import { getSupabaseConfig } from "@/lib/supabase/config";

export async function createSupabaseServerClient() {
  const { url, key } = getSupabaseConfig();
  if (!url || !key) {
    throw new Error("Supabase is not configured on this server. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }

  const cookieStore = await cookies();
  return createServerClient(url, key, {
    cookieOptions: {
      maxAge: 7 * 24 * 60 * 60,
      ...authSessionCookieOptions,
    },
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          cookieStore.set(name, value, options);
        }
      },
    },
  });
}
