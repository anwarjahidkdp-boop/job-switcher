import { PageHead } from "@/components/PageHead";
import Link from "next/link";
import { requireAppState } from "@/lib/server/page";
import { stats } from "@/lib/server/state";
import { inboxList, skillDemand, type Scored } from "@/lib/matching";
import { completeness } from "@/lib/facts";
import { cname, money, perLabel, PORTALS } from "@/lib/countries";
import { daysUntil, fmtDate } from "@/lib/dates";
import { skillLabel } from "@/lib/taxonomy";
import { BAND } from "@/lib/matching";
import { STATUS_LABEL, type Band } from "@/lib/types";
import { Ring, DeadlineChip, BandPill } from "@/components/ui";
import { appliedAction } from "@/app/actions";
import { PastePanel } from "./PastePanel";
import { siteDone, sitesDone } from "@/lib/setup";

export const metadata = { title: "Opportunities" };

export default async function Inbox() {
  const { st } = await requireAppState("/inbox");
  const P = st.P, s = stats(st), country = st.country;
  const list = inboxList(st.scored, st.dismissed);
  const groups = (["ex", "st", "po"] as Band[]).map((b) => [b, list.filter((x) => x.m.band === b)] as const).filter((g) => g[1].length);
  const jobById = new Map(st.scored.map((x) => [x.job.id, x.job]));
  const due = Object.values(st.apps).filter((a) => a.status === "reminder" && a.reminder_date && (daysUntil(a.reminder_date, st.today) ?? 1) <= 0).map((a) => ({ a, job: jobById.get(a.job_id) })).filter((x) => x.job);
  const first = (P.name || "").replace(/^(md\.?|mohammad|muhammad)\s+/i, "").split(" ")[0];
  const queue = Object.values(st.apps).filter((a) => ["ready", "reminder", "waiting"].includes(a.status)).map((a) => ({ a, job: jobById.get(a.job_id), date: a.status === "reminder" && a.reminder_date ? a.reminder_date : st.today })).filter((x) => x.job).sort((x, y) => x.date.localeCompare(y.date)).slice(0, 4);
  const upcoming = list.filter((x) => (daysUntil(x.job.deadline, st.today) ?? -1) >= 0).sort((a, b) => (a.job.deadline || "").localeCompare(b.job.deadline || "")).slice(0, 3);
  const answered = Object.values(st.cvDoc?.answers || {}).filter(Boolean).length;
  const comp = completeness(P, answered);
  const { rel, rows } = skillDemand(st.scored, P);
  const miss = rows.find((r) => r.h.v < 1);
  const setupSites = PORTALS[st.country];
  const setupDone = sitesDone(st.profile.setup_steps || {}, setupSites);
  const dayLabel = (d: string) => { const n = daysUntil(d, st.today) ?? 0; return n <= 0 ? "Today" : n === 1 ? "Tomorrow" : fmtDate(d); };

  return (
    <>
      <PageHead kicker="Your job assistant" title={<>Welcome back{first ? <>, <span>{first}</span></> : ""}</>} sub={`We analysed ${s.analysed} jobs in ${cname(country)} for you. ${s.strong} ${s.strong === 1 ? "is a strong match" : "are strong matches"} for your profile.`} />
      {due.map(({ a, job }) => (
        <div key={a.id} className="banner warn" style={{ marginBottom: 14 }}>
          <div><b>Your {job!.company} application is ready.</b> <span className="muted">{job!.deadline ? `Deadline: ${daysUntil(job!.deadline, st.today)} days remaining. ` : ""}Did you submit your application?</span></div>
          <div className="row">
            <form action={appliedAction.bind(null, job!.id)}><button className="btn btn-primary btn-sm">Yes, Applied</button></form>
            <Link className="btn btn-ghost btn-sm" href={`/jobs/${job!.id}?notyet=1`}>Not yet</Link>
          </div>
        </div>
      ))}
      <div className="dash">
        <div>
          <div className="card">
            <PastePanel />
            {groups.length ? groups.map(([b, items]) => (
              <div key={b}>
                <div className="group-h"><BandPill band={b} /><span className="small muted">{items.length}</span></div>
                {items.map((x) => <OppRow key={x.job.id} x={x} today={st.today} status={st.apps[x.job.id]?.status} />)}
              </div>
            )) : s.analysed
              ? <p className="muted" style={{ padding: 16 }}>No strong matches right now. We checked {s.analysed} jobs; try adding target roles or skills in your profile.</p>
              : <p className="muted" style={{ padding: 16 }}>No jobs in {cname(country)} yet. Paste a job you found, or set up automatic job alerts.</p>}
          </div>
        </div>
        <aside className="side">
          {setupDone < setupSites.length ? (
            <div className="card panel" style={{ borderColor: "var(--accent)" }}>
              <h3>Get jobs automatically</h3>
              <div className="row" style={{ gap: 10 }}><div className="bar" style={{ flex: 1 }}><i style={{ width: `${Math.round((100 * setupDone) / setupSites.length)}%` }} /></div><b className="num small">{setupDone}/{setupSites.length}</b></div>
              <p className="small muted" style={{ marginTop: 8 }}>Forward job-alert emails from {PORTALS[country].slice(0, 2).join(" and ")} so new jobs arrive here on their own.</p>
              <Link className="btn btn-primary btn-sm" style={{ marginTop: 10 }} href="/setup">{setupDone ? `Set up ${setupSites.find((p) => !siteDone(st.profile.setup_steps || {}, p))}` : "Start setup"}</Link>
            </div>
          ) : null}
          <div className="card panel"><h3>Apply Queue</h3>
            {queue.length ? queue.map((x) => <div key={x.a.id} className="qitem"><div><div style={{ fontWeight: 600, fontSize: 14 }}>{x.job!.company}</div><div className="small muted">{dayLabel(x.date)} · {STATUS_LABEL[x.a.status]}</div></div><Link className="btn btn-text" href={`/jobs/${x.job!.id}`}>Open</Link></div>)
              : <p className="small muted">Prepared applications and reminders appear here.</p>}
          </div>
          <div className="card panel"><h3>Upcoming deadlines</h3>
            {upcoming.length ? upcoming.map((x) => <div key={x.job.id} className="qitem"><div><div style={{ fontWeight: 600, fontSize: 14 }}>{x.job.title}</div><div className="small muted">{x.job.company}</div></div><DeadlineChip deadline={x.job.deadline} today={st.today} /></div>) : <p className="small muted">No upcoming deadlines.</p>}
          </div>
          <div className="card panel"><h3>Profile completeness</h3>
            <div className="row" style={{ gap: 10 }}><div className="bar" style={{ flex: 1 }}><i style={{ width: `${comp}%` }} /></div><b className="num small">{comp}%</b></div>
            <p className="small muted" style={{ marginTop: 8 }}>{comp < 100 ? "Add confirmed skills or answer the skipped questions to sharpen your matches." : "Your profile is complete."}</p>
          </div>
          <div className="card panel"><h3>Career insight</h3>
            {miss ? <><p className="small"><b>{skillLabel(miss.s)}</b> appeared in {miss.n} of {rel.length} relevant jobs analysed and is {miss.h.v > 0 ? "not confirmed" : "not listed"} in your profile.</p><Link className="btn btn-text" href="/insights">See impact</Link></> : <p className="small muted">Your profile covers the most requested skills.</p>}
          </div>
          <div className="card panel"><h3>Your JobPao trial so far</h3>
            <div className="stack small" style={{ gap: 4 }}>
              {([["Jobs analysed", s.analysed], ["Relevant opportunities", s.relevant], ["Strong matches", s.strong], ["Applications prepared", s.prepared], ["Applications submitted", s.applied], ["CV improvements made", (st.master.content.improvements || []).length]] as [string, number][]).map(([l, n]) => <div key={l} className="row" style={{ justifyContent: "space-between" }}><span>{l}</span><b className="num">{n}</b></div>)}
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}

function OppRow({ x, today, status }: { x: Scored; today: string; status?: keyof typeof STATUS_LABEL }) {
  const { job, m } = x;
  return (
    <Link className="opp" href={`/jobs/${job.id}`}>
      <Ring score={m.score} band={m.band} />
      <div style={{ minWidth: 0 }}>
        <h4>{job.title}</h4>
        <div className="meta">{job.company}{job.location ? ` · ${job.location}` : ""}{job.salaryMax ? ` · ${money(job.salaryMin, job.country)}–${money(job.salaryMax, job.country)}${perLabel(job.country)}` : ""}{job.ownerId ? ` · ${job.source}` : ""}{job.isSample ? " · Sample" : ""}</div>
        <div className="why">{m.matched.slice(0, 3).map((t) => "✓ " + t).join(" · ")}{m.gaps[0] ? <> · <span style={{ color: "var(--warn)" }}>⚠ {m.gaps[0].t.split(";")[0]}</span></> : null}</div>
      </div>
      <div className="dlc stack" style={{ gap: 6, alignItems: "flex-end" }}><DeadlineChip deadline={job.deadline} today={today} />{status ? <span className="pill p-neutral">{STATUS_LABEL[status]}</span> : null}<span className="hide">{BAND[m.band][0]}</span></div>
    </Link>
  );
}
