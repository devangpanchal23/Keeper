import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { clearAuthSessionCookie, isSameOriginRequest } from "@/lib/supabase/auth-route-utils";

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const response = NextResponse.json({ success: true }, { headers: { "Cache-Control": "private, no-store" } });
  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) {
      return clearAuthSessionCookie(NextResponse.json({ error: "Could not invalidate the provider session." }, { status: 503 }));
    }
  } catch {
    return clearAuthSessionCookie(NextResponse.json({ error: "Could not invalidate the provider session." }, { status: 503 }));
  }
  clearAuthSessionCookie(response);
  return response;
}
