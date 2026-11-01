import { NextResponse } from "next/server";
import { createBackendServerClient } from "@/lib/database/backend-client";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

export async function GET() {
  const openSourceUsage = {
    plan: "open-source",
    total: null,
    used: 0,
    remaining: null,
    unlimited: true,
  };

  if (!isSupabaseConfigured()) {
    return NextResponse.json(openSourceUsage, {
      headers: { "Cache-Control": "no-store" },
    });
  }

  try {
    const supabase = await createBackendServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(openSourceUsage, {
        headers: { "Cache-Control": "no-store" },
      });
    }

    // Open-Source Edition: Unlimited imports for all users
    const { count } = await supabase
      .from("keeper_usage_ledger")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", user.id);
    const used = count || 0;

    return NextResponse.json(
      {
        plan: "open-source",
        total: null,
        used,
        remaining: null,
        unlimited: true,
      },
      {
        headers: { "Cache-Control": "no-store" },
      }
    );
  } catch {
    return NextResponse.json(openSourceUsage, {
      headers: { "Cache-Control": "no-store" },
    });
  }
}
