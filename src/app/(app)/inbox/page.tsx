import { backToStepAction } from "@/app/actions";
import { PageHead } from "@/components/PageHead";
import Link from "next/link";
import { requireAppState } from "@/lib/server/page";
import { stats } from "@/lib/server/state";
import { inboxList, skillDemand, type Scored } from "@/lib/matching";
import { completeness } from "@/lib/facts";
import { cname, money, perLabel, portals } from "@/lib/countries";
import { daysUntil, fmtDate } from "@/lib/dates";
import { skillLabel } from "@/lib/taxonomy";
import { BAND } from "@/lib/matching";
import { STATUS_LABEL, type Band } from "@/lib/types";
import { Ring, DeadlineChip, BandPill } from "@/components/ui";
import { appliedAction } from "@/app/actions";
import { PastePanel } from "./PastePanel";
import { siteDone, sitesDone } from "@/lib/setup";
import { courseLinks, nowMs, trialPlan } from "@/lib/today";
import { skillImpact } from "@/lib/matching";
import { listNotifications } from "@/lib/server/notify";
import { REPLY_CHECK_DAYS } from "@/lib/server/nudges";
import { TodayCard, type DoneItem } from "./TodayCard";
import { KpiStrip, type Kpi } from "./KpiStrip";

export const metadata = { title: "Opportunities" };

