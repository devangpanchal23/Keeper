import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { setAuthSessionCookie } from "@/lib/supabase/auth-route-utils";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next");
  const nextIsLocal = Boolean(next?.startsWith("/") && !next.startsWith("//") && new URL(next, requestUrl.origin).origin === requestUrl.origin);
  const destination = nextIsLocal && next ? next : "/app";
  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const response = NextResponse.redirect(new URL(destination, requestUrl.origin));
      return await setAuthSessionCookie(response);
    }
  }
  return NextResponse.redirect(new URL("/sign-in?error=confirmation", requestUrl.origin));
}
