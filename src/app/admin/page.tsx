import Link from "next/link";
import { PageHead } from "@/components/PageHead";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatPrice } from "@/lib/billing/pricing";
import { requireAdmin } from "./payments/actions";

export const metadata = { title: "Admin dashboard" };
export const dynamic = "force-dynamic";

type Row = { code: string; name: string; n: number };
interface Stats {
  users: number; onboarded: number; signups_7d: number; signups_30d: number; by_target: Row[]; by_home: Row[];
  trial_active: number; trial_ended: number; trial_ended_unpaid: number; paid_users: number; pro_active: number; renewed: number; lapsed: number;
  revenue: { currency: string; total: number; last_30d: number | null; n: number }[]; pending_payments: number;
  apps_by_status: Record<string, number>; packs_prepared: number; users_applied: number; users_interview: number; users_offer: number;
  jobs_active: number; jobs_new_24h: number; jobs_by_country: Row[]; sources: { active: number; ok: number; error: number }; ai_spend_month_micro: number;
  recent: { email: string | null; full_name: string | null; target_country: string; home_country: string; onboarding_step: string; created_at: string; status: string | null; trial_ends_at: string | null; current_period_end: string | null; applied: number; interviews: number }[];
}

const pct = (a: number, b: number) => (b ? `${Math.round((100 * a) / b)}%` : "–");
const day = (s: string | null) => (s ? new Date(s).toLocaleDateString("en-GB", { timeZone: "Asia/Dhaka", day: "numeric", month: "short" }) : "–");
const plan = (r: Stats["recent"][number]) => {
  const now = new Date().toISOString();
  if (r.status === "trialing") return r.trial_ends_at && r.trial_ends_at > now ? `Trial to ${day(r.trial_ends_at)}` : "Trial ended";
  if (r.status === "active") return r.current_period_end && r.current_period_end < now ? "Pro lapsed" : `Pro to ${day(r.current_period_end)}`;
  return r.status || "–";
};

function Tiles({ items }: { items: [string, string | number, string?][] }) {
  return <div className="tiles" style={{ marginTop: 10 }}>{items.map(([l, n, sub]) => <div key={l} className="card tile"><b>{n}</b><span className="small muted">{l}</span>{sub ? <span className="small muted">{sub}</span> : null}</div>)}</div>;
}
function Bars({ rows, total }: { rows: Row[]; total: number }) {
  if (!rows.length) return <p className="small muted">No data yet.</p>;
  return <div className="stack" style={{ gap: 6 }}>{rows.map((r) => (
    <div key={r.code} className="row" style={{ gap: 10, flexWrap: "nowrap" }}>
      <span className="small" style={{ width: 150, flex: "none" }}>{r.code === "XX" ? "Other / unknown" : r.name}</span>
      <div className="bar" style={{ flex: 1 }}><i style={{ width: `${Math.max(2, Math.round((100 * r.n) / Math.max(total, 1)))}%` }} /></div>
      <b className="num small" style={{ width: 48, textAlign: "right" }}>{r.n}</b>
    </div>))}</div>;
}

