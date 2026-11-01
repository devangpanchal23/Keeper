import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSameOriginRequest } from "@/lib/supabase/auth-route-utils";

export async function PATCH(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid profile details." }, { status: 400 });
    const { name, email } = body as { name?: unknown; email?: unknown };
    if (name !== undefined && (typeof name !== "string" || !name.trim())) return NextResponse.json({ error: "Name cannot be empty." }, { status: 400 });
    if (email !== undefined && (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))) {
      return NextResponse.json({ error: "Invalid email format." }, { status: 400 });
    }
    const supabase = await createSupabaseServerClient();
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) return NextResponse.json({ error: "Sign in to update your profile." }, { status: 401 });
    const cleanName = typeof name === "string" ? name.trim() : String(auth.user.user_metadata?.full_name || auth.user.email?.split("@")[0] || "Keeper user");
    const cleanEmail = typeof email === "string" ? email.trim().toLowerCase() : auth.user.email;
    const { data, error } = await supabase.auth.updateUser({
      ...(email !== undefined && cleanEmail ? { email: cleanEmail } : {}),
      data: { ...auth.user.user_metadata, full_name: cleanName, name: cleanName },
    });
    if (error || !data.user) return NextResponse.json({ error: error?.message || "Profile update failed." }, { status: 400 });
    return NextResponse.json({ user: data.user, newEmailPending: Boolean(data.user.new_email) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Profile update failed. Try again." }, { status: 503 });
  }
}
