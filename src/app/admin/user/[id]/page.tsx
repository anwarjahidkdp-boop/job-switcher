import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHead } from "@/components/PageHead";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { createAdminClient } from "@/lib/supabase/admin";
import { cname } from "@/lib/countries";
import { formatPrice } from "@/lib/billing/pricing";
import { nowMs } from "@/lib/today";
import { requireAdmin } from "../../payments/actions";
import { loadApps, loadUsers } from "../../data";
import { AppTable, day, planLabel, when } from "../../ui";

export const metadata = { title: "Admin: user" };
export const dynamic = "force-dynamic";

/** One user's details for the owner: plan, payments, every application and AI spend. */
export default async function AdminUserPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const admin = createAdminClient();
  const now = nowMs();
  const u = (await loadUsers(admin)).find((x) => x.id === id);
  if (!u) notFound();
  const [apps, pays] = await Promise.all([
    loadApps(admin, "all", id),
    admin.from("payments").select("id, created_at, method, amount_minor, currency, status, period_days, trx_id").eq("user_id", id).order("created_at", { ascending: false }),
  ]);
  const facts: [string, string][] = [
    ["Email", u.email || "–"], ["Joined", day(u.created_at)], ["Wants to work in", cname(u.target_country)], ["Lives in", cname(u.home_country)],
    ["Plan", planLabel(u, now)], ["Onboarding", u.onboarding_step === "done" ? "Done" : `Stopped at: ${u.onboarding_step}`],
    ["Applied", String(u.applied)], ["Interviews", String(u.interviews)], ["AI spend this month", `$${(u.ai_month_micro / 1e6).toFixed(2)}`],
  ];
  return (
    <>
      <SiteHeader inApp={false} signedIn />
      <main><div className="wrap">
        <PageHead kicker="Admin · user" title={<>{u.full_name || "No name yet"}</>} sub={u.email || ""} />
        <div className="row" style={{ marginTop: 10 }}><Link className="btn btn-ghost btn-sm" href="/admin">← Back to dashboard</Link><Link className="btn btn-ghost btn-sm" href="/admin/list?k=users">All users</Link></div>

        <div className="card panel" style={{ marginTop: 14 }}>
          {facts.map(([k, v]) => <div key={k} className="qitem"><span className="muted">{k}</span><b>{v}</b></div>)}
        </div>

        <h2 style={{ fontSize: 20, marginTop: 22 }}>Payments</h2>
        {pays.data?.length ? (
          <div style={{ overflowX: "auto" }}>
            <table className="small admin-t" style={{ width: "100%", borderCollapse: "collapse", marginTop: 8, minWidth: 560 }}>
              <thead><tr><th align="left">When</th><th align="left">Method</th><th align="right">Amount</th><th align="left">Days</th><th align="left">Status</th><th align="left">TrxID</th></tr></thead>
              <tbody>{pays.data.map((p) => (
                <tr key={p.id as string} style={{ borderTop: "1px solid var(--line)" }}>
                  <td>{when(p.created_at as string)}</td><td>{p.method as string}</td><td align="right">{formatPrice(p.amount_minor as number, p.currency as string)}</td>
                  <td>{(p.period_days as number | null) ?? "–"}</td><td>{p.status as string}</td><td>{(p.trx_id as string | null) || "–"}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : <p className="small muted">No payments yet.</p>}

        <h2 style={{ fontSize: 20, marginTop: 22 }}>Applications</h2>
        <AppTable rows={apps} showUser={false} />
      </div></main>
      <SiteFooter signedIn />
    </>
  );
}
