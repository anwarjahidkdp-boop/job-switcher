import { SiteHeader } from "@/components/SiteHeader";
import { requireUser, trialLabel } from "@/lib/server/page";
import { proPlan, proPriceFor } from "@/lib/server/billing";
import { formatPrice, PAYABLE_CURRENCIES, perDay } from "@/lib/billing/pricing";
import { cname } from "@/lib/countries";
import Link from "next/link";
import { billingConfig, formatTaka } from "@/lib/billing/manual";
import { fmtDate } from "@/lib/dates";
import { CheckoutButton, ManualPaymentForm } from "./client";

export const metadata = { title: "Upgrade to Pro" };

const BANNERS: Record<string, [string, string]> = {
  success: ["ok", "Payment confirmed by bKash. Pro is active."],
  cancel: ["warn", "You cancelled the bKash payment. Nothing was charged."],
  failure: ["warn", "bKash did not confirm the payment, so Pro was not activated. If money left your account, contact us with the TrxID."],
  error: ["warn", "We could not check the payment with bKash just now. If money left your account, contact us with the TrxID."],
  unknown: ["warn", "We could not find that payment."],
};
const inFuture = (iso: string) => Date.parse(iso) > Date.now();
const STATUS: Record<string, string> = { pending: "Waiting for review", approved: "Confirmed", rejected: "Not confirmed", failed: "Failed", canceled: "Cancelled", initiated: "Not finished" };

export default async function Upgrade({ searchParams }: { searchParams: Promise<{ payment?: string }> }) {
  const sp = await searchParams;
  const { supabase, user } = await requireUser("/upgrade");
  const [plan, label, subRes, payRes, profRes] = await Promise.all([
    proPlan(supabase),
    trialLabel(supabase, user.id),
    supabase.from("subscriptions").select("plan_code, status, trial_ends_at, current_period_end").eq("user_id", user.id).maybeSingle(),
    supabase.from("payments").select("id, method, amount_minor, trx_id, status, period_end, review_note, created_at").eq("user_id", user.id).neq("status", "initiated").order("created_at", { ascending: false }).limit(10),
    supabase.from("profiles").select("home_country").eq("id", user.id).maybeSingle(),
  ]);
  const local = await proPriceFor(supabase, profRes.data?.home_country);
  const payable = PAYABLE_CURRENCIES.includes(local.currency);
  const cfg = payable ? billingConfig() : { manual: null, checkout: false };
  const sub = subRes.data;
  const payments = payRes.data || [];
  const price = formatTaka(plan.priceMinor);
  const banner = sp.payment ? BANNERS[sp.payment] : null;
  const activeUntil = sub?.status === "active" && sub.current_period_end && inFuture(sub.current_period_end) ? sub.current_period_end : null;
  return (
    <>
      <SiteHeader inApp={false} signedIn trialLabel={label} />
      <main><div className="wrap ob">
        <h1 style={{ fontSize: 30 }}>JobPao Pro</h1>
        <p className="muted" style={{ marginTop: 6 }}>{payable ? price : formatPrice(local.minor, local.currency)} for 30 days, about <b>{perDay(local)} a day</b>{local.currency === "BDT" ? ", less than one cup of tea" : ""}. AI CV building, tailored application packs, cover letters and alert reading. Matching and reminders keep working without Pro. No auto-renewal: you pay again when you want another month.</p>
        {banner ? <p className="note" style={{ marginTop: 14, borderColor: banner[0] === "ok" ? "var(--accent)" : "var(--warn)" }}>{banner[1]}</p> : null}
        <div className="card panel" style={{ marginTop: 18 }}>
          <h3>Your plan</h3>
          <p>{activeUntil ? <>Pro is active until <b>{fmtDate(activeUntil.slice(0, 10))} {activeUntil.slice(0, 4)}</b>. Paying now adds 30 days after that.</> : sub?.status === "trialing" ? <>Free trial{sub.trial_ends_at ? <> until <b>{fmtDate(sub.trial_ends_at.slice(0, 10))}</b></> : null}. Paying now starts 30 days of Pro today.</> : <>You are on the free plan. Paying starts 30 days of Pro.</>}</p>
        </div>
        {!payable ? <p className="note" style={{ marginTop: 18 }}>Online payment for people living in {local.country === "XX" ? "your country" : cname(local.country)} is coming soon. bKash works only in Bangladesh. If you live in Bangladesh, change <b>I live in</b> on your <Link href="/profile">profile</Link>.</p> : null}
        {payable && !cfg.manual && !cfg.checkout ? <p className="note" style={{ marginTop: 18 }}>Payments are not open yet. Your trial features keep working until the trial ends.</p> : null}
        {cfg.checkout ? (
          <div className="card panel stack" style={{ marginTop: 14 }}>
            <h3 style={{ margin: 0 }}>Pay with bKash</h3>
            <p className="small muted">You will go to bKash&apos;s own page to approve {price} with your bKash PIN and OTP. We never see your PIN. Pro starts as soon as bKash confirms the payment.</p>
            <CheckoutButton label={`Pay ${price} with bKash`} />
          </div>
        ) : null}
        {cfg.manual ? (
          <div className="card panel stack" style={{ marginTop: 14 }}>
            <h3 style={{ margin: 0 }}>{cfg.checkout ? "Or pay from the bKash app" : "Pay from the bKash app"}</h3>
            <ol className="small" style={{ paddingLeft: 18, margin: 0, lineHeight: 1.7 }}>
              <li>Open the bKash app and choose <b>{cfg.manual.accountType === "merchant" ? "Payment" : cfg.manual.accountType === "agent" ? "Cash Out" : "Send Money"}</b>.</li>
              <li>Enter this number: <b style={{ fontSize: 16, letterSpacing: 0.5 }}>{cfg.manual.number}</b> ({cfg.manual.accountType === "merchant" ? "merchant account" : cfg.manual.accountType === "agent" ? "agent" : "personal account"}).</li>
              <li>Amount: <b>{price}</b>. In Reference, write your email if the app asks.</li>
              <li>Finish with your PIN. bKash shows a Transaction ID (TrxID) and sends it by SMS.</li>
              <li>Enter the TrxID and the number you paid from below. We check it in our bKash statement, usually within a few hours, and email you when Pro is active.</li>
            </ol>
            <ManualPaymentForm />
            <p className="small muted">Never share your bKash PIN or OTP with anyone, including us.</p>
          </div>
        ) : null}
        {payments.length ? (
          <div className="card panel" style={{ marginTop: 14 }}>
            <h3>Your payments</h3>
            <table className="small" style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr><th align="left">Date</th><th align="left">Amount</th><th align="left">TrxID</th><th align="left">Status</th></tr></thead>
              <tbody>{payments.map((p) => <tr key={p.id}><td>{fmtDate(p.created_at.slice(0, 10))}</td><td>{formatTaka(p.amount_minor)}</td><td>{p.trx_id || "-"}</td><td>{STATUS[p.status] || p.status}{p.status === "rejected" && p.review_note ? `: ${p.review_note}` : ""}</td></tr>)}</tbody>
            </table>
          </div>
        ) : null}
      </div></main>
    </>
  );
}
