import { applicationProgressCounts } from "@/lib/dashboard-progress";
import { OpportunityRow } from "@/components/OpportunityRow";
import { isResolvedApplication, submittedApplications } from "@/lib/applied-history";
import { currentCountryApps } from "@/lib/application-country";
import { applyQueue } from "@/lib/apply-queue";
import { missingApplicationFields } from "@/lib/application-profile";
import { backToStepAction, appliedAction } from "@/app/actions";
import Link from "next/link";
import { subscriptionOf, requireAppState } from "@/lib/server/page";
import { stats, loadJob } from "@/lib/server/state";
import { opportunitySections, skillDemand } from "@/lib/matching";
import { completeness } from "@/lib/facts";
import { cname, portals, rule } from "@/lib/countries";
import { daysUntil, fmtDate } from "@/lib/dates";
import { STATUS_LABEL, type Band } from "@/lib/types";
import { PastePanel } from "./PastePanel";
import { siteDone, sitesDone } from "@/lib/setup";
import { courseLinks, nowMs } from "@/lib/today";
import { skillLabel } from "@/lib/taxonomy";
import { TRIAL_APPLY } from "@/lib/pack-limits";
import { packAllowanceFor } from "@/lib/server/applications";
import { createAdminClient } from "@/lib/supabase/admin";
import { aiConfigured } from "@/lib/ai";
import { searchSummary, dayStart, type BandCounts } from "@/lib/server/search-summary";
import s from "./Home.module.css";

export const metadata = { title: "Opportunities" };

const DAY = 86_400_000;
const BAND_CLASS: Record<Band | "other", string> = { ex: s.ex, st: s.st, po: s.po, lo: s.lo, other: s.other };
const Svg = ({ d, className }: { d: string; className?: string }) => <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" dangerouslySetInnerHTML={{ __html: d }} />;
const ICON = {
  applied: '<path d="M20 6 9 17l-5-5"/>',
  interview: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/>',
  offer: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
  warn: '<path d="m12 3 10 18H2Z"/><path d="M12 9v5M12 17h.01"/>',
  star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
  grow: '<path d="m3 17 6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  arrow: '<path d="M7 17 17 7M8 7h9v9"/>',
};

