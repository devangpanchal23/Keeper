import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSupabaseUser } from "@/lib/supabase/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getRazorpayClient } from "@/lib/razorpay";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let user: Awaited<ReturnType<typeof getAuthenticatedSupabaseUser>>;
  try { user = await getAuthenticatedSupabaseUser(); }
  catch { return NextResponse.json({ error: "Billing is not configured yet. Complete the Supabase server setup first." }, { status: 503 }); }
  if (!user) return NextResponse.json({ error: "Sign in to manage your subscription." }, { status: 401 });
  const body: unknown = await request.json().catch(() => null);
  const subscriptionId = body && typeof body === "object" ? (body as Record<string, unknown>).subscriptionId : null;
  if (typeof subscriptionId !== "string") return NextResponse.json({ error: "Select a valid subscription." }, { status: 400 });

  try {
    const admin = createSupabaseAdminClient();
    const { data: record, error } = await admin.from("billing_subscriptions").select("id,razorpay_subscription_id,status").eq("id", subscriptionId).eq("user_id", user.id).maybeSingle();
    if (error || !record) return NextResponse.json({ error: "Subscription not found." }, { status: 404 });
    if (!["trialing", "authenticated", "active"].includes(record.status)) return NextResponse.json({ error: "This subscription cannot be cancelled in its current state." }, { status: 409 });
    const updated = await getRazorpayClient().subscriptions.cancel(record.razorpay_subscription_id, true);
    const { error: updateError } = await admin.from("billing_subscriptions").update({ cancel_at_cycle_end: true, updated_at: new Date().toISOString() }).eq("id", record.id);
    if (updateError) throw new Error("Cancellation state could not be saved.");
    return NextResponse.json({ success: true, status: updated.status, ends_at: updated.current_end ? new Date(updated.current_end * 1000).toISOString() : null });
  } catch (error) {
    console.error("Subscription cancellation failed:", error);
    return NextResponse.json({ error: "Could not cancel the subscription. Please try again." }, { status: 502 });
  }
}
