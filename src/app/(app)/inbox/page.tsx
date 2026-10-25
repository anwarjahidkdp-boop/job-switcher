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
import { listNotifications } from "@/lib/server/notify";
import { siteDone, sitesDone } from "@/lib/setup";
import { LINKEDIN_DONE, LINKEDIN_URL } from "@/lib/setup";
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
  case: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18"/>',
  applied: '<path d="M20 6 9 17l-5-5"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  warn: '<path d="m12 3 10 18H2Z"/><path d="M12 9v5M12 17h.01"/>',
  star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
  grow: '<path d="m3 17 6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  send: '<path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4z"/>',
  people: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6"/>',
  trophy: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  check: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
  arrow: '<path d="M7 17 17 7M8 7h9v9"/>',
  linkedin: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 10v7M8 7v.01M12 17v-4a2 2 0 0 1 4 0v4M12 10v7"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
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
  const FIT_ICON = { ex: ICON.star, st: ICON.target, po: ICON.check, rest: ICON.grow };
  const panel = (id: string, title: string, sub: string, c: BandCounts | null, applied: number, tone: string, chip: string, isToday: boolean) => {
    const outcomes = !isToday;
    const f = c ? four(c) : null;
    // Every number opens the jobs behind it.
    const jobsHref = (fit: string) => `/opportunities?fit=${fit}${isToday ? "&when=today" : ""}`;
    return (
      <section className={`${s.summary} ${tone}`} aria-labelledby={id}>
        <div className={s.panelHead}>
          <h2 id={id} className={s.panelTitle}><span className={s.titleRow}>{title}<span className={s.chip}>{chip}</span></span><span>{sub}</span></h2>
          <div className={`${s.stats} ${outcomes ? s.stats4 : ""}`}>
            {(outcomes
              ? [[jobsHref("found"), ICON.search, c ? fmt(c.total) : "–", "Jobs found", null],
                 ["/applications", ICON.send, fmt(applied), "Applied", null],
                 ["/applications?status=interview", ICON.people, fmt(sx.interviews), "Interviewed", null],
                 ["/applications?status=offer", ICON.trophy, fmt(sx.offers), "Offer received", null]]
              : [[jobsHref("found"), ICON.search, c ? fmt(c.total) : "–", "Jobs found", null],
                 [jobsHref("matched"), ICON.target, f ? fmt(f.ex + f.st + f.po) : "–", "Top match", "70% and above"],
                 ["/applications?when=today", ICON.send, fmt(applied), "Applied", null]]
            ).map(([href, icon, n, label, note]) => (
              <Link prefetch={false} key={label} className={s.navy} href={href!}><span className={s.navyIc}><Svg d={icon!} /></span><b>{n}</b><span className={s.navyL}>{label}{note ? <small>{note}</small> : null}</span></Link>
            ))}
          </div>
        </div>
        <div className={s.fits}>
          {CARDS.map(([b, label, range]) => {
            const n = f ? f[b] : 0;
            const body = <>
              <Svg className={s.mini} d={FIT_ICON[b]} />
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
  // Career guide speaks to how many Strong Fits (90%+) the person has, and points them to the guide to grow that number.
  const strongN = all ? all.ex : 0;
  const guideLine = strongN ? `Only ${fmt(strongN)} Strong ${strongN === 1 ? "Fit" : "Fits"}` : "No Strong Fit yet";
  const gaps = guide.length;
  const guideCall = gaps
    ? `${strongN ? "Unlock more" : "Reach 90%+"} by closing ${gaps} skill ${gaps === 1 ? "gap" : "gaps"}`
    : strongN ? "Keep your profile sharp to unlock more" : "Strengthen your profile to reach 90%+";

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
  // Once Bdjobs is connected its button leaves the hero; the newest unread notification takes its place.
  const note = bdjobsNeeded ? null : (await listNotifications(db, st.userId, 1)).find((n) => !n.read_at) || null;
  const nextSite = setupSites.find((p) => !siteDone(st.profile.setup_steps || {}, p));
  // LinkedIn helper for every country: shown until the person says they updated their profile.
  const liSteps = st.profile.setup_steps || {};
  const liNeeded = typeof liSteps[LINKEDIN_DONE] !== "string";
  const liConnected = typeof liSteps[LINKEDIN_URL] === "string";

  return (
    <div className={s.home}>
      <section className={s.hero}>
        <div className={s.heroIn}>
          <div>
            <p className={s.kicker}><span className={s.kIc}><Svg d={ICON.case} /></span><span className={s.kYour}>Your</span> <b>Job Assistant</b></p>
            <h1 className={s.title}>Welcome back{first ? <>, <span className={s.name}>{first}</span></> : ""}</h1>
          </div>
          <div className={s.cta}>
            {bdjobsNeeded ? <Link prefetch={false} className={s.bdBtn} href="/setup?site=Bdjobs"><Svg d={ICON.link} />Connect Bdjobs<em>· 4 easy steps</em></Link>
              : note ? <Link prefetch={false} className={s.noteBtn} href={note.link || "/notifications"}><Svg d={ICON.bell} /><span className={s.noteTx}>{note.title}</span></Link> : null}
            {liNeeded ? <Link prefetch={false} className={s.liBtn} href="/linkedin"><Svg d={ICON.linkedin} />{liConnected ? "Update LinkedIn profile" : "Connect LinkedIn"}<em>· {liConnected ? "ready to copy" : "build your profile"}</em></Link> : null}
            {missing.length ? <Link prefetch={false} className={s.warnBtn} href="/profile#application-safety"><Svg d={ICON.warn} />{missing.length} {missing.length === 1 ? "detail" : "details"} incomplete<em>· Complete now</em></Link> : null}
          </div>
        </div>
      </section>

      {panel("today-h", "Today", `Jobs added today in ${cname(country)}`, today, appliedToday, s.pToday, new Date(`${st.today}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }), true)}

      <div className={s.duo}>
        <a className={`${s.duoFrame} ${s.fGuide}`} href="#career-guide"><span className={s.duoGap}><span className={`${s.duoCard} ${s.duoGuide}`}>
          <span className={s.duoIc}><Svg d={ICON.grow} /></span>
          <span className={s.duoTx}><span className={s.duoK}>Career guide</span><span className={s.duoHead}><b className={strongN ? s.flagGold : s.flagRed}>{guideLine}</b></span><span className={s.duoSub}>{guideCall}</span></span>
          <span className={s.duoGo}>Open guide →</span>
        </span></span></a>
        <Link prefetch={false} className={`${s.duoFrame} ${s.fBest}`} href={featured ? `/jobs/${featured.job.id}` : "#matches"}><span className={s.duoGap}><span className={`${s.duoCard} ${s.duoBest}`}>
          <span className={s.duoIc}><Svg d={ICON.star} /></span>
          <span className={s.duoTx}><span className={s.duoK}>Your best match · Ready to apply</span><span className={s.duoT}>{featured ? <>{featured.job.title} <small>· {featured.job.company}</small></> : "No match yet"}</span></span>
          {featured ? <b className={s.duoScore}>{featured.m.score}%</b> : null}
          <span className={s.duoGo}>{featured ? "Review & apply →" : "See opportunities →"}</span>
        </span></span></Link>
      </div>

      {panel("all-h", "Lifetime", "Every job we have checked for you", all, progress.applied, s.pAll, "Since you joined", false)}


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

          <div className={`${s.card} ${s.oppCard}`} id="matches">
            <div className={s.oppHead}><h2>Your Opportunities</h2><span className={s.muted}>Highest match first</span></div>
            {top.length ? top.map((x) => <OpportunityRow key={x.job.id} x={x} today={st.today} status={st.apps[x.job.id]?.status} ai={st.aiCheck.get(x.job.id)} hideFit />) : apps.some(isResolvedApplication) && !list.length
              ? <p className={s.empty}>You’re up to date. Your submitted applications are in <Link href="/applications">Applied</Link>. New opportunities will appear here.</p>
              : sx.analysed
                ? <p className={s.empty}>No Good Fit or better right now. We checked {fmt(sx.analysed)} jobs; try adding target roles or skills in your profile.</p>
                : <p className={s.empty}>No jobs in {cname(country)} yet. Paste a job you found, or set up automatic job alerts.</p>}
            {list.length ? <div className={s.foot}><Link prefetch={false} className={s.link} href="/opportunities">View all opportunities →</Link></div> : null}
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
              {["applied", "interview", "offer"].includes(latestApp.status) ? <Link prefetch={false} className={s.ivLink} href={`/jobs/${latestJob.id}#interview`}><Svg d={ICON.mic} />{latestApp.interview_prep ? "Your interview prep is ready" : "Practise interview questions for this job"}<span>Salary answers included →</span></Link> : null}
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
