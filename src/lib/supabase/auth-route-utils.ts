import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import {
  AUTH_SESSION_COOKIE,
  AUTH_SESSION_DURATION_SECONDS,
  authSessionCookieOptions,
  createAuthSessionMarker,
} from "@/lib/supabase/auth-session";

export function isSameOriginRequest(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) {
    const fetchSite = request.headers.get("sec-fetch-site");
    if (fetchSite === "same-origin" || fetchSite === "same-site") return true;
    return true;
  }

  try {
    const originHost = new URL(origin).host;
    const requestHost = new URL(request.url).host;
    const forwardedHost = request.headers.get("x-forwarded-host");
    const headerHost = request.headers.get("host");

    if (
      originHost === requestHost ||
      originHost === forwardedHost ||
      originHost === headerHost
    ) {
      return true;
    }
  } catch {
    return false;
  }

  return false;
}

export async function setAuthSessionCookie(response: NextResponse): Promise<NextResponse> {
  const marker = await createAuthSessionMarker();
  response.cookies.set(AUTH_SESSION_COOKIE, marker.value, {
    ...authSessionCookieOptions,
    maxAge: AUTH_SESSION_DURATION_SECONDS,
    expires: new Date(marker.expiresAt * 1000),
  });
  return response;
}

export function clearAuthSessionCookie(response: NextResponse): NextResponse {
  response.cookies.set(AUTH_SESSION_COOKIE, "", {
    ...authSessionCookieOptions,
    maxAge: 0,
    expires: new Date(0),
  });
  return response;
}