export default async function Inbox() {
  const { st, db } = await requireAppState("/inbox");
  const available = st.scored.filter((x) => !isResolvedApplication(st.apps[x.job.id]));
  // Counts on this page come from the current search country only; earlier-country history stays on the Applied page.
  const here = currentCountryApps(st.apps, st.country);
  const missing = missingApplicationFields({ ...st.profile.answer_library, birthDate: st.profile.answer_library?.birthDate || st.profile.personal?.dob }, st.profile.deal_breakers || {}, st.country);
  const P = st.P, sx = stats({ ...st, apps: here }), country = st.country;
  const { ranked: list, featured } = opportunitySections(available, st.dismissed, st.apps);
  const jobById = new Map(st.scored.map((x) => [x.job.id, x.job]));
  const apps = Object.values(here);
  const due = apps.filter((a) => a.status === "reminder" && a.reminder_date && (daysUntil(a.reminder_date, st.today) ?? 1) <= 0).map((a) => ({ a, job: jobById.get(a.job_id) })).filter((x) => x.job);
  const queue = applyQueue(st);
  const answered = Object.values(st.cvDoc?.answers || {}).filter(Boolean).length;
  const comp = completeness(P, answered);
  const setupSites = portals(country);
  const setupDone = sitesDone(st.profile.setup_steps || {}, setupSites);
  const now = nowMs();
  const { data: sub } = await subscriptionOf(db, st.userId);
  const pro = sub?.plan_code === "pro" && sub.status === "active" && (!sub.current_period_end || Date.parse(sub.current_period_end) > now);
  const since = dayStart(rule(country).timeZone, new Date(now));
  const allowance = pro && aiConfigured() ? await packAllowanceFor(createAdminClient(), st.userId) : null;
  const { today, all } = searchSummary(st.scored, since, sx.analysed);
  const progress = applicationProgressCounts(here);
  const latestApp = submittedApplications(here).sort((a, b) => (b.applied_at || b.updated_at).localeCompare(a.applied_at || a.updated_at))[0];
  const latestJob = latestApp ? (jobById.get(latestApp.job_id) || await loadJob(db, latestApp.job_id)) : undefined;
  const fmt = (n: number) => n.toLocaleString("en-GB");
  const first = (P.name || "").replace(/^(md\.?|mohammad|muhammad)\s+/i, "").split(" ")[0];

  // Plan line in the hero: what the person paid for, or how much trial is left.
  const daysLeft = (iso: string | null | undefined) => (iso ? Math.max(0, Math.ceil((Date.parse(iso) - now) / DAY)) : null);
  const planLine = pro ? { label: "Pro", left: daysLeft(sub?.current_period_end) } : sub?.status === "trialing" && sub.trial_ends_at && Date.parse(sub.trial_ends_at) > now ? { label: "Free trial", left: daysLeft(sub.trial_ends_at) } : null;

  // Applications left: Pro counts AI-tailored packs (rolling day/week/month); the trial counts sent applications.
  // Trial limits stay account-wide (the server counts every sent application), so they read all applications.
  const sentAll = Object.values(st.apps).map((a) => (a.applied_at ? Date.parse(a.applied_at) : NaN)).filter((t) => Number.isFinite(t));
  const sent = apps.map((a) => (a.applied_at ? Date.parse(a.applied_at) : NaN)).filter((t) => Number.isFinite(t));
  const limits: [string, number, number][] = allowance
    ? [["Today", allowance.limits.day - allowance.used.day, allowance.limits.day], ["This week", allowance.limits.week - allowance.used.week, allowance.limits.week], ["This month", allowance.limits.month - allowance.used.month, allowance.limits.month]]
    : pro ? [] : [["Today", Math.min(TRIAL_APPLY.day - sentAll.filter((t) => now - t < DAY).length, TRIAL_APPLY.total - sentAll.length), TRIAL_APPLY.day], ["In trial", TRIAL_APPLY.total - sentAll.length, TRIAL_APPLY.total]];

  // Jobs checked today and all time, split by fit band so the parts add up to the total.
  const relevant = available.filter((x) => x.m.relevant && !x.m.expired);
  const appliedToday = sent.filter((t) => t >= since.getTime()).length;
  const pct = (n: number, of: number) => (of ? Math.round((100 * n) / of) : 0);
  // Four cards per summary: the three fits, then everything under 70% together. "Matched" = Good Fit or better.
  const four = (c: BandCounts) => ({ ex: c.ex, st: c.st, po: c.po, rest: c.lo + c.other });
  const CARDS = [["ex", "Strong Fit", "90–100%"], ["st", "Best Fit", "80–89%"], ["po", "Good Fit", "70–79%"], ["rest", "Stretch & others", "Below 70%"]] as const;
  const panel = (id: string, title: string, sub: string, c: BandCounts | null, applied: number, tone: string, chip: string, isToday: boolean) => {
    const f = c ? four(c) : null;
    // Every number opens the jobs behind it.
    const jobsHref = (fit: string) => `/opportunities?fit=${fit}${isToday ? "&when=today" : ""}`;
    return (
      <section className={`${s.summary} ${tone}`} aria-labelledby={id}>
        <div className={s.panelHead}>
          <h2 id={id} className={s.panelTitle}><span className={s.titleRow}>{title}<span className={s.chip}>{chip}</span></span><span>{sub}</span></h2>
          <div className={s.stats}>
            <Link prefetch={false} className={`${s.stat} ${s.sFound}`} href={jobsHref("found")}><b>{c ? fmt(c.total) : "–"}</b>Jobs found</Link>
            <Link prefetch={false} className={`${s.stat} ${s.sMatch}`} href={jobsHref("matched")}><b>{f ? fmt(f.ex + f.st + f.po) : "–"}</b>Best match<small>70% and above</small></Link>
            <Link prefetch={false} className={`${s.stat} ${s.sApplied}`} href={isToday ? "/applications?when=today" : "/applications"}><b>{fmt(applied)}</b>Applied</Link>
          </div>
        </div>
        <div className={s.fits}>
          {CARDS.map(([b, label, range]) => {
            const n = f ? f[b] : 0;
            const body = <>
              <span className={s.fitTop}><span className={s.fitLabel}>{label}</span><span className={s.range}>{range}</span></span>
              <span className={s.countRow}><b className={s.count}>{fmt(n)}</b><span className={s.pct}>{pct(n, c?.total || 0)}%</span></span>
            </>;
            const cls = `${s.fit} ${b === "rest" ? s.lo : BAND_CLASS[b]}`;
            return <Link prefetch={false} key={b} className={cls} href={jobsHref(b)}>{body}</Link>;
          })}
        </div>
      </section>
    );
  };
  // Home shows only the three highest-scoring open jobs; applied ones have already left the list.
  const top = [...list].sort((a, b) => b.m.score - a.m.score).slice(0, 3);

  // Career guide: skills your matches ask for that the profile lacks, and how many lower matches ask for them.
  const { rows } = skillDemand(relevant, P);
  const guide = rows.filter((r) => r.h.v < 1).slice(0, 3).map((r) => ({ s: r.s, n: r.n, lift: relevant.filter((x) => x.m.score < 90 && [...(x.job.required || []), ...(x.job.preferred || [])].includes(r.s)).length }));
  const maxN = guide[0]?.n || 1;

  // Deadlines and the next interview, nearest first.
  const nextInterview = apps.filter((a) => a.interview_at && Date.parse(a.interview_at) >= now - DAY / 2).sort((a, b) => a.interview_at!.localeCompare(b.interview_at!))[0];
  const when = (d: string | null) => { const n = d ? daysUntil(d, st.today) : null; return n == null ? { t: "Open", c: "" } : n <= 0 ? { t: "Today", c: s.today } : n === 1 ? { t: "Tmrw", c: s.tmrw } : { t: fmtDate(d), c: "" }; };
  const agenda = [
    ...queue.slice(0, 3).map((x) => ({ key: x.job.id, date: x.job.deadline, title: `Apply: ${x.job.title}`, sub: `${x.job.company} · ${st.apps[x.job.id]?.pack ? "ready to review" : "match"}${x.job.deadline ? ` · deadline ${fmtDate(x.job.deadline)}` : ""}`, href: `/jobs/${x.job.id}` })),
    ...(nextInterview ? [{ key: "iv", date: nextInterview.interview_at!.slice(0, 10), title: `Interview: ${jobById.get(nextInterview.job_id)?.company || "employer"}`, sub: nextInterview.interview_prep ? "Prep notes ready" : "Open to prepare", href: `/jobs/${nextInterview.job_id}` }] : []),
  ].sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999"));
  const repliesPending = apps.filter((a) => a.status === "applied" && a.applied_at && now - Date.parse(a.applied_at) >= 14 * DAY).length;
  // Bangladesh: most good jobs come through Bdjobs alerts, so connecting it is the first thing we ask for.
  const bdjobsNeeded = country === "BD" && setupSites.includes("Bdjobs") && !siteDone(st.profile.setup_steps || {}, "Bdjobs");
  const nextSite = setupSites.find((p) => !siteDone(st.profile.setup_steps || {}, p));

  return (
    <div className={s.home}>
      <section className={s.hero}>
        <div className={s.heroIn}>
          <div>
            <p className={s.kicker}>Your <b className={s.kJob}>Job</b> <b className={s.kAsst}>Assistant</b></p>
            <h1 className={s.title}>Welcome back{first ? <>, <span className={s.name}>{first}</span></> : ""}</h1>
          </div>
          <div className={s.cta}>
            {bdjobsNeeded ? <Link prefetch={false} className={s.bdBtn} href="/setup?site=Bdjobs"><Svg d={ICON.link} /><span><b>Connect Bdjobs</b><em>Get Bangladesh’s best jobs · 4 easy steps →</em></span></Link> : null}
            {missing.length ? <Link prefetch={false} className={s.warnBtn} href="/profile#application-safety"><Svg d={ICON.warn} /><span><b>{missing.length} {missing.length === 1 ? "detail" : "details"} incomplete</b><em>Complete now →</em></span></Link> : null}
          </div>
        </div>
      </section>

      {panel("today-h", "Today", `Jobs added today in ${cname(country)}`, today, appliedToday, s.pToday, new Date(`${st.today}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }), true)}

      <div className={s.duo}>
        <a className={`${s.duoCard} ${s.duoGuide}`} href="#career-guide">
          <span className={s.duoIc}><Svg d={ICON.grow} /></span>
          <span className={s.duoTx}><span className={s.duoK}>Career guide</span><span className={s.duoT}>{guide.length ? `${guide.length} ${guide.length === 1 ? "skill lifts" : "skills lift"} your matches` : "Skills for your roles"}</span></span>
          <span className={s.duoGo} aria-hidden="true">→</span>
        </a>
        <Link prefetch={false} className={`${s.duoCard} ${s.duoBest}`} href={featured ? `/jobs/${featured.job.id}` : "#matches"}>
          <span className={s.duoIc}><Svg d={ICON.star} /></span>
          <span className={s.duoTx}><span className={s.duoK}>Your best match · Ready to apply</span><span className={s.duoT}>{featured ? <>{featured.job.title} <small>· {featured.job.company}</small></> : "No match yet"}</span></span>
          {featured ? <b className={s.duoScore}>{featured.m.score}%</b> : null}
          <span className={s.duoGo}>{featured ? "Review & apply →" : "Paste a job →"}</span>
        </Link>
      </div>

      {panel("all-h", "All time", "Every job we have checked for you", all, progress.applied, s.pAll, "Since you joined", false)}

      <div className={s.progress}>
        <Link prefetch={false} className={`${s.pg} ${s.interview}`} href="/applications?status=interview"><span className={s.pgIc}><Svg d={ICON.interview} /></span><span className={s.pgTxt}><span className={s.pgL}>Interviewed</span><span className={s.pgS}>{nextInterview ? `Next: ${fmtDate(nextInterview.interview_at!.slice(0, 10))}` : "Prep notes ready when invited"}</span></span><b className={s.pgN}>{fmt(sx.interviews)}</b></Link>
        <Link prefetch={false} className={`${s.pg} ${s.offer}`} href="/applications?status=offer"><span className={s.pgIc}><Svg d={ICON.offer} /></span><span className={s.pgTxt}><span className={s.pgL}>Job offer received</span><span className={s.pgS}>{sx.offers ? "Congratulations!" : "We keep going for you"}</span></span><b className={s.pgN}>{fmt(sx.offers)}</b></Link>
      </div>

      <div className={s.grid}>
        <div className={s.col}>
          {due.map(({ a, job }) => (
            <div key={a.id} className="banner warn">
              <div><b>Did you apply to {job!.company}?</b> <span className="muted">{job!.deadline ? `Deadline: ${daysUntil(job!.deadline, st.today)} days remaining.` : "Your application is ready."}</span></div>
              <div className="row">
                <form action={appliedAction.bind(null, job!.id)}><button className="btn btn-primary btn-sm">Yes, applied</button></form>
                <Link prefetch={false} className="btn btn-ghost btn-sm" href={`/jobs/${job!.id}?notyet=1`}>Not yet</Link>
              </div>
            </div>
          ))}

          <div className={s.card} id="matches">
            <PastePanel sites={setupSites} />
            {top.length ? top.map((x) => <OpportunityRow key={x.job.id} x={x} today={st.today} status={st.apps[x.job.id]?.status} ai={st.aiCheck.get(x.job.id)} hideFit />) : apps.some(isResolvedApplication) && !list.length
              ? <p className={s.empty}>You’re up to date. Your submitted applications are in <Link href="/applications">Applied</Link>. New opportunities will appear here.</p>
              : sx.analysed
                ? <p className={s.empty}>No Good Fit or better right now. We checked {fmt(sx.analysed)} jobs; try adding target roles or skills in your profile.</p>
                : <p className={s.empty}>No jobs in {cname(country)} yet. Paste a job you found, or set up automatic job alerts.</p>}
            {list.length ? <div className={s.foot}><Link prefetch={false} className={s.link} href="/opportunities">View all {fmt(list.length)} opportunities →</Link></div> : null}
          </div>

          <section className={s.card} id="career-guide" aria-labelledby="guide-h">
            <div className={s.head} style={{ ["--hc" as string]: "var(--stretch)" }}><h2 id="guide-h">Grow your matches</h2><Link prefetch={false} className={s.link} href="/insights#career-guidance">Career guide ↗</Link></div>
            {guide.length ? guide.map((g) => (
              <div key={g.s} className={s.skill}>
                <div><b>{skillLabel(g.s)}</b><div className={s.muted}>Asked in {g.n} of your {relevant.length} matches</div></div>
                <span className={s.demand}><i style={{ width: `${Math.max(8, Math.round((100 * g.n) / maxN))}%` }} /></span>
                <div style={{ textAlign: "right" }}>
                  {g.lift ? <span className={s.gain}>Can lift up to {g.lift} {g.lift === 1 ? "match" : "matches"}</span> : null}
                  <div className={s.courses}>{courseLinks(skillLabel(g.s)).slice(0, 2).map((l) => <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer nofollow">{l.label} ↗</a>)}</div>
                </div>
              </div>
            )) : <p className={s.empty}>Your profile already covers the skills your matches ask for most.</p>}
            {guide.length ? <div className={s.foot}>Learned one? Add it in your <Link prefetch={false} href="/profile">profile</Link> and your scores update.</div> : null}
          </section>
        </div>

        <aside className={s.col}>
          <section className={s.card}>
            <div className={s.head}><h3>{planLine ? <>{planLine.label}{planLine.left != null ? ` · ${planLine.left} ${planLine.left === 1 ? "day" : "days"} left` : ""}</> : "Trial ended"}</h3><Link prefetch={false} className={s.link} href="/upgrade">{pro ? "Plan" : "Go Pro"}</Link></div>
            {limits.length ? <div className={s.limits}>
              <p className={s.limTitle}>{pro ? "AI applications left" : "Applications left"}</p>
              {limits.map(([label, left, max]) => { const l = Math.max(0, left); return <div key={label} className={s.lim}><span>{label}</span><span className={s.bar}><i style={{ width: `${Math.round((100 * l) / Math.max(1, max))}%` }} /></span><b>{l} of {max}</b></div>; })}
              {!pro ? <Link prefetch={false} className={s.limNote} href="/upgrade">Pro: 2 a day, 10 a week, 40 a month →</Link> : null}
            </div> : null}
          </section>
          <section className={s.card} id="agenda">
            <div className={s.head} style={{ ["--hc" as string]: "var(--coral)" }}><h3>Deadlines &amp; queue</h3><Link prefetch={false} className={s.link} href="/queue">Open queue</Link></div>
            {agenda.length ? agenda.map((x) => { const w = when(x.date); return <Link prefetch={false} key={x.key} className={s.qi} href={x.href}><span className={`${s.when} ${w.c}`}>{w.t}</span><span><b>{x.title}</b><span className={s.muted}>{x.sub}</span></span></Link>; })
              : <p className={s.empty}>Prepared applications, deadlines and interviews appear here.</p>}
          </section>

          {latestApp && latestJob ? (
            <section className={s.card}>
              <div className={s.head} style={{ ["--hc" as string]: "var(--teal)" }}><h3>Latest application</h3><Link prefetch={false} className={s.link} href="/applications">Applied</Link></div>
              <Link prefetch={false} className={s.latest} style={{ display: "block", textDecoration: "none" }} href={`/jobs/${latestJob.id}`}><b>{latestJob.title}</b>, {latestJob.company} · {["applied", "interview", "offer", "closed", "withdrawn"].includes(latestApp.status) ? STATUS_LABEL[latestApp.status] : "Applied"}{repliesPending ? `. ${repliesPending} ${repliesPending === 1 ? "employer has" : "employers have"} not replied after 14 days; we’ll remind you to follow up.` : "."}</Link>
            </section>
          ) : null}

          {setupDone < setupSites.length ? (
            <section className={s.card}>
              <div className={s.head}><h3>Get jobs automatically</h3><b className="num">{setupDone}/{setupSites.length}</b></div>
              <div className={s.setup}>
                <span className={s.bar}><i style={{ width: `${Math.round((100 * setupDone) / setupSites.length)}%` }} /></span>
                <p className={s.muted}>Forward job-alert emails from {setupSites.slice(0, 2).join(" and ")} so new jobs arrive here on their own.</p>
                <Link prefetch={false} className="btn btn-primary btn-sm" href="/setup">{setupDone && nextSite ? `Set up ${nextSite}` : "Start setup"}</Link>
              </div>
            </section>
          ) : null}

          <section className={s.card}>
            <div className={s.head} style={{ ["--hc" as string]: "var(--best)" }}><h3>Profile strength</h3><b className="num">{comp}%</b></div>
            <div className={s.prof}>
              <span className={s.bar}><i style={{ width: `${comp}%` }} /></span>
              <p className={s.muted}>{comp < 100 ? "Add confirmed skills or answer the skipped questions to sharpen your matches." : "Your profile is complete."}</p>
              <div className="row"><Link prefetch={false} className="btn btn-text btn-sm" href="/profile">Edit profile</Link><form action={backToStepAction.bind(null, "upload")}><button className="btn btn-text btn-sm">Upload a new CV</button></form></div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
