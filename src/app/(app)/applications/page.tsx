import { PageHead } from "@/components/PageHead";
import Link from "next/link";
import { requireAppState } from "@/lib/server/page";
import { loadJob, stats } from "@/lib/server/state";
import { addDaysTo, fmtDate } from "@/lib/dates";
import { STATUS_LABEL } from "@/lib/types";
import { StatusSelect } from "./StatusSelect";
import { rule } from "@/lib/countries";

export const metadata = { title: "Applications" };

export default async function Applications() {
  const { st, db } = await requireAppState("/applications");
  const s = stats(st);
  const rows = [];
  for (const a of Object.values(st.apps).sort((x, y) => y.updated_at.localeCompare(x.updated_at))) {
    const job = st.scored.find((x) => x.job.id === a.job_id)?.job || (await loadJob(db, a.job_id));
    if (job) rows.push({ a, job });
  }
  const tz = rule(st.country).timeZone;
  const ivWhen = (iso: string) => new Date(iso).toLocaleString("en-GB", { timeZone: tz, weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true });
  const from = addDaysTo(st.today, -1);
  const upcoming = rows.filter((r) => r.a.interview_at && r.a.interview_at.slice(0, 10) >= from && ["interview", "offer"].includes(r.a.status)).sort((x, y) => x.a.interview_at!.localeCompare(y.a.interview_at!));
  const pending = s.reminders + rows.filter((r) => ["ready", "waiting"].includes(r.a.status)).length;
  return (
    <>
      <PageHead kicker="Your progress" title={<>Your <span>applications</span></>} sub="Every job you prepared, applied to or interviewed for, in one place." />
      <div className="tiles" style={{ marginTop: 18 }}>
        {([["Jobs analysed", s.analysed], ["Strong matches", s.strong], ["Prepared", s.prepared], ["Submitted", s.applied], ["Pending", pending], ["Interviews", s.interviews], ["Offers", s.offers]] as [string, number][]).map(([l, n]) => <div key={l} className="card tile"><b>{n}</b><span className="small muted">{l}</span></div>)}
      </div>
      {upcoming.length ? (
        <div className="card panel" style={{ marginTop: 18 }}>
          <h2 style={{ fontSize: 18 }}>Upcoming interviews</h2>
          <div className="ivup">
            {upcoming.map(({ a, job }) => (
              <Link key={a.id} href={`/jobs/${job.id}#interview`}>
                <span><b>{job.title}</b> · {job.company}<br /><span className="small muted">{ivWhen(a.interview_at!)}</span></span>
                <span className="small" style={{ alignSelf: "center" }}>{a.interview_prep ? "Review prep" : "Prepare"} →</span>
              </Link>
            ))}
          </div>
        </div>
      ) : null}
      <div className="card" style={{ marginTop: 18 }}>
        {rows.length ? rows.map(({ a, job }) => (
          <div key={a.id} className="opp" style={{ cursor: "default", gridTemplateColumns: "minmax(0,1fr) auto" }}>
            <div><h4>{job.title} · {job.company}</h4>
              {a.interview_at ? <p className="small" style={{ margin: "2px 0 4px" }}>Interview: <b>{ivWhen(a.interview_at)}</b></p> : null}
              <ul className="timeline">{(a.application_events || []).slice(-4).map((e, i) => <li key={i}>{fmtDate(e.created_at.slice(0, 10))} · {e.event}</li>)}</ul></div>
            <div className="stack" style={{ gap: 6, alignItems: "flex-end" }}>
              <span className={`pill ${["applied", "interview", "offer"].includes(a.status) ? "p-st" : "p-neutral"}`}>{STATUS_LABEL[a.status]}</span>
              {["applied", "interview", "offer"].includes(a.status) ? <><StatusSelect jobId={job.id} /><Link className="btn btn-text small" href={`/jobs/${job.id}#interview`}>{a.interview_at ? "Interview prep" : "Add interview call"}</Link></> : <Link className="btn btn-text" href={`/jobs/${job.id}`}>Open</Link>}
            </div>
          </div>
        )) : <p className="muted" style={{ padding: 16 }}>No applications yet.</p>}
      </div>
      <p className="small muted" style={{ marginTop: 10 }}>An application is marked Applied only after you confirm it. &quot;Viewed&quot; is never shown unless an employer system reports it.</p>
    </>
  );
}
