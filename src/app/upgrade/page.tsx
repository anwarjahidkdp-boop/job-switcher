import { packLimits } from "@/lib/pack-limits";
import { PageHead } from "@/components/PageHead";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { requireUser, trialLabel } from "@/lib/server/page";
import { chargedPrice, formatPrice, isPack, localHint, packPrice, PACKS, PAYABLE_CURRENCIES, DEFAULT_PACK } from "@/lib/billing/pricing";
import { lemonConfig } from "@/lib/billing/lemonsqueezy";
import { cname } from "@/lib/countries";
import Link from "next/link";
import { billingConfig, formatTaka } from "@/lib/billing/manual";
import { fmtDate } from "@/lib/dates";
import { CardCheckoutButton, CheckoutButton, ManualPaymentForm } from "./client";

export const metadata = { title: "Upgrade to Pro" };

const BANNERS: Record<string, [string, string]> = {
  success: ["ok", "Payment confirmed by bKash. Pro is active."],
  cancel: ["warn", "You cancelled the bKash payment. Nothing was charged."],
  failure: ["warn", "bKash did not confirm the payment, so Pro was not activated. If money left your account, contact us with the TrxID."],
  error: ["warn", "We could not check the payment with bKash just now. If money left your account, contact us with the TrxID."],
  unknown: ["warn", "We could not find that payment."],
  card: ["ok", "Thank you. Pro starts as soon as Lemon Squeezy confirms your card payment, usually within a minute. Refresh this page to see it."],
};
const inFuture = (iso: string) => Date.parse(iso) > Date.now();
const STATUS: Record<string, string> = { pending: "Waiting for review", approved: "Confirmed", rejected: "Not confirmed", failed: "Failed", canceled: "Cancelled", initiated: "Not finished" };

