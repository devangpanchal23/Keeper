"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Clock3, CreditCard, ExternalLink, Loader2, ReceiptText, RefreshCw, ShieldCheck, XCircle } from "lucide-react";
import { useRecall } from "@/context/RecallContext";
import { KEEPER_BILLING_PLANS, type KeeperBillingCycle, type KeeperPlanId } from "@/lib/billing-plans";
import { startKeeperSubscription } from "@/lib/subscription-checkout";

type BillingSubscription = {
  id: string;
  plan: KeeperPlanId;
  billing_cycle: KeeperBillingCycle;
  amount: number;
  currency: string;
  razorpay_subscription_id: string;
  status: string;
  trial_ends_at: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  next_payment_at: string | null;
  cancel_at_cycle_end: boolean;
  created_at: string;
};
type BillingPayment = {
  id: string;
  razorpay_payment_id: string;
  razorpay_invoice_id: string | null;
  receipt_url: string | null;
  amount: number;
  currency: string;
  status: string;
  plan: KeeperPlanId;
  billing_cycle: KeeperBillingCycle;
  paid_at: string | null;
};
type BillingData = { current: BillingSubscription | null; subscriptions: BillingSubscription[]; payments: BillingPayment[]; tier: "free" | KeeperPlanId };

const money = (amount: number, currency: string) => new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount / 100);
const date = (value: string | null | undefined) => value ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(value)) : "—";
const planTitle = (plan: KeeperPlanId) => plan === "basic" ? "Basic" : "Pro";

async function fetchBilling(): Promise<BillingData> {
  const response = await fetch("/api/billing", { cache: "no-store" });
  const result = await response.json() as BillingData & { error?: string };
  if (!response.ok) throw new Error(result.error || "Billing details could not be loaded.");
  return result;
}

