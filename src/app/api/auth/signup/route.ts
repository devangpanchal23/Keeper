import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSameOriginRequest, setAuthSessionCookie } from "@/lib/supabase/auth-route-utils";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") return NextResponse.json({ error: "Enter your name, email, and password." }, { status: 400 });
    const { name, email, password } = body as { name?: unknown; email?: unknown; password?: unknown };
    if (typeof name !== "string" || !name.trim() || typeof email !== "string" || typeof password !== "string" || password.length < 6) {
      return NextResponse.json({ error: "Enter a valid name, email, and password of at least 6 characters." }, { status: 400 });
    }
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        {
          error:
            "Authentication service is not configured. Please add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to your environment variables, or use Instant Demo Access.",
        },
        { status: 503 }
      );
    }

    const configuredAppUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined);
    const appOrigin = new URL(configuredAppUrl || request.nextUrl.origin || request.url).origin;

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: { full_name: name.trim(), name: name.trim() },
        emailRedirectTo: `${appOrigin}/auth/callback?next=%2Fapp`,
      },
    });
    if (error || !data.user) {
      return NextResponse.json({ error: error?.message || "Keeper could not create your account." }, { status: 400 });
    }
    if (!data.session) {
      return NextResponse.json(
        { user: data.user, confirmationRequired: true },
        { status: 202, headers: { "Cache-Control": "private, no-store" } }
      );
    }
    const response = NextResponse.json(
      { user: data.user, confirmationRequired: false },
      { status: 201, headers: { "Cache-Control": "private, no-store" } }
    );
    return await setAuthSessionCookie(response);
  } catch (error) {
    console.error("Sign-up error:", error);
    return NextResponse.json(
      { error: "Sign-up failed. Check your connection and try again." },
      { status: 503 }
    );
  }
}
