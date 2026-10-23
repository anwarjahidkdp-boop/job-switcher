import Link from "next/link";
import { PageHead } from "@/components/PageHead";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatPrice } from "@/lib/billing/pricing";
import { requireAdmin } from "./payments/actions";
import { nowMs } from "@/lib/today";
import { loadUsers } from "./data";
import { UserTable } from "./ui";

export const metadata = { title: "Admin dashboard" };
export const dynamic = "force-dynamic";

type Row = { code: string; name: string; n: number };
interface Stats {
  users: number; onboarded: number; signups_7d: number; signups_30d: number; by_target: Row[]; by_home: Row[];
  trial_active: number; trial_ended: number; trial_ended_unpaid: number; paid_users: number; pro_active: number; renewed: number; lapsed: number;
  revenue: { currency: string; total: number; last_30d: number | null; n: number }[]; pending_payments: number;
  apps_by_status: Record<string, number>; packs_prepared: number; users_applied: number; users_interview: number; users_offer: number;
  jobs_active: number; jobs_new_24h: number; jobs_by_country: Row[]; sources: { active: number; ok: number; error: number }; ai_spend_month_micro: number;
}

const pct = (a: number, b: number) => (b ? `${Math.round((100 * a) / b)}%` : "–");
/** Each tile links to the list behind its number (/admin/list?k=...). */
function Tiles({ items }: { items: [string, string | number, string | undefined, string][] }) {
  return <div className="tiles" style={{ marginTop: 10 }}>{items.map(([l, n, sub, k]) => (
    <Link key={l} href={`/admin/list?k=${encodeURIComponent(k)}`} className="card tile tile-link"><b>{n}</b><span className="small muted">{l}</span>{sub ? <span className="small muted">{sub}</span> : null}<span className="small tile-more">See list →</span></Link>
  ))}</div>;
}
function Bars({ rows, total, k }: { rows: Row[]; total: number; k: string }) {
  if (!rows.length) return <p className="small muted">No data yet.</p>;
  return <div className="stack" style={{ gap: 6 }}>{rows.map((r) => (
    <div key={r.code} className="row" style={{ gap: 10, flexWrap: "nowrap" }}>
      <Link className="small" href={`/admin/list?k=${k}:${r.code}`} style={{ width: 150, flex: "none" }}>{r.code === "XX" ? "Other / unknown" : r.name}</Link>
      <div className="bar" style={{ flex: 1 }}><i style={{ width: `${Math.max(2, Math.round((100 * r.n) / Math.max(total, 1)))}%` }} /></div>
      <b className="num small" style={{ width: 48, textAlign: "right" }}>{r.n}</b>
    </div>))}</div>;
}

