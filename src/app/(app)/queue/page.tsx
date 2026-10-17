import Link from "next/link";
import { requireAppState } from "@/lib/server/page";
import { loadJob } from "@/lib/server/state";
import { daysUntil, fmtDate } from "@/lib/dates";
import { STATUS_LABEL } from "@/lib/types";
import { DeadlineChip } from "@/components/ui";

export const metadata = { title: "Apply Queue" };

export default async function Queue() {
  const { st, db } = await requireAppState("/queue");
  const items = [];
  for (const a of Object.values(st.apps).filter((a) => ["ready", "reminder", "waiting"].includes(a.status))) {
    const job = st.scored.find((x) => x.job.id === a.job_id)?.job || (await loadJob(db, a.job_id));
    if (job) items.push({ a, job, date: a.status === "reminder" && a.reminder_date ? a.reminder_date : st.today });
  }
  items.sort((x, y) => x.date.localeCompare(y.date));
  const label = (d: string) => { const n = daysUntil(d, st.today) ?? 0; return n <= 0 ? "Today" : n === 1 ? "Tomorrow" : fmtDate(d); };
  const groups = new Map<string, typeof items>();
  for (const x of items) { const k = label(x.date); groups.set(k, [...(groups.get(k) || []), x]); }
  return (
    <>
      <h1 style={{ fontSize: 28 }}>Apply Queue</h1>
      <p className="muted" style={{ marginTop: 4 }}>Your job-switching task list: applications ready to send and reminders you set.</p>
      <div className="stack" style={{ marginTop: 20 }}>
        {groups.size ? [...groups.entries()].map(([k, xs]) => (
          <div key={k} className="card">
            <div className="group-h"><h3 style={{ fontSize: 16 }}>{k}</h3></div>
            {xs.map((x) => (
              <div key={x.a.id} className="opp" style={{ cursor: "default", gridTemplateColumns: "minmax(0,1fr) auto" }}>
                <div><h4>{x.job.company} · {x.job.title}</h4><div className="meta">{STATUS_LABEL[x.a.status]}{x.a.reminder_date && x.a.status === "reminder" ? ` · Reminder ${fmtDate(x.a.reminder_date)}` : ""}</div></div>
                <div className="row"><DeadlineChip deadline={x.job.deadline} today={st.today} /><Link className="btn btn-primary btn-sm" href={`/jobs/${x.job.id}`}>{x.a.pack ? "Apply" : "Open"}</Link></div>
              </div>
            ))}
          </div>
        )) : <div className="card panel"><p className="muted">Nothing queued yet. Open an opportunity and choose Prepare Application or Apply Later.</p></div>}
      </div>
    </>
  );
}
