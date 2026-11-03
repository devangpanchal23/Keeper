import type { SavedItem } from "@/types";

export type WorkspaceMediaReadResult =
  | { kind: "success"; items: SavedItem[] }
  | { kind: "authentication"; message: string }
  | { kind: "configuration"; message: string }
  | { kind: "unavailable"; message: string };

type MediaResponse = Pick<Response, "ok" | "status" | "json">;

/**
 * Reads the authenticated workspace library without treating an HTTP or
 * transport failure as an empty library. State changes belong to the caller
 * and must happen only for the `success` result.
 */
export async function readWorkspaceMedia(
  fetcher: (input: string, init?: RequestInit) => Promise<MediaResponse> = fetch,
): Promise<WorkspaceMediaReadResult> {
  let response: MediaResponse;
  try {
    response = await fetcher("/api/media", { cache: "no-store" });
  } catch {
    return { kind: "unavailable", message: "Keeper could not reach workspace storage." };
  }

  if (response.status === 401) {
    return { kind: "authentication", message: "Sign in again to sync your workspace." };
  }
  if (response.status === 503) {
    let code = "";
    try {
      const payload = await response.json() as { code?: unknown };
      if (typeof payload?.code === "string") code = payload.code;
    } catch {
      // A malformed error body remains a generic backend failure.
    }
    return code === "BACKEND_NOT_CONFIGURED"
      ? { kind: "configuration", message: "Workspace storage is not configured." }
      : { kind: "unavailable", message: "Workspace storage is temporarily unavailable." };
  }
  if (!response.ok) {
    return { kind: "unavailable", message: "Keeper could not read workspace storage." };
  }

  try {
    const payload = await response.json() as { items?: unknown };
    if (!Array.isArray(payload?.items)) {
      return { kind: "unavailable", message: "Keeper received an invalid workspace response." };
    }
    return { kind: "success", items: payload.items as SavedItem[] };
  } catch {
    return { kind: "unavailable", message: "Keeper received an invalid workspace response." };
  }
}
