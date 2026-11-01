import { NextResponse } from "next/server";
import { createBackendServerClient } from "@/lib/database/backend-client";

export const dynamic = "force-dynamic";

export async function GET() {
  let supabase;
  try {
    supabase = await createBackendServerClient();
  } catch {
    return NextResponse.json({ error: "Usage storage is not configured." }, { status: 503 });
  }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to view usage." }, { status: 401 });

  // Open-Source Edition: Unlimited imports for all users
  const { count } = await supabase.from("keeper_usage_ledger").select("id", { count: "exact", head: true })
    .eq("workspace_id", user.id);
  const used = count || 0;

  return NextResponse.json({
    plan: "open-source",
    total: null,
    used,
    remaining: null,
    unlimited: true,
  }, {
    headers: { "Cache-Control": "no-store" },
  });
}
