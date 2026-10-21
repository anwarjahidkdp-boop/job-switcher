// Shared admin tables: users, applications, jobs, sources. Server components only.
import Link from "next/link";
import { cname } from "@/lib/countries";
import type { AdminApp, AdminJob, AdminSource, AdminUser } from "./data";

export const day = (s: string | null) => (s ? new Date(s).toLocaleDateString("en-GB", { timeZone: "Asia/Dhaka", day: "numeric", month: "short" }) : "–");
export const when = (s: string | null) => (s ? new Date(s).toLocaleString("en-GB", { timeZone: "Asia/Dhaka", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "–");

export function planLabel(u: Pick<AdminUser, "status" | "trial_ends_at" | "current_period_end">, now: number) {
  const t = (s: string | null) => (s ? Date.parse(s) : NaN);
  if (u.status === "trialing") return t(u.trial_ends_at) > now ? `Trial to ${day(u.trial_ends_at)}` : "Trial ended";
  if (u.status === "active") return t(u.current_period_end) <= now ? "Pro lapsed" : `Pro to ${day(u.current_period_end)}`;
  return u.status || "–";
}

const TABLE = { width: "100%", borderCollapse: "collapse" as const, marginTop: 8 };
const ROW = { borderTop: "1px solid var(--line)" };

export function UserTable({ rows, now }: { rows: AdminUser[]; now: number }) {
  if (!rows.length) return <p className="small muted" style={{ marginTop: 10 }}>Nobody here yet.</p>;
  return (
    <div style={{ overflowX: "auto" }}>
      <table className="small admin-t" style={{ ...TABLE, minWidth: 760 }}>
        <thead><tr><th align="left">Joined</th><th align="left">User</th><th align="left">Wants</th><th align="left">Lives</th><th align="left">Plan</th><th align="right">Payments</th><th align="right">Applied</th><th align="right">Interviews</th><th align="right">AI this month</th><th align="left">Onboarding</th></tr></thead>
        <tbody>{rows.map((u) => (
          <tr key={u.id} style={ROW}>
            <td>{day(u.created_at)}</td>
            <td><Link href={`/admin/user/${u.id}`}><b>{u.full_name || "No name yet"}</b></Link><br /><span className="muted">{u.email || ""}</span></td>
            <td>{cname(u.target_country)}</td><td>{cname(u.home_country)}</td><td>{planLabel(u, now)}</td>
            <td align="right">{u.payments}</td><td align="right">{u.applied}</td><td align="right">{u.interviews}</td><td align="right">${(u.ai_month_micro / 1e6).toFixed(2)}</td>
            <td>{u.onboarding_step === "done" ? "Done" : u.onboarding_step}</td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

const STATUS: Record<string, string> = { saved: "Saved", preparing: "Preparing", ready: "Ready to apply", applied: "Applied", interview: "Interview", offer: "Offer", closed: "Closed" };
export function AppTable({ rows, showUser = true }: { rows: AdminApp[]; showUser?: boolean }) {
  if (!rows.length) return <p className="small muted" style={{ marginTop: 10 }}>No applications here yet.</p>;
  return (
    <div style={{ overflowX: "auto" }}>
      <table className="small admin-t" style={{ ...TABLE, minWidth: 680 }}>
        <thead><tr><th align="left">Started</th>{showUser ? <th align="left">User</th> : null}<th align="left">Job</th><th align="left">Country</th><th align="left">Status</th><th align="left">Applied</th><th align="left">Interview</th></tr></thead>
        <tbody>{rows.map((a) => (
          <tr key={a.id} style={ROW}>
            <td>{day(a.created_at)}</td>
            {showUser ? <td><Link href={`/admin/user/${a.user_id}`}>{a.email || "User"}</Link></td> : null}
            <td><b>{a.title}</b><br /><span className="muted">{a.company}</span></td>
            <td>{a.country ? cname(a.country) : "–"}</td>
            <td>{STATUS[a.status] || a.status}{a.hasPack ? <span className="muted"> · pack ready</span> : null}</td>
            <td>{day(a.applied_at)}</td><td>{when(a.interview_at)}</td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

export function JobTable({ rows }: { rows: AdminJob[] }) {
  if (!rows.length) return <p className="small muted" style={{ marginTop: 10 }}>No jobs here.</p>;
  return (
    <div style={{ overflowX: "auto" }}>
      <table className="small admin-t" style={{ ...TABLE, minWidth: 680 }}>
        <thead><tr><th align="left">Added</th><th align="left">Job</th><th align="left">Where</th><th align="left">Source</th></tr></thead>
        <tbody>{rows.map((j) => (
          <tr key={j.id} style={ROW}>
            <td>{day(j.created_at)}</td>
            <td>{j.url ? <a href={j.url} target="_blank" rel="noopener noreferrer"><b>{j.title}</b></a> : <b>{j.title}</b>}<br /><span className="muted">{j.company}</span></td>
            <td>{j.location || cname(j.country)}</td>
            <td>{j.source_label || j.source_kind || "–"}</td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

export function SourceTable({ rows }: { rows: AdminSource[] }) {
  if (!rows.length) return <p className="small muted" style={{ marginTop: 10 }}>No sources here.</p>;
  return (
    <div style={{ overflowX: "auto" }}>
      <table className="small admin-t" style={{ ...TABLE, minWidth: 680 }}>
        <thead><tr><th align="left">Source</th><th align="left">Country</th><th align="left">Status</th><th align="right">Jobs</th><th align="left">Last run</th></tr></thead>
        <tbody>{rows.map((s) => (
          <tr key={s.id} style={ROW}>
            <td><b>{s.name || s.kind}</b><br /><span className="muted">{s.kind}</span></td>
            <td>{s.country ? cname(s.country) : "–"}</td>
            <td>{s.last_status === "ok" ? "Working" : s.last_status === "error" ? <span style={{ color: "var(--bad, #b42318)" }}>Failing{s.last_error ? <><br /><span className="muted">{s.last_error.slice(0, 140)}</span></> : null}</span> : "Not run yet"}</td>
            <td align="right">{s.jobs_found ?? "–"}</td>
            <td>{when(s.last_run_at)}</td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}
