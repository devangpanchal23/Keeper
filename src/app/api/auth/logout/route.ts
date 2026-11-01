import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { clearAuthSessionCookie, isSameOriginRequest } from "@/lib/supabase/auth-route-utils";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const response = NextResponse.json({ success: true }, { headers: { "Cache-Control": "private, no-store" } });
  
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createSupabaseServerClient();
      await supabase.auth.signOut({ scope: "local" });
    } catch (err) {
      console.warn("Supabase sign-out warning:", err);
    }
  }

  clearAuthSessionCookie(response);
  response.cookies.set("recall_session_token", "", { path: "/", maxAge: 0, expires: new Date(0) });
  return response;
}
