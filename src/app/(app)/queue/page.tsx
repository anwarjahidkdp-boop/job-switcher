import { PageHead } from "@/components/PageHead";
import Link from "next/link";
import { isPro, requireAppState } from "@/lib/server/page";
import { TRIAL_APPLY, trialApplyRoom, unlockedReady } from "@/lib/pack-limits";
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
  // Free trial: one application a day can be opened and sent; the others stay ready behind Pro.
  const pro = await isPro(db, st.userId);
  const apps = Object.values(st.apps);
  const open = pro ? null : unlockedReady(apps, trialApplyRoom(apps));
  const locked = (jobId: string, hasPack: boolean) => !!open && hasPack && !open.has(jobId);
  const nLocked = items.filter((x) => locked(x.job.id, !!x.a.pack)).length;
  const label = (d: string) => { const n = daysUntil(d, st.today) ?? 0; return n <= 0 ? "Today" : n === 1 ? "Tomorrow" : fmtDate(d); };
  const groups = new Map<string, typeof items>();
  for (const x of items) { const k = label(x.date); groups.set(k, [...(groups.get(k) || []), x]); }
  return (
    <>
      <PageHead kicker="To do" title={<>Apply <span>queue</span></>} sub="Your task list: applications ready to send and reminders you set." />
      <div className="stack" style={{ marginTop: 20 }}>
        {nLocked ? <div className="card panel upsell upsell-row">
          <div><p className="eyebrow">Free trial · {TRIAL_APPLY.day} application a day</p><h3 style={{ margin: "4px 0 4px" }}>{nLocked} more {nLocked === 1 ? "application is" : "applications are"} ready for you</h3>
            <p className="small">Each one is prepared to what its job post asks for: a tailored CV, a cover letter and a list of anything else to attach. Go Pro to send them all today and get new ones every day.</p></div>
          <Link className="btn btn-gold" href="/upgrade?from=queue">Go Pro and apply to all</Link>
        </div> : null}
        {groups.size ? [...groups.entries()].map(([k, xs]) => (
          <div key={k} className="card">
            <div className="group-h"><h3 style={{ fontSize: 16 }}>{k}</h3></div>
            {xs.map((x) => locked(x.job.id, !!x.a.pack) ? (
              <div key={x.a.id} className="opp opp-locked" style={{ cursor: "default", gridTemplateColumns: "minmax(0,1fr) auto" }}>
                <div><h4>{x.job.company} · {x.job.title}</h4><div className="meta">🔒 Ready and waiting · tailored CV and cover letter prepared</div></div>
                <div className="row"><DeadlineChip deadline={x.job.deadline} today={st.today} /><Link className="btn btn-gold btn-sm" href="/upgrade?from=queue">Go Pro to apply</Link></div>
              </div>
            ) : (
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
