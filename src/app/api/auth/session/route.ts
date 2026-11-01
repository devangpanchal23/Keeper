import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return NextResponse.json({ user: null }, { headers: { "Cache-Control": "private, no-store" } });
    return NextResponse.json({ user: data.user }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Authentication service is unavailable." }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
  }
}
