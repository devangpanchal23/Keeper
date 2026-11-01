import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSameOriginRequest, setAuthSessionCookie } from "@/lib/supabase/auth-route-utils";
import { isSupabaseConfigured } from "@/lib/supabase/config";

const DEMO_USER_ID = "user-demo-1";
const DEMO_EMAIL = "devang@recall.ai";

function createDemoUserPayload() {
  return {
    id: DEMO_USER_ID,
    aud: "authenticated",
    role: "authenticated",
    email: DEMO_EMAIL,
    email_confirmed_at: "2024-01-15T00:00:00.000Z",
    phone: "",
    confirmed_at: "2024-01-15T00:00:00.000Z",
    last_sign_in_at: new Date().toISOString(),
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: { full_name: "Devang Patel", name: "Devang Patel" },
    identities: [],
    created_at: "2024-01-15T00:00:00.000Z",
    updated_at: new Date().toISOString(),
  };
}

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") return NextResponse.json({ error: "Enter your email and password." }, { status: 400 });
    const { email, password } = body as { email?: unknown; password?: unknown };
    if (typeof email !== "string" || typeof password !== "string" || !email.trim() || !password) {
      return NextResponse.json({ error: "Enter your email and password." }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const isDemoLogin =
      normalizedEmail === DEMO_EMAIL &&
      (password === "demo1234" || password === "••••••••••••" || password === "password123");

    // Case 1: Supabase is NOT configured
    if (!isSupabaseConfigured()) {
      if (isDemoLogin) {
        const response = NextResponse.json(
          { user: createDemoUserPayload() },
          { headers: { "Cache-Control": "private, no-store" } }
        );
        response.cookies.set("recall_session_token", "tok_demo_active", {
          path: "/",
          maxAge: 7 * 86400,
          sameSite: "lax",
        });
        return await setAuthSessionCookie(response);
      }

      return NextResponse.json(
        {
          error:
            "Authentication service is not configured. Please add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to your environment variables, or use Instant Demo Access.",
        },
        { status: 503 }
      );
    }

    // Case 2: Supabase IS configured
    try {
      const supabase = await createSupabaseServerClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (error || !data.user || !data.session) {
        if (isDemoLogin) {
          const response = NextResponse.json(
            { user: createDemoUserPayload() },
            { headers: { "Cache-Control": "private, no-store" } }
          );
          response.cookies.set("recall_session_token", "tok_demo_active", {
            path: "/",
            maxAge: 7 * 86400,
            sameSite: "lax",
          });
          return await setAuthSessionCookie(response);
        }
        return NextResponse.json(
          { error: error?.message || "Keeper could not verify this account." },
          { status: 401 }
        );
      }

      const response = NextResponse.json(
        { user: data.user },
        { headers: { "Cache-Control": "private, no-store" } }
      );
      return await setAuthSessionCookie(response);
    } catch (supabaseError) {
      if (isDemoLogin) {
        const response = NextResponse.json(
          { user: createDemoUserPayload() },
          { headers: { "Cache-Control": "private, no-store" } }
        );
        response.cookies.set("recall_session_token", "tok_demo_active", {
          path: "/",
          maxAge: 7 * 86400,
          sameSite: "lax",
        });
        return await setAuthSessionCookie(response);
      }
      console.error("Supabase sign-in error:", supabaseError);
      return NextResponse.json(
        { error: "Sign-in service is temporarily unavailable. Check your connection and try again." },
        { status: 503 }
      );
    }
  } catch (error) {
    console.error("Sign-in error:", error);
    return NextResponse.json(
      { error: "Sign-in failed. Check your connection and try again." },
      { status: 503 }
    );
  }
}