export default async function AdminDashboard() {
  await requireAdmin();
  const { data, error } = await createAdminClient().rpc("admin_stats");
  if (error || !data) throw new Error("Could not load admin stats: " + (error?.message || "no data"));
  const s = data as Stats;
  const st = s.apps_by_status;
  const appsSent = (st.applied || 0) + (st.interview || 0) + (st.offer || 0) + (st.closed || 0);
  return (
    <>
      <SiteHeader inApp={false} signedIn />
      <main><div className="wrap">
        <PageHead kicker="Admin" title={<>JobPao <span>dashboard</span></>} sub="Live numbers from the database. Times in Dhaka time." />
        <div className="row" style={{ marginTop: 10 }}><Link className="btn btn-ghost btn-sm" href="/admin/payments">bKash payments{s.pending_payments ? ` (${s.pending_payments} to review)` : ""}</Link></div>

        <h2 style={{ fontSize: 20, marginTop: 22 }}>Users</h2>
        <Tiles items={[["Total users", s.users], ["Finished onboarding", s.onboarded, pct(s.onboarded, s.users)], ["New in 7 days", s.signups_7d], ["New in 30 days", s.signups_30d]]} />

        <h2 style={{ fontSize: 20, marginTop: 22 }}>Trial, Pro and renewals</h2>
        <Tiles items={[["Trials running", s.trial_active], ["Trials ended", s.trial_ended], ["Ended, did not pay", s.trial_ended_unpaid, pct(s.trial_ended_unpaid, s.trial_ended)], ["Paying users (ever)", s.paid_users, `${pct(s.paid_users, s.trial_ended)} of ended trials`], ["Pro active now", s.pro_active], ["Renewed (2+ payments)", s.renewed, pct(s.renewed, s.paid_users)], ["Pro lapsed, not renewed", s.lapsed]]} />
        <div className="card panel" style={{ marginTop: 12 }}><h3>Revenue (approved payments)</h3>
          {s.revenue.length ? s.revenue.map((r) => <div key={r.currency} className="qitem"><span>{r.currency} · {r.n} payment{r.n === 1 ? "" : "s"}</span><span><b className="num">{formatPrice(r.total, r.currency)}</b> <span className="small muted">({formatPrice(r.last_30d || 0, r.currency)} in 30 days)</span></span></div>) : <p className="small muted">No approved payments yet.</p>}
        </div>

        <h2 style={{ fontSize: 20, marginTop: 22 }}>Applications and interviews</h2>
        <Tiles items={[["Applications prepared", s.packs_prepared], ["Applications sent", appsSent], ["Users who applied", s.users_applied, pct(s.users_applied, s.onboarded)], ["Interviews", (st.interview || 0) + (st.offer || 0)], ["Users with an interview", s.users_interview, pct(s.users_interview, s.users_applied)], ["Offers", st.offer || 0], ["Rejected / closed", st.closed || 0]]} />

        <div className="dash" style={{ marginTop: 22 }}>
          <div className="card panel"><h3>Where users want to work</h3><Bars rows={s.by_target} total={s.users} /></div>
          <div className="side"><div className="card panel"><h3>Where users live</h3><Bars rows={s.by_home} total={s.users} /></div></div>
        </div>

        <h2 style={{ fontSize: 20, marginTop: 22 }}>Jobs and costs</h2>
        <Tiles items={[["Active jobs", s.jobs_active], ["New in 24 hours", s.jobs_new_24h], ["Sources working", `${s.sources.ok}/${s.sources.active}`, s.sources.error ? `${s.sources.error} failing` : undefined], ["AI spend this month", `$${(s.ai_spend_month_micro / 1e6).toFixed(2)}`]]} />
        <div className="card panel" style={{ marginTop: 12 }}><h3>Active jobs by country (top 12)</h3><Bars rows={s.jobs_by_country} total={s.jobs_active} /></div>

        <h2 style={{ fontSize: 20, marginTop: 22 }}>Newest users</h2>
        <div style={{ overflowX: "auto" }}>
          <table className="small" style={{ width: "100%", borderCollapse: "collapse", marginTop: 8, minWidth: 720 }}>
            <thead><tr><th align="left">Joined</th><th align="left">User</th><th align="left">Wants</th><th align="left">Lives</th><th align="left">Plan</th><th align="right">Applied</th><th align="right">Interviews</th><th align="left">Onboarding</th></tr></thead>
            <tbody>{s.recent.map((r, i) => (
              <tr key={i} style={{ borderTop: "1px solid var(--line)" }}><td>{day(r.created_at)}</td><td>{r.full_name || "–"}<br /><span className="muted">{r.email || ""}</span></td><td>{r.target_country}</td><td>{r.home_country}</td><td>{plan(r)}</td><td align="right">{r.applied}</td><td align="right">{r.interviews}</td><td>{r.onboarding_step}</td></tr>
            ))}</tbody>
          </table>
        </div>
      </div></main>
      <SiteFooter signedIn />
    </>
  );
}
