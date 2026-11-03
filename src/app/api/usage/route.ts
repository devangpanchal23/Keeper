import { NextResponse } from "next/server";
import { createBackendServerClient } from "@/lib/database/backend-client";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

export async function GET() {
  const unavailableUsage = {
    plan: "open-source",
    total: null,
    used: null,
    remaining: null,
    unlimited: true,
    usageAvailable: false,
  };

  if (!isSupabaseConfigured()) {
    return NextResponse.json(unavailableUsage, {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }

  try {
    const supabase = await createBackendServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, {
        status: 401,
        headers: { "Cache-Control": "no-store" },
      });
    }

    // Open-Source Edition: Unlimited imports for all users
    const { count, error } = await supabase
      .from("keeper_usage_ledger")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", user.id);
    if (error || count === null) {
      return NextResponse.json(unavailableUsage, {
        status: 503,
        headers: { "Cache-Control": "no-store" },
      });
    }

    return NextResponse.json(
      {
        plan: "open-source",
        total: null,
        used: count,
        remaining: null,
        unlimited: true,
        usageAvailable: true,
      },
      {
        headers: { "Cache-Control": "no-store" },
      }
    );
  } catch {
    return NextResponse.json(unavailableUsage, {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
