import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHead } from "@/components/PageHead";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { createAdminClient } from "@/lib/supabase/admin";
import { cname, isCountry } from "@/lib/countries";
import { nowMs } from "@/lib/today";
import { requireAdmin } from "../payments/actions";
import { APP_TITLES, USER_TITLES, loadApps, loadJobs, loadSources, loadUsers, userFilter } from "../data";
import { AppTable, JobTable, SourceTable, UserTable } from "../ui";

export const metadata = { title: "Admin details" };
export const dynamic = "force-dynamic";

/** The list behind one dashboard number: /admin/list?k=onboarded, ?k=target:GB, ?k=sent, ?k=jobs:US, ?k=sources_failing ... */
export default async function AdminList({ searchParams }: { searchParams: Promise<{ k?: string }> }) {
  await requireAdmin();
  const k = String((await searchParams).k || "users");
  const admin = createAdminClient();
  const now = nowMs();
  const [kind, code] = k.split(":");
  if (code && !isCountry(code)) notFound();

  let title: string, body: React.ReactNode, count: number | string;
  const filter = userFilter(k, now);
  if (filter) {
    let rows = (await loadUsers(admin)).filter(filter);
    if (kind === "ai") rows = rows.sort((a, b) => b.ai_month_micro - a.ai_month_micro);
    title = kind === "target" ? `Users who want to work in ${cname(code)}` : kind === "home" ? `Users who live in ${cname(code)}` : USER_TITLES[kind];
    count = rows.length;
    body = <UserTable rows={rows} now={now} />;
  } else if (APP_TITLES[kind]) {
    const rows = await loadApps(admin, kind);
    title = APP_TITLES[kind]; count = rows.length;
    body = <AppTable rows={rows} />;
  } else if (kind === "jobs" || kind === "jobs_new") {
    const { rows, total } = await loadJobs(admin, k);
    title = kind === "jobs_new" ? "Jobs added in the last 24 hours" : code ? `Active jobs in ${cname(code)}` : "Active jobs";
    count = total > rows.length ? `${total} (newest ${rows.length} shown)` : total;
    body = <JobTable rows={rows} />;
  } else if (kind === "source_documents") {
    const { data: rows, error } = await admin.from("source_documents").select("id,title,url,kind,state,reason").neq("state", "processed").order("last_seen_at", { ascending: false }).limit(200);
    if (error) throw error;
    title = "Circulars awaiting extraction or verification"; count = rows?.length || 0;
    body = <div className="stack" style={{ marginTop: 16 }}>{(rows || []).map(d => <div className="card panel" key={d.id}><h3>{d.title}</h3><p className="small">{d.kind} · {d.state}</p><p>{d.reason}</p>{/^https?:\/\//i.test(d.url) ? <a href={d.url} target="_blank" rel="noopener noreferrer nofollow">View source circular ↗</a> : null}</div>)}</div>;
  } else if (kind === "sources" || kind === "sources_failing") {
    const rows = await loadSources(admin, kind === "sources_failing");
    title = kind === "sources_failing" ? "Job sources failing" : "Job sources";
    count = rows.length;
    body = <SourceTable rows={rows} />;
  } else notFound();

  return (
    <>
      <SiteHeader inApp={false} signedIn />
      <main><div className="wrap">
        <PageHead kicker="Admin" title={<>{title}</>} sub={`${count} in total. Times in Dhaka time.`} />
        <div className="row" style={{ marginTop: 10 }}><Link className="btn btn-ghost btn-sm" href="/admin">← Back to dashboard</Link></div>
        {body}
      </div></main>
      <SiteFooter signedIn />
    </>
  );
}
