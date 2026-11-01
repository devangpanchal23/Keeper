import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { AUTH_SESSION_COOKIE, isAuthSessionMarkerValid } from "@/lib/supabase/auth-session";

export const dynamic = "force-dynamic";

function createDemoSessionUser() {
  return {
    id: "user-demo-1",
    aud: "authenticated",
    role: "authenticated",
    email: "devang@recall.ai",
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

export async function GET(request: NextRequest) {
  try {
    const marker = request.cookies.get(AUTH_SESSION_COOKIE)?.value;
    const prototypeToken = request.cookies.get("recall_session_token")?.value;
    const hasLocalToken = Boolean(
      prototypeToken && (prototypeToken.startsWith("tok_") || prototypeToken === "supabase-server-session")
    );

    // If Supabase is not configured on this server
    if (!isSupabaseConfigured()) {
      if (hasLocalToken) {
        return NextResponse.json(
          { user: createDemoSessionUser(), isDemo: true },
          { headers: { "Cache-Control": "private, no-store" } }
        );
      }
      return NextResponse.json({ user: null }, { headers: { "Cache-Control": "private, no-store" } });
    }

    // Supabase is configured: check marker or prototype session
    const markerValid = await isAuthSessionMarkerValid(marker);
    if (!markerValid && !hasLocalToken) {
      return NextResponse.json({ user: null }, { headers: { "Cache-Control": "private, no-store" } });
    }

    try {
      const supabase = await createSupabaseServerClient();
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) {
        if (hasLocalToken) {
          return NextResponse.json(
            { user: createDemoSessionUser(), isDemo: true },
            { headers: { "Cache-Control": "private, no-store" } }
          );
        }
        return NextResponse.json({ user: null }, { headers: { "Cache-Control": "private, no-store" } });
      }

      return NextResponse.json({ user: data.user }, { headers: { "Cache-Control": "private, no-store" } });
    } catch {
      if (hasLocalToken) {
        return NextResponse.json(
          { user: createDemoSessionUser(), isDemo: true },
          { headers: { "Cache-Control": "private, no-store" } }
        );
      }
      return NextResponse.json({ user: null }, { headers: { "Cache-Control": "private, no-store" } });
    }
  } catch {
    return NextResponse.json({ user: null }, { headers: { "Cache-Control": "private, no-store" } });
  }
}
