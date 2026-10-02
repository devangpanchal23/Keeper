import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  let supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  try { supabase = await createSupabaseServerClient(); }
  catch { return NextResponse.json({ error: "Billing is not configured yet. Complete the Supabase server setup first." }, { status: 503 }); }
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Sign in to view billing." }, { status: 401 });

  try {
    const [subscriptionsResult, paymentsResult] = await Promise.all([
      supabase.from("billing_subscriptions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("billing_payments").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
    ]);
    if (subscriptionsResult.error || paymentsResult.error) throw new Error("Billing records are unavailable.");

    const now = Date.now();
    const subscriptions = subscriptionsResult.data || [];
    const current = subscriptions.find((entry) => {
      const entitledStatus = ["trialing", "authenticated", "active"].includes(entry.status) || (entry.status === "cancelled" && entry.cancel_at_cycle_end);
      const periodEnd = entry.current_period_end || entry.trial_ends_at;
      const end = periodEnd ? Date.parse(periodEnd) : Number.POSITIVE_INFINITY;
      return entitledStatus && end > now;
    }) || null;
    const tier = current ? current.plan : "free";
    const displaySubscriptions = subscriptions.map((entry) => {
      const periodEnd = entry.current_period_end || entry.trial_ends_at;
      if (["trialing", "authenticated", "active"].includes(entry.status) && periodEnd && Date.parse(periodEnd) <= now) {
        return { ...entry, status: "expired" };
      }
      return entry;
    });

    return NextResponse.json({ current, subscriptions: displaySubscriptions, payments: paymentsResult.data || [], tier }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Billing profile query failed:", error);
    return NextResponse.json({ error: "Billing records could not be loaded." }, { status: 503 });
  }
}
