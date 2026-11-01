import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { AUTH_SESSION_COOKIE, AUTH_SESSION_DURATION_SECONDS, authSessionCookieOptions, isAuthSessionMarkerValid } from "@/lib/supabase/auth-session";
import { getSupabaseConfig } from "@/lib/supabase/config";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, key, isConfigured } = getSupabaseConfig();

  const pathname = request.nextUrl.pathname;
  const protectedPage = pathname === "/app" || pathname.startsWith("/app/") || pathname === "/dashboard" || pathname.startsWith("/item/");
  const authPage = pathname === "/sign-in" || pathname === "/sign-up" || pathname === "/login" || pathname === "/signup";
  const publicApi = new Set([
    "/api/auth/login", "/api/auth/signup", "/api/auth/logout", "/api/auth/session",
    "/api/health", "/api/webhooks/razorpay", "/api/ai/worker", "/api/bulk-import/capabilities",
    "/api/usage", "/api/collections/sync", "/api/media", "/api/media/sync", "/api/ingest",
  ]);
  const protectedApi = pathname.startsWith("/api/") && !publicApi.has(pathname);

  // Prototype / Demo session token check (works across dev and live demo deployments)
  const prototypeToken = request.cookies.get("recall_session_token")?.value;
  const marker = request.cookies.get(AUTH_SESSION_COOKIE)?.value;
  const markerValid = await isAuthSessionMarkerValid(marker);
  const localPrototypeSession = Boolean(
    (prototypeToken && (prototypeToken.startsWith("tok_") || prototypeToken === "supabase-server-session")) ||
    markerValid
  );

  // ---------------------------------------------------------------------------
  // Case A: Supabase is NOT configured yet on this deployment
  // ---------------------------------------------------------------------------
  if (!isConfigured || !url || !key) {
    // 1. Always permit public endpoints (login, signup, session probe, health check)
    //    so the API routes themselves can handle demo authentication or return clean diagnostics.
    if (publicApi.has(pathname) || !pathname.startsWith("/api/")) {
      if (protectedPage) {
        if (localPrototypeSession) {
          response.headers.set("Cache-Control", "private, no-store, max-age=0");
          return response;
        }
        const destination = new URL("/sign-in", request.url);
        destination.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
        return NextResponse.redirect(destination);
      }
      if (authPage && localPrototypeSession) {
        return NextResponse.redirect(new URL("/app", request.url));
      }
      return response;
    }

    // 2. Protected API call without Supabase or local session
    if (protectedApi && !localPrototypeSession) {
      return NextResponse.json(
        { error: "Authentication service is not configured. Please add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your Vercel Environment Variables, or use Instant Demo Access." },
        { status: 503, headers: { "Cache-Control": "private, no-store" } }
      );
    }

    return response;
  }

  // ---------------------------------------------------------------------------
  // Case B: Supabase IS configured on this deployment
  // ---------------------------------------------------------------------------
  const supabase = createServerClient(url, key, {
    cookieOptions: { maxAge: AUTH_SESSION_DURATION_SECONDS, ...authSessionCookieOptions },
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // Supabase's auth provider owns the session and refresh-token validation.
  const { data: { user } } = await supabase.auth.getUser();

  if ((protectedPage && (!user || !markerValid) && !localPrototypeSession) || (protectedApi && (!user || !markerValid) && !localPrototypeSession)) {
    if (protectedApi) {
      const expiredResponse = NextResponse.json({ error: "Your session has expired. Please sign in again." }, { status: 401, headers: { "Cache-Control": "private, no-store" } });
      if (user || marker) await supabase.auth.signOut({ scope: "local" });
      expiredResponse.cookies.set(AUTH_SESSION_COOKIE, "", { ...authSessionCookieOptions, maxAge: 0, expires: new Date(0) });
      response.cookies.getAll().forEach((cookie) => expiredResponse.cookies.set(cookie));
      return expiredResponse;
    }
    const destination = new URL("/sign-in", request.url);
    destination.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    if (user || marker || request.cookies.getAll().some(({ name }) => name.startsWith("sb-") && name.endsWith("-auth-token"))) {
      destination.searchParams.set("error", "session-expired");
      await supabase.auth.signOut({ scope: "local" });
    }
    const redirectResponse = NextResponse.redirect(destination);
    redirectResponse.headers.set("Cache-Control", "private, no-store, max-age=0");
    redirectResponse.cookies.set(AUTH_SESSION_COOKIE, "", { ...authSessionCookieOptions, maxAge: 0, expires: new Date(0) });
    response.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie));
    return redirectResponse;
  }

  if (authPage && user && !markerValid && !localPrototypeSession) {
    await supabase.auth.signOut({ scope: "local" });
    const responseAfterSignOut = NextResponse.next({ request });
    response.cookies.getAll().forEach((cookie) => responseAfterSignOut.cookies.set(cookie));
    responseAfterSignOut.cookies.set(AUTH_SESSION_COOKIE, "", { ...authSessionCookieOptions, maxAge: 0, expires: new Date(0) });
    return responseAfterSignOut;
  }

  if (authPage && ((user && markerValid) || localPrototypeSession)) {
    return NextResponse.redirect(new URL("/app", request.url));
  }

  if (protectedPage || protectedApi) response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