export default async function Upgrade({ searchParams }: { searchParams: Promise<{ payment?: string; pack?: string }> }) {
  const sp = await searchParams;
  const { supabase, user } = await requireUser("/upgrade");
  const [label, subRes, payRes, profRes] = await Promise.all([
    trialLabel(supabase, user.id),
    supabase.from("subscriptions").select("plan_code, status, trial_ends_at, current_period_end").eq("user_id", user.id).maybeSingle(),
    supabase.from("payments").select("id, method, amount_minor, currency, trx_id, status, period_end, review_note, created_at").eq("user_id", user.id).neq("status", "initiated").order("created_at", { ascending: false }).limit(10),
    supabase.from("profiles").select("home_country").eq("id", user.id).maybeSingle(),
  ]);
  const home = profRes.data?.home_country;
  const pack = isPack(sp.pack) ? sp.pack : DEFAULT_PACK;
  const local = packPrice(home, pack);
  const month = packPrice(home, "30d");
  const payable = PAYABLE_CURRENCIES.includes(local.currency);
  const cfg = payable ? billingConfig() : { manual: null, checkout: false };
  const sub = subRes.data;
  const payments = payRes.data || [];
  const price = formatTaka(local.minor);
  const span = local.name;
  const card = !payable && !!lemonConfig();
  const usd = formatPrice(local.usd, "USD");
  const where = local.country === "XX" ? "your chosen country" : cname(local.country);
  const banner = sp.payment ? BANNERS[sp.payment] : null;
  const activeUntil = sub?.status === "active" && sub.current_period_end && inFuture(sub.current_period_end) ? sub.current_period_end : null;
  return (
    <>
      <SiteHeader inApp={false} signedIn trialLabel={label} />
      <main><div className="wrap">
        <PageHead kicker="Pricing" title={<>JobPao <span>Pro</span></>} sub={<><b>{local.currency === "BDT" ? "Your own job assistant for the price of one cup of tea a day." : "Your own job assistant for less than a coffee a day."}</b> AI CV building, tailored application packs, cover letters and alert reading. Matching and reminders keep working without Pro. Pay once for the time you need, with no auto-renewal.</>} />
        <div className="ob">
        {banner ? <p className="note" style={{ marginTop: 14, borderColor: banner[0] === "ok" ? "var(--accent)" : "var(--warn)" }}>{banner[1]}</p> : null}
        <div className="card panel" style={{ marginTop: 18 }}>
          <h3>Your plan</h3>
          <p>{activeUntil ? <>Pro is active until <b>{fmtDate(activeUntil.slice(0, 10))} {activeUntil.slice(0, 4)}</b>. Paying now adds {span} after that.</> : sub?.status === "trialing" ? <>Free trial{sub.trial_ends_at ? <> until <b>{fmtDate(sub.trial_ends_at.slice(0, 10))}</b></> : null}. Paying now starts {span} of Pro today.</> : <>You are on the free plan. Paying starts {span} of Pro.</>}</p>
        </div>
        {(() => { const l = packLimits("pro", home); return <p className="small muted" style={{ marginTop: 10 }}>Pro includes up to <b>{l.day} AI-tailored applications a day</b> (CV + cover letter for one job), up to {l.week} a week and {l.month} a month. After that you still get the standard version, free.</p>; })()}
        <div className="packs" role="radiogroup" aria-label="Choose your Pro pack">
          {PACKS.map((k) => {
            const p = packPrice(home, k.id), c = chargedPrice(p), hint = localHint(p);
            const full = chargedPrice(month).minor * (k.days / 30);
            const save = k.days > 30 ? Math.round((1 - c.minor / full) * 100) : 0;
            const tag = k.id === "30d" ? "Most popular" : k.id === "365d" ? "Best value" : "";
            return (
              <Link key={k.id} href={`/upgrade?pack=${k.id}`} scroll={false} replace role="radio" aria-checked={k.id === pack} className={`pack ${k.id === pack ? "on" : ""}`}>
                {tag ? <span className="pack-tag">{tag}</span> : null}
                <span className="pack-name">{k.name}</span>
                <span className="pack-amt num">{formatPrice(c.minor, c.currency)}</span>
                {hint ? <span className="pack-local small">{hint}</span> : null}
                <span className="pack-sub small">{k.days > 30 ? <>{formatPrice(Math.round(c.minor / (k.days / 30) / (c.currency === "BDT" ? 100 : 1)) * (c.currency === "BDT" ? 100 : 1), c.currency)} a month{save > 0 ? <b> · save {save}%</b> : null}</> : k.days === 15 ? "Try it for a short search" : "Pay month by month"}</span>
              </Link>
            );
          })}
        </div>
        {!payable ? (
          <div className="card panel stack" style={{ marginTop: 14 }}>
            <h3 style={{ margin: 0 }}>Pay by card</h3>
            <p className="small muted">Living in {where}: <b>{usd}</b> for {span}{localHint(local) ? <>, {localHint(local)}. Your card is charged in US dollars and your bank converts it, so the amount on your statement can differ slightly</> : null}. Secure checkout by Lemon Squeezy, our payment partner: Visa, Mastercard, Amex, Apple Pay and Google Pay. We never see your card details. Your price follows the country you live in; change it on your <Link href="/profile">profile</Link>.</p>
            {card ? <CardCheckoutButton label={`Pay ${usd} by card`} pack={pack} /> : <p className="note">Card payment opens very soon. Your trial features keep working until the trial ends.</p>}
          </div>
        ) : null}
        {payable && !cfg.manual && !cfg.checkout ? <p className="note" style={{ marginTop: 18 }}>Payments are not open yet. Your trial features keep working until the trial ends.</p> : null}
        {cfg.checkout ? (
          <div className="card panel stack" style={{ marginTop: 14 }}>
            <h3 style={{ margin: 0 }}>Pay with bKash</h3>
            <p className="small muted">You will go to bKash&apos;s own page to approve {price} with your bKash PIN and OTP. We never see your PIN. Pro starts as soon as bKash confirms the payment.</p>
            <CheckoutButton label={`Pay ${price} with bKash`} pack={pack} />
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
            <ManualPaymentForm pack={pack} />
            <p className="small muted">Never share your bKash PIN or OTP with anyone, including us.</p>
          </div>
        ) : null}
        {payments.length ? (
          <div className="card panel" style={{ marginTop: 14 }}>
            <h3>Your payments</h3>
            <table className="small" style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr><th align="left">Date</th><th align="left">Amount</th><th align="left">TrxID</th><th align="left">Status</th></tr></thead>
              <tbody>{payments.map((p) => <tr key={p.id}><td>{fmtDate(p.created_at.slice(0, 10))}</td><td>{p.currency && p.currency !== "BDT" ? formatPrice(p.amount_minor, p.currency) : formatTaka(p.amount_minor)}</td><td>{p.trx_id || "-"}</td><td>{STATUS[p.status] || p.status}{p.status === "rejected" && p.review_note ? `: ${p.review_note}` : ""}</td></tr>)}</tbody>
            </table>
          </div>
        ) : null}
      </div></div></main>
      <SiteFooter signedIn />
    </>
  );
}