export function BillingSection() {
  const { user, addToast, syncBillingTier } = useRecall();
  const [data, setData] = useState<BillingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);
  const [cycle, setCycle] = useState<KeeperBillingCycle>("monthly");
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchBilling();
      setData(result);
      syncBillingTier(result.tier);
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : "Billing details could not be loaded.", error: true });
    } finally { setLoading(false); }
  }, [syncBillingTier]);

  useEffect(() => {
    let current = true;
    void fetchBilling().then((result) => {
      if (!current) return;
      setData(result);
      syncBillingTier(result.tier);
    }).catch((error: unknown) => {
      if (current) setMessage({ text: error instanceof Error ? error.message : "Billing details could not be loaded.", error: true });
    }).finally(() => {
      if (current) setLoading(false);
    });
    return () => { current = false; };
  }, [syncBillingTier]);

  const beginPlan = async (plan: KeeperPlanId) => {
    if (!user) return;
    const key = `${plan}-${cycle}`;
    setWorking(key);
    setMessage(null);
    try {
      const result = await startKeeperSubscription({ plan, billingCycle: cycle, name: user.name, email: user.email });
      if (result === "cancelled") return;
      setMessage({ text: `Your ${planTitle(plan)} subscription is authorized. The 7-day trial is active; the first recurring charge is scheduled after the trial.` });
      addToast("Plan activated", "Your 7-day trial has started.", "success");
      await load();
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : "Checkout could not be started.", error: true });
    } finally { setWorking(null); }
  };

  const cancel = async (subscription: BillingSubscription) => {
    if (!window.confirm("Cancel renewal for this plan? Your access will continue through the current paid period.")) return;
    setWorking(`cancel-${subscription.id}`);
    setMessage(null);
    try {
      const response = await fetch("/api/billing/cancel", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subscriptionId: subscription.id }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Cancellation could not be completed.");
      setMessage({ text: "Renewal cancelled. Your plan remains active until the current period ends." });
      addToast("Renewal cancelled", "You’ll keep plan access through the end of the billing period.", "success");
      await load();
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : "Cancellation could not be completed.", error: true });
    } finally { setWorking(null); }
  };

  const active = data?.current;
  const plans: KeeperPlanId[] = ["basic", "pro"];

  return (
    <section className="keeper-billing" aria-labelledby="billing-title">
      <div className="keeper-billing-heading">
        <div>
          <p className="keeper-billing-eyebrow">YOUR SUBSCRIPTION</p>
          <h2 id="billing-title">Plan &amp; billing</h2>
          <p>Manage your Keeper plan, renewal dates, and receipts in one place.</p>
        </div>
        <button className="keeper-billing-refresh" type="button" onClick={() => void load()} disabled={loading} aria-label="Refresh billing details"><RefreshCw size={15} className={loading ? "animate-spin" : ""} /> Refresh</button>
      </div>

      {message && <div className={`keeper-billing-message${message.error ? " is-error" : ""}`} role="status">{message.error ? <XCircle size={17} /> : <Check size={17} />}<span>{message.text}</span></div>}

      {loading ? <div className="keeper-billing-loading"><Loader2 size={18} className="animate-spin" /> Loading your billing details…</div> : data && <>
        <article className="keeper-current-plan">
          <div className="keeper-current-plan-top">
            <div className="keeper-current-plan-icon"><ShieldCheck size={18} /></div>
            <div><span className="keeper-current-label">CURRENT PLAN</span><h3>{active ? `${planTitle(active.plan)}${active.status === "trialing" ? " trial" : ""}` : "Free"}</h3></div>
            <span className={`keeper-plan-status ${active ? "is-active" : "is-free"}`}>{active ? active.cancel_at_cycle_end ? "CANCELS AT PERIOD END" : active.status.toUpperCase() : "ACTIVE"}</span>
          </div>
          {active ? <>
            <p className="keeper-current-price">{money(active.amount, active.currency)} <span>/ {active.billing_cycle === "monthly" ? "month" : "year"}</span></p>
            <div className="keeper-billing-facts">
              <div><span>Plan started</span><strong>{date(active.current_period_start || active.created_at)}</strong></div>
              <div><span>{active.cancel_at_cycle_end ? "Access ends" : active.status === "trialing" ? "Trial ends" : "Period ends"}</span><strong>{date(active.current_period_end || active.trial_ends_at)}</strong></div>
              <div><span>Next payment</span><strong>{active.cancel_at_cycle_end ? "No renewal" : date(active.next_payment_at)}</strong></div>
            </div>
            <div className="keeper-subscription-ref"><span>Subscription reference</span><code>{active.razorpay_subscription_id}</code></div>
            {active.status === "trialing" && <p className="keeper-trial-note"><Clock3 size={14} /> 7-day trial · First charge {date(active.trial_ends_at)} · Cancel anytime before renewal</p>}
            <div className="keeper-current-actions">
              {!active.cancel_at_cycle_end && <button type="button" className="keeper-cancel-plan" disabled={working === `cancel-${active.id}`} onClick={() => void cancel(active)}>{working === `cancel-${active.id}` ? <Loader2 size={15} className="animate-spin" /> : null} Cancel plan</button>}
              <a href="https://razorpay.com" target="_blank" rel="noreferrer" className="keeper-razorpay-note">Payments securely handled by Razorpay <ExternalLink size={13} /></a>
            </div>
          </> : <div className="keeper-free-plan-copy"><p>You’re using Keeper Free. Choose Basic or Pro below to unlock a larger save allowance and expanded import features.</p><span>No active paid plan or upcoming charge.</span></div>}
        </article>

        <div className="keeper-plan-picker-heading"><div><h3>{active ? "Your plan options" : "Choose your plan"}</h3><p>{active ? "To change plans, cancel renewal first; your current access stays active through the period." : "Every paid plan starts with a 7-day free trial."}</p></div>
          <div className="keeper-billing-cycle" role="group" aria-label="Billing frequency">
            <button type="button" aria-pressed={cycle === "monthly"} className={cycle === "monthly" ? "selected" : ""} onClick={() => setCycle("monthly")}>Monthly</button>
            <button type="button" aria-pressed={cycle === "yearly"} className={cycle === "yearly" ? "selected" : ""} onClick={() => setCycle("yearly")}>Yearly <span>Save</span></button>
          </div>
        </div>
        <div className="keeper-billing-plans">
          {plans.map((plan) => {
            const planInfo = KEEPER_BILLING_PLANS[plan][cycle];
            const isCurrent = active?.plan === plan && active.billing_cycle === cycle && !active.cancel_at_cycle_end;
            const hasActivePlan = Boolean(active && ["trialing", "authenticated", "active"].includes(active.status));
            return <article key={plan} className={`keeper-billing-plan${plan === "pro" ? " featured" : ""}`}>
              <div className="keeper-billing-plan-title"><span>{planTitle(plan)}</span>{plan === "pro" && <b>MOST POPULAR</b>}</div>
              <p className="keeper-billing-plan-price">{money(planInfo.amount, "INR")}<span> / {cycle === "monthly" ? "month" : "year"}</span></p>
              <p className="keeper-billing-plan-trial">7 days free, then {money(planInfo.amount, "INR")}/{cycle === "monthly" ? "month" : "year"}</p>
              <ul>
                <li><Check size={15} />{planInfo.credits < 0 ? "Unlimited saves and imports" : `${planInfo.credits.toLocaleString("en-IN")} import credits per ${cycle === "monthly" ? "month" : "year"}`}</li>
                <li><Check size={15} />Bulk import from supported sources</li>
                <li><Check size={15} />AI summaries and searchable collections</li>
                <li><Check size={15} />No separate bulk-import fee</li>
                {plan === "pro" && <li><Check size={15} />Priority access to advanced organization tools</li>}
              </ul>
              <button type="button" className="keeper-billing-plan-button" disabled={Boolean(working) || isCurrent || hasActivePlan} onClick={() => void beginPlan(plan)}>{working === `${plan}-${cycle}` ? <><Loader2 size={15} className="animate-spin" /> Opening checkout…</> : isCurrent ? "Current plan" : hasActivePlan ? "Current cycle active" : <>Start 7-day trial <ArrowRight size={15} /></>}</button>
            </article>;
          })}
        </div>
        <p className="keeper-billing-footnote">Your selected plan renews automatically after the trial. Cancel anytime from this page. Prices are in INR and billed through Razorpay.</p>

        <section className="keeper-payment-history" aria-labelledby="payment-history-title">
          <div className="keeper-payment-history-heading"><div className="keeper-history-icon"><ReceiptText size={17} /></div><div><h3 id="payment-history-title">Payment history</h3><p>Receipts and previous plan charges</p></div></div>
          {data.payments.length ? <div className="keeper-payment-table-wrap"><table><thead><tr><th>Date</th><th>Plan</th><th>Status</th><th>Payment ID</th><th>Amount</th><th>Receipt</th></tr></thead><tbody>{data.payments.map((payment) => <tr key={payment.id}><td>{date(payment.paid_at)}</td><td>{planTitle(payment.plan)} · {payment.billing_cycle}</td><td><span className="keeper-payment-status">{payment.status}</span></td><td><code title={payment.razorpay_payment_id}>{payment.razorpay_payment_id}</code></td><td>{money(payment.amount, payment.currency)}</td><td>{payment.receipt_url ? <a href={payment.receipt_url} target="_blank" rel="noreferrer" aria-label="Open payment receipt"><ExternalLink size={15} /></a> : "—"}</td></tr>)}</tbody></table></div> : <div className="keeper-payment-empty"><CreditCard size={18} /><span>Your paid invoices and renewal charges will appear here.</span></div>}
        </section>
          {data.subscriptions.filter((entry) => !active || entry.id !== active.id).length > 0 && <div className="keeper-previous-plans"><h3>Previous plans</h3>{data.subscriptions.filter((entry) => !active || entry.id !== active.id).map((entry) => <div key={entry.id}><span>{planTitle(entry.plan)} · {entry.billing_cycle}</span><span>{entry.status} · {date(entry.current_period_start || entry.created_at)} – {date(entry.current_period_end || entry.trial_ends_at)}</span></div>)}</div>}
        <p className="keeper-billing-pricing-link">Need a full feature comparison? <Link href="/#pricing">View plan details <ArrowRight size={13} /></Link></p>
      </>}
    </section>
  );
}
