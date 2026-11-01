import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getDatabaseProvider } from "./provider";
import { MongoStore } from "./mongodb-store";
import { PostgresStore } from "./postgres-store";
import type { BackendStore } from "./query";

function storeForConfiguredProvider(): BackendStore {
  const provider = getDatabaseProvider();
  if (provider === "postgres") return new PostgresStore();
  if (provider === "mongodb") return new MongoStore();
  throw new Error("The Supabase provider uses its native client.");
}

function makeStoreClient(base: SupabaseClient, store: BackendStore, workspaceId?: string): SupabaseClient {
  return new Proxy(base, {
    get(target, property, receiver) {
      if (property === "from") return store.from.bind(store);
      if (property === "rpc") return (name: string, args?: Record<string, unknown>) => store.rpc(name, { ...(args || {}), ...(workspaceId ? { p_workspace_id: workspaceId } : {}) });
      return Reflect.get(target, property, receiver);
    },
  });
}

/** Supabase Auth remains the identity provider; this factory selects only the data store. */
export async function createBackendServerClient(): Promise<SupabaseClient> {
  const authClient = await createSupabaseServerClient();
  if (getDatabaseProvider() === "supabase") return authClient;
  const { data: { user } } = await authClient.auth.getUser();
  return makeStoreClient(authClient, storeForConfiguredProvider(), user?.id);
}

/** Server-only privileged data access for worker/webhook routes. */
export function createBackendAdminClient(): SupabaseClient {
  if (getDatabaseProvider() === "supabase") return createSupabaseAdminClient();
  // The admin SDK is used only as a structural client base; no service key is sent to a non-Supabase store.
  const placeholder = {} as SupabaseClient;
  return makeStoreClient(placeholder, storeForConfiguredProvider());
}
