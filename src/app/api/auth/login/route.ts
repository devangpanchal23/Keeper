import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSameOriginRequest, setAuthSessionCookie } from "@/lib/supabase/auth-route-utils";

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") return NextResponse.json({ error: "Enter your email and password." }, { status: 400 });
    const { email, password } = body as { email?: unknown; password?: unknown };
    if (typeof email !== "string" || typeof password !== "string" || !email.trim() || !password) {
      return NextResponse.json({ error: "Enter your email and password." }, { status: 400 });
    }
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    if (error || !data.user || !data.session) {
      return NextResponse.json({ error: error?.message || "Keeper could not verify this account." }, { status: 401 });
    }
    const response = NextResponse.json({ user: data.user }, { headers: { "Cache-Control": "private, no-store" } });
    return await setAuthSessionCookie(response);
  } catch (error) {
    console.error("Sign-in error:", error);
    return NextResponse.json({ error: "Sign-in failed. Check your connection and try again." }, { status: 503 });
  }
}
