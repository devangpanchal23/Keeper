import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { FREE_PLAN, KEEPER_BILLING_PLANS } from "@/lib/billing-plans";

export const dynamic = "force-dynamic";

export async function GET() {
  let supabase;
  try {
    supabase = await createSupabaseServerClient();
  } catch {
    return NextResponse.json({ error: "Usage storage is not configured." }, { status: 503 });
  }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to view usage." }, { status: 401 });

  const now = new Date();
  const { data: subscriptions } = await supabase.from("billing_subscriptions").select("plan,billing_cycle,current_period_start,current_period_end,trial_ends_at,status,cancel_at_cycle_end")
    .eq("user_id", user.id).in("status", ["active", "trialing", "authenticated", "cancelled", "canceled"])
    .order("current_period_end", { ascending: false });
  const subscription = subscriptions?.find((entry) => {
    const end = entry.current_period_end || entry.trial_ends_at;
    const isEntitledStatus = ["active", "trialing", "authenticated"].includes(entry.status)
      || (["cancelled", "canceled"].includes(entry.status) && entry.cancel_at_cycle_end);
    return isEntitledStatus && end && Date.parse(end) > now.getTime();
  });

  const plan: "free" | "basic" | "pro" = subscription?.plan === "pro" ? "pro" : subscription?.plan === "basic" ? "basic" : "free";
  let cycleStart = subscription?.current_period_start ? new Date(subscription.current_period_start) : undefined;
  let cycleEnd = subscription?.current_period_end || subscription?.trial_ends_at;
  const total: number | null = plan === "pro" ? null : plan === "basic"
    ? KEEPER_BILLING_PLANS.basic[subscription?.billing_cycle === "yearly" ? "yearly" : "monthly"].credits
    : FREE_PLAN.credits;

  if (plan === "free") {
    const { data: memory } = await supabase.from("keeper_workspace_memory").select("free_cycle_anchor").eq("workspace_id", user.id).maybeSingle();
    const anchor = memory?.free_cycle_anchor ? new Date(memory.free_cycle_anchor) : now;
    cycleStart = new Date(anchor.getTime() + Math.floor((now.getTime() - anchor.getTime()) / (7 * 86400000)) * 7 * 86400000);
    cycleEnd = new Date(cycleStart.getTime() + FREE_PLAN.cycleDays * 86400000).toISOString();
  }
  cycleStart ||= new Date(now.getTime() - (plan === "free" ? 7 : 30) * 86400000);
  const { count, error } = await supabase.from("keeper_usage_ledger").select("id", { count: "exact", head: true })
    .eq("workspace_id", user.id).gte("created_at", cycleStart.toISOString())
    .lt("created_at", cycleEnd || new Date(cycleStart.getTime() + 30 * 86400000).toISOString());
  if (error) return NextResponse.json({ error: "Usage records could not be loaded." }, { status: 503 });
  const used = count || 0;
  return NextResponse.json({ plan, total, used, remaining: total === null ? null : Math.max(0, total - used), cycleStart: cycleStart.toISOString(), resetAt: cycleEnd }, {
    headers: { "Cache-Control": "no-store" },
  });
}
