import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSameOriginRequest } from "@/lib/supabase/auth-route-utils";
import { getSupabaseConfig } from "@/lib/supabase/config";

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") return NextResponse.json({ error: "Enter your current and new passwords." }, { status: 400 });
    const { currentPassword, newPassword } = body as { currentPassword?: unknown; newPassword?: unknown };
    if (typeof currentPassword !== "string" || typeof newPassword !== "string" || newPassword.length < 6) {
      return NextResponse.json({ error: "New password must be at least 6 characters long." }, { status: 400 });
    }
    const { url, key, isConfigured } = getSupabaseConfig();
    if (!isConfigured || !url || !key) {
      return NextResponse.json({ error: "Authentication service is not configured." }, { status: 503 });
    }
    const supabase = await createSupabaseServerClient();
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user?.email) return NextResponse.json({ error: "Sign in to update your password." }, { status: 401 });
    const verifier = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } });
    const { error: passwordError } = await verifier.auth.signInWithPassword({ email: auth.user.email, password: currentPassword });
    if (passwordError) return NextResponse.json({ error: "Incorrect current password." }, { status: 400 });
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Password update failed. Try again." }, { status: 503 });
  }
}
