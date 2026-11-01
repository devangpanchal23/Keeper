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
  return Boolean(origin && origin === new URL(request.url).origin);
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