export default async function AdminDashboard() {
  await requireAdmin();
  const { data, error } = await createAdminClient().rpc("admin_stats");
  if (error || !data) throw new Error("Could not load admin stats: " + (error?.message || "no data"));
  const s = data as Stats;
  const now = nowMs();
  const newest = (await loadUsers(createAdminClient())).slice(0, 25);
  const st = s.apps_by_status;
  const appsSent = (st.applied || 0) + (st.interview || 0) + (st.offer || 0) + (st.closed || 0);
  return (
    <>
      <SiteHeader inApp={false} signedIn />
      <main><div className="wrap">
        <PageHead kicker="Admin" title={<>JobPao <span>dashboard</span></>} sub="Live numbers from the database. Times in Dhaka time." />
        <div className="row" style={{ marginTop: 10 }}><Link className="btn btn-ghost btn-sm" href="/admin/payments">bKash payments{s.pending_payments ? ` (${s.pending_payments} to review)` : ""}</Link><Link className="btn btn-ghost btn-sm" href="/admin/list?k=source_documents">Circulars awaiting review</Link></div>

        <h2 style={{ fontSize: 20, marginTop: 22 }}>Users</h2>
        <Tiles items={[["Total users", s.users, undefined, "users"], ["Finished onboarding", s.onboarded, pct(s.onboarded, s.users), "onboarded"], ["Did not finish onboarding", s.users - s.onboarded, undefined, "not_onboarded"], ["New in 7 days", s.signups_7d, undefined, "new7"], ["New in 30 days", s.signups_30d, undefined, "new30"]]} />

        <h2 style={{ fontSize: 20, marginTop: 22 }}>Trial, Pro and renewals</h2>
        <Tiles items={[["Trials running", s.trial_active, undefined, "trial_active"], ["Trials ended", s.trial_ended, undefined, "trial_ended"], ["Ended, did not pay", s.trial_ended_unpaid, pct(s.trial_ended_unpaid, s.trial_ended), "trial_unpaid"], ["Paying users (ever)", s.paid_users, `${pct(s.paid_users, s.trial_ended)} of ended trials`, "paid"], ["Pro active now", s.pro_active, undefined, "pro_active"], ["Renewed (2+ payments)", s.renewed, pct(s.renewed, s.paid_users), "renewed"], ["Pro lapsed, not renewed", s.lapsed, undefined, "lapsed"]]} />
        <div className="card panel" style={{ marginTop: 12 }}><h3>Revenue (approved payments) <Link className="small" href="/admin/payments" style={{ fontWeight: 400 }}>See payments →</Link></h3>
          {s.revenue.length ? s.revenue.map((r) => <div key={r.currency} className="qitem"><span>{r.currency} · {r.n} payment{r.n === 1 ? "" : "s"}</span><span><b className="num">{formatPrice(r.total, r.currency)}</b> <span className="small muted">({formatPrice(r.last_30d || 0, r.currency)} in 30 days)</span></span></div>) : <p className="small muted">No approved payments yet.</p>}
        </div>

        <h2 style={{ fontSize: 20, marginTop: 22 }}>Applications and interviews</h2>
        <Tiles items={[["Applications prepared", s.packs_prepared, undefined, "prepared"], ["Applications sent", appsSent, undefined, "sent"], ["Users who applied", s.users_applied, pct(s.users_applied, s.onboarded), "users_applied"], ["Interviews", (st.interview || 0) + (st.offer || 0), undefined, "interviews"], ["Users with an interview", s.users_interview, pct(s.users_interview, s.users_applied), "users_interview"], ["Offers", st.offer || 0, undefined, "offers"], ["Rejected / closed", st.closed || 0, undefined, "closed"]]} />

        <div className="dash" style={{ marginTop: 22 }}>
          <div className="card panel"><h3>Where users want to work</h3><Bars rows={s.by_target} total={s.users} k="target" /></div>
          <div className="side"><div className="card panel"><h3>Where users live</h3><Bars rows={s.by_home} total={s.users} k="home" /></div></div>
        </div>

        <h2 style={{ fontSize: 20, marginTop: 22 }}>Jobs and costs</h2>
        <Tiles items={[["Active jobs", s.jobs_active, undefined, "jobs"], ["New in 24 hours", s.jobs_new_24h, undefined, "jobs_new"], ["Sources working", `${s.sources.ok}/${s.sources.active}`, undefined, "sources"], ["Sources failing", s.sources.error, undefined, "sources_failing"], ["AI spend this month", `$${(s.ai_spend_month_micro / 1e6).toFixed(2)}`, "by user", "ai"]]} />
        <div className="card panel" style={{ marginTop: 12 }}><h3>Active jobs by country (top 12)</h3><Bars rows={s.jobs_by_country} total={s.jobs_active} k="jobs" /></div>

        <h2 style={{ fontSize: 20, marginTop: 22 }}>Newest users <Link className="small" href="/admin/list?k=users" style={{ fontWeight: 400 }}>See all →</Link></h2>
        <p className="small muted">Click a name to see that user&apos;s plan, payments and applications.</p>
        <UserTable rows={newest} now={now} />
      </div></main>
      <SiteFooter signedIn />
    </>
  );
}