export default async function Inbox() {
  const { st, db } = await requireAppState("/inbox");
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
  const setupSites = portals(st.country);
  const setupDone = sitesDone(st.profile.setup_steps || {}, setupSites);
  const [{ data: sub }, notes] = await Promise.all([
    db.from("subscriptions").select("status, trial_started_at, trial_ends_at").eq("user_id", st.userId).maybeSingle(),
    listNotifications(db, st.userId, 10),
  ]);
  const now = nowMs();
  const apps = Object.values(st.apps);
  const repliesPending = apps.filter((a) => a.status === "applied" && a.applied_at && now - Date.parse(a.applied_at) >= REPLY_CHECK_DAYS * 86_400_000).length;
  const plan = trialPlan({ status: sub?.status ?? null, trialStart: sub?.trial_started_at ?? null, trialEnd: sub?.trial_ends_at ?? null, now, hasMaster: !!st.master, strong: s.strong, prepared: s.prepared, applied: s.applied, interviews: s.interviews, setupDone: setupDone >= setupSites.length, repliesPending });
  // What JobPao has done so far, in plain lines (the trial's day-by-day plan was more than people needed).
  const improved = (st.master.content.improvements || []).length;
  const checked = [...st.aiCheck.values()].length;
  const plural = (n: number, one: string, many = one + "s") => `${n} ${n === 1 ? one : many}`;
  const fmt = (n: number) => n.toLocaleString("en-GB");
  const done: DoneItem[] = [
    { n: improved ? `+${improved}` : "✓", label: "CV rewritten", sub: `${cname(country)} format${improved ? `, ${plural(improved, "improvement")}` : ""}`, href: "/profile", icon: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>' },
    ...(s.analysed ? [{ n: fmt(s.analysed), label: "Jobs searched", sub: `in ${cname(country)}`, href: "#matches", icon: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>' }] : []),
    ...(s.relevant ? [{ n: fmt(s.relevant), label: "Matched to you", sub: s.strong ? `${fmt(s.strong)} Good Fit or better` : "by role and skills", href: "#matches", icon: '<path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="9"/>' }] : []),
    ...(checked ? [{ n: fmt(checked), label: "Checked by AI", sub: "read against your CV", href: "#matches", icon: '<path d="M12 3l1.9 4.6L18.5 9l-4.6 1.9L12 15.5l-1.9-4.6L5.5 9l4.6-1.4z"/><path d="M19 15l.8 1.7 1.7.8-1.7.8L19 20l-.8-1.7-1.7-.8 1.7-.8z"/>' }] : []),
    ...(s.prepared ? [{ n: fmt(s.prepared), label: "Ready to send", sub: "CV + cover letter each", href: "/queue", icon: '<path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/>' }] : []),
    ...(s.applied ? [{ n: fmt(s.applied), label: "Sent by you", sub: "tracked for replies", href: "/applications", icon: '<path d="M20 6 9 17l-5-5"/>' }] : []),
  ];
  const summary: [string, number][] = [["Jobs analysed", s.analysed], ["Good Fit or better", s.strong], ["Applications prepared", s.prepared], ["Applied", s.applied], ["Interviews", s.interviews]];
  // Career guide: the missing skills that would lift the most matches to Strong.
  const opts = { today: st.today, needVisa: st.profile.needs_visa, homeCountry: st.homeCountry };
  const guide = rows.filter((r) => r.h.v < 1).slice(0, 6).map((r) => { const imp = skillImpact(st.scored, P, r.s, opts); return { s: r.s, n: r.n, gain: imp.after - imp.before }; })
    .sort((a, b) => b.gain - a.gain || b.n - a.n).slice(0, 3);
  const kpis: Kpi[] = [
    { label: "Jobs analysed", n: s.analysed, href: "#matches", tone: "navy", icon: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>', hint: `in ${cname(country)}` },
    { label: "Good Fit or better", n: s.strong, href: "#matches", tone: "gold", icon: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>', hint: "Fit score 70+" },
    { label: "Ready to apply", n: s.prepared, href: "/queue", tone: "blue", icon: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M9 14l2 2 4-4"/>', hint: "CV + cover letter" },
    { label: "Applied", n: s.applied, href: "/applications", tone: "teal", icon: '<path d="m22 2-7 20-4-9-9-4z"/>' },
    { label: "Interviews", n: s.interviews + s.offers, href: "/applications", tone: "green", icon: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>' },
  ];
  const best = list.find((x) => !st.apps[x.job.id]) || list[0];
  const dayLabel = (d: string) => { const n = daysUntil(d, st.today) ?? 0; return n <= 0 ? "Today" : n === 1 ? "Tomorrow" : fmtDate(d); };

  return (
    <>
      <PageHead kicker="Your job assistant" title={<>Welcome back{first ? <>, <span>{first}</span></> : ""}</>} sub={`We analysed ${s.analysed} jobs in ${cname(country)} for you. ${s.strong} ${s.strong === 1 ? "is Good Fit or better" : "are Good Fit or better"} for your profile.`} />
      {due.map(({ a, job }) => (
        <div key={a.id} className="banner warn" style={{ marginBottom: 14 }}>
          <div><b>Your {job!.company} application is ready.</b> <span className="muted">{job!.deadline ? `Deadline: ${daysUntil(job!.deadline, st.today)} days remaining. ` : ""}Did you submit your application?</span></div>
          <div className="row">
            <form action={appliedAction.bind(null, job!.id)}><button className="btn btn-primary btn-sm">Yes, Applied</button></form>
            <Link className="btn btn-ghost btn-sm" href={`/jobs/${job!.id}?notyet=1`}>Not yet</Link>
          </div>
        </div>
      ))}
      <KpiStrip items={kpis} />
      {best ? (
        <Link className="spot" href={`/jobs/${best.job.id}`}>
          <div className="spot-ring"><Ring score={best.m.score} band={best.m.band} /></div>
          <div className="spot-txt">
            <span className="spot-k">Your best match right now</span>
            <b>{best.job.title}</b>
            <span className="spot-m">{best.job.company}{best.job.location ? ` · ${best.job.location}` : ""}</span>
            {best.m.matched.length ? <span className="spot-why">{best.m.matched.slice(0, 3).map((t) => "✓ " + t).join("  ")}</span> : null}
          </div>
          <span className="spot-go">{st.apps[best.job.id]?.pack ? "Review application" : "See why it fits"} →</span>
        </Link>
      ) : null}
      <TodayCard plan={plan} done={done} items={notes.filter((n) => !n.read_at).slice(0, 3)} summary={summary} />
      <div className="dash" id="matches">
        <div>
          <div className="card">
            <PastePanel sites={portals(st.country)} />
            {groups.length ? groups.map(([b, items]) => (
              <div key={b}>
                <div className="group-h"><BandPill band={b} /><span className="small muted">{items.length}</span></div>
                {items.map((x) => <OppRow key={x.job.id} x={x} today={st.today} status={st.apps[x.job.id]?.status} ai={st.aiCheck.get(x.job.id)} />)}
              </div>
            )) : s.analysed
              ? <p className="muted" style={{ padding: 16 }}>No Good Fit or better right now. We checked {s.analysed} jobs; try adding target roles or skills in your profile.</p>
              : <p className="muted" style={{ padding: 16 }}>No jobs in {cname(country)} yet. Paste a job you found, or set up automatic job alerts.</p>}
          </div>
        </div>
        <aside className="side">
          {setupDone < setupSites.length ? (
            <div className="card panel" style={{ borderColor: "var(--accent)" }}>
              <h3>Get jobs automatically</h3>
              <div className="row" style={{ gap: 10 }}><div className="bar" style={{ flex: 1 }}><i style={{ width: `${Math.round((100 * setupDone) / setupSites.length)}%` }} /></div><b className="num small">{setupDone}/{setupSites.length}</b></div>
              <p className="small muted" style={{ marginTop: 8 }}>Forward job-alert emails from {portals(country).slice(0, 2).join(" and ")} so new jobs arrive here on their own.</p>
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
            <div className="row" style={{ marginTop: 8 }}><a className="btn btn-text btn-sm" href="/profile">Edit profile</a><form action={backToStepAction.bind(null, "upload")}><button className="btn btn-text btn-sm">Upload a new CV</button></form></div>
          </div>
          <div className="card panel"><h3>Career guide</h3>
            {guide.length ? <>
              <p className="small muted">Skills employers in {cname(country)} ask for that your profile does not show yet:</p>
              {guide.map((g) => (
                <div key={g.s} className="qitem" style={{ display: "block" }}>
                  <div className="small"><b>{skillLabel(g.s)}</b> · in {g.n} of {rel.length} relevant jobs{g.gain > 0 ? <> · <span style={{ color: "var(--ok, #2E9E6B)" }}>+{g.gain} strong {g.gain === 1 ? "match" : "matches"}</span></> : null}</div>
                  <div className="guide-links">{courseLinks(skillLabel(g.s)).map((l) => <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer nofollow">{l.label} ↗</a>)}</div>
                </div>
              ))}
              <p className="small muted" style={{ marginTop: 8 }}>Learned one? Add it in your profile and your scores update.</p>
              <Link className="btn btn-text" href="/insights">See all skills</Link>
            </> : <p className="small muted">Your profile covers the most requested skills.</p>}
          </div>
          <div className="card panel"><h3>Your JobPao trial so far</h3>
            <div className="stack small" style={{ gap: 4 }}>
              {([["Jobs analysed", s.analysed], ["Relevant opportunities", s.relevant], ["Good Fit or better", s.strong], ["Applications prepared", s.prepared], ["Applications submitted", s.applied], ["CV improvements made", (st.master.content.improvements || []).length]] as [string, number][]).map(([l, n]) => <div key={l} className="row" style={{ justifyContent: "space-between" }}><span>{l}</span><b className="num">{n}</b></div>)}
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}

function OppRow({ x, today, status, ai }: { x: Scored; today: string; status?: keyof typeof STATUS_LABEL; ai?: { fit: string; reason: string } }) {
  const { job, m } = x;
  return (
    <Link className="opp" href={`/jobs/${job.id}`}>
      <Ring score={m.score} band={m.band} />
      <div style={{ minWidth: 0 }}>
        <h4>{job.title}</h4>
        <div className="meta">{job.company}{job.location ? ` · ${job.location}` : ""}{job.salaryMax ? ` · ${money(job.salaryMin, job.country)}–${money(job.salaryMax, job.country)}${perLabel(job.country)}` : ""}{job.ownerId ? ` · ${job.source}` : ""}{job.isSample ? " · Sample" : ""}</div>
        <div className="why">{m.matched.slice(0, 3).map((t) => "✓ " + t).join(" · ")}{m.gaps[0] ? <> · <span style={{ color: "var(--warn)" }}>⚠ {m.gaps[0].t.split(";")[0]}</span></> : null}</div>
        <span className={`chip-chance ${m.score >= 90 ? "high" : m.score < 70 ? "low" : ""}`}>{BAND[m.band][0]}</span>
        {ai?.reason ? <div className={`ai-check ${ai.fit === "strong" ? "ok" : "warn"}`}><b>AI fit check:</b> {ai.reason}</div> : null}
      </div>
      <div className="dlc stack" style={{ gap: 6, alignItems: "flex-end" }}><DeadlineChip deadline={job.deadline} today={today} />{status ? <span className="pill p-neutral">{STATUS_LABEL[status]}</span> : null}<span className="hide">{BAND[m.band][0]}</span></div>
    </Link>
  );
}
