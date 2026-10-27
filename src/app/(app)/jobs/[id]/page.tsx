import {isResolvedApplication} from "@/lib/applied-history";
import {JobApplicationAction} from "@/components/JobApplicationAction";
import { ApplicationProgress } from "@/components/ApplicationProgress";
import { applicationCv,packBoundToJob,canReusePack } from "@/lib/application-documents";
import { manualDraft } from "@/lib/manual-cv";
import { ManualCvEditor } from "@/components/ManualCvEditor";
import { QueueDismissButton } from "@/components/QueueDismissButton";
import { applicationSafety, canPrepareDraft } from "@/lib/career-safety";
import { PrepareApplicationButton } from "@/components/PrepareApplicationButton";
import { PageHead } from "@/components/PageHead";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isPro, requireAppState, photoUrl } from "@/lib/server/page";
import { loadJob, withAiScores } from "@/lib/server/state";
import { scoreJob, BAND, fitLabel } from "@/lib/matching";
import { rule, cname, salaryText } from "@/lib/countries";
import { skillLabel } from "@/lib/taxonomy";
import { resolveStyle } from "@/lib/cv/render";
import { Ring, DeadlineChip } from "@/components/ui";
import { CvPreview } from "@/components/CvPreview";
import { CvToolbar } from "@/components/CvToolbar";
import { ActionsPanel, GapList, PackTabs } from "./client";
import { createAdminClient } from "@/lib/supabase/admin";
import { gmailAccount, gmailConfigured } from "@/lib/server/gmail";
import { aiConfigured } from "@/lib/ai";
import { InterviewPanel } from "./InterviewPanel";
import { OfferPanel } from "./OfferPanel";
import { salaryFacts, withSalaryPrep } from "@/lib/interview/salary";
import { ReplyPanel } from "./ReplyPanel";
import { followUpDraft } from "@/lib/followup";
import { daysUntil } from "@/lib/dates";
import { FOLLOWUP_DAYS } from "@/lib/server/nudges";
import { normCompany } from "@/lib/ingest/sponsors";
import { packAllowanceFor } from "@/lib/server/applications";
import { trialApplyRoom, unlockedReady } from "@/lib/pack-limits";
import { applicationFee, askRows, feeLine, postAsks } from "@/lib/job-asks";
import { gapAction } from "@/lib/gap-actions";
import { scamCheck } from "@/lib/scam-check";

export const metadata = { title: "Job" };
export const maxDuration = 120;

export default async function JobPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ notyet?: string; gmail?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const { st, db } = await requireAppState(`/jobs/${id}`);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const job = st.scored.find((x) => x.job.id === id)?.job || (await loadJob(db, id));
  if (!job) notFound();
  if (job.country !== st.country && !st.apps[job.id]?.applied_at) return <><PageHead title={<>Previous search country</>} sub="This selection has left your active queue. Choose a job in your current search country." /><Link className="btn btn-primary" href="/inbox">View current opportunities</Link></>;
  if (job.active === false && !st.apps[job.id]) return <><PageHead title={<>Listing unavailable</>} sub="This vacancy has closed or its source requires review. It is not currently offered as a job recommendation." /><Link className="btn btn-ghost" href="/opportunities">Back to opportunities</Link></>;
  const m = withAiScores([{ job, m: scoreJob(job, st.P, { today: st.today, needVisa: st.profile.needs_visa, homeCountry: st.homeCountry }) }], st.aiCheck)[0].m;
  const ai = st.aiCheck.get(job.id);
  const storedApp = st.apps[job.id];
  const a=storedApp?.pack&&!packBoundToJob(storedApp.pack,job.id)?{...storedApp,pack:null}:storedApp;
  const resolved=isResolvedApplication(a);
  const sourceNeedsRefresh=!resolved&&!!a?.pack&&!canReusePack(a.pack,job.id,st.master.id);
  const canUpgradeStandard=!resolved&&!!a?.pack&&!a.pack_ai&&!a.pack.user_edited&&aiConfigured();
  const packMaster=a?.pack?applicationCv(st.master.content,a.pack):st.master.content;
  const canEmail = job.apply.method === "email" && !!job.apply.target && gmailConfigured();
  // Every read below is its own round trip to the database, so they all run at once.
  const [{ data: descRow }, { data: occurrences }, sponsor, photo, gmail, allowance, pro] = await Promise.all([
    // The full post, so the person can judge the job themselves before applying (list loads leave it out).
    db.from("jobs").select("description,source_kind").eq("id", job.id).maybeSingle(),
    job.country === "BD" ? db.from("job_source_occurrences").select("discovered_url, original_source_url").eq("job_id", job.id).limit(20) : { data: null },
    // UK jobs, for people who need a work visa: is the employer on the GOV.UK register of licensed sponsors? Display only, never changes the score.
    job.country === "GB" && st.profile.needs_visa && normCompany(job.company)
      ? db.from("uk_sponsors").select("name").eq("name_norm", normCompany(job.company)).maybeSingle().then((r) => r.data) : null,
    a?.pack ? photoUrl(db, st.profile.photo_path) : null,
    canEmail ? gmailAccount(createAdminClient(), st.userId) : null,
    !resolved&&(!a?.pack||sourceNeedsRefresh||canUpgradeStandard) && aiConfigured() ? packAllowanceFor(createAdminClient(), st.userId) : null,
    isPro(db, st.userId),
  ]);
  const description = String(descRow?.description || "").replace(/\n{3,}/g, "\n\n").trim().slice(0, 20000);
  const scam = scamCheck(job, description);
  const publicLink = (value: string | null) => { try { const u = new URL(value || ""); return /^https?:$/.test(u.protocol) && !u.username && !u.password ? u.href : null; } catch { return null; } };
  const foundAt = [...new Set((occurrences || []).map(o => publicLink(o.discovered_url)).filter((u): u is string => !!u))];
  const original = (occurrences || []).map(o => publicLink(o.original_source_url)).find(Boolean);
  const r = rule(job.country);
  const { tpl, accent } = resolveStyle(st.profile.cv_style, job.country);
  const safety = applicationSafety(job,st.profile.preferences,st.profile.deal_breakers,st.profile.answer_library,st.profile.needs_visa,{P:st.P,today:st.today});
  const needsFreshPack=sourceNeedsRefresh||(canUpgradeStandard&&!!allowance?.left);
  // Free trial: one ready application a day can be opened; the rest wait behind Pro (the Apply Queue shows the same).
  const apps = Object.values(st.apps);
  const room = trialApplyRoom(apps);
  const lockedPack = !!a?.pack && (a.status === "ready" || a.status === "reminder") && !pro && !unlockedReady(apps, room).has(job.id);
  const aiLeft = !allowance ? null : allowance.left
    ? `AI tailoring: ${allowance.left} pack${allowance.left === 1 ? "" : "s"} available today.`
    : allowance.reason === "day" ? "Standard version available · AI tailoring renews tomorrow." : "Standard version available · AI allowance used.";
  const eligibility = {issues:safety.issues,eligible:canPrepareDraft(safety)};
  const fee = job.country === "BD" ? applicationFee(description) : null;
  const canPrepare = !resolved && eligibility.eligible && (!a?.pack||needsFreshPack) && job.active !== false && !["applied", "interview", "offer", "closed", "withdrawn"].includes(a?.status || "") && (!job.deadline || job.deadline >= st.today);
  return (
    <>
      <PageHead slim back={{ href: "/opportunities", label: "Back to opportunities" }} />
      <div className="jobgrid document-layout" style={{ marginTop: 10 }}>
        <div className="stack" style={{ gap: 18 }}>
          <div className="card panel">
            <div className="job-review-header">
              <div className="job-review-company"><h1 style={{ fontSize: 26 }}>{job.title}</h1><p className="muted" style={{ marginTop: 4 }}>{job.company}{job.location ? ` · ${job.location}` : ""} · {job.type || "Full-time"}</p></div>
              <div className="job-review-action"><JobApplicationAction application={a}>{canPrepare?<PrepareApplicationButton key={job.id} jobId={job.id} label="Apply" openPack/>:a?.pack?<Link prefetch={false} className="btn btn-primary btn-sm queue-review-cta" href="#application">Apply</Link>:<button className="btn btn-primary btn-sm" disabled title="Review the eligibility requirements below">Apply</button>}</JobApplicationAction><Ring score={m.score} band={m.band} /></div>
            </div>
            <div className="row" style={{ marginTop: 12, gap: 8 }}>
              <DeadlineChip deadline={job.deadline} today={st.today} />
              <span className="pill p-neutral">{salaryText(job.salaryMin, job.salaryMax, job.country) || "Salary not published"}</span>
              {sponsor ? <span className="pill p-st" title={`${sponsor.name} is on the GOV.UK register of licensed sponsors`}>✓ Licensed UK visa sponsor</span> : null}
              {job.visa === true ? <span className="pill p-st">Visa sponsorship</span> : job.visa === false && job.country !== st.homeCountry ? <span className="pill p-warn">No sponsorship</span> : null}
              {job.country === "BD" && job.eligibility?.payGrade ? <span className="pill p-neutral" title="Bangladesh national pay scale grade">Govt grade {job.eligibility.payGrade}</span> : null}
              {job.minYears != null ? <span className="pill p-neutral">{job.minYears}+ years</span> : null}
              <span className="pill p-neutral">{job.source}{job.isSample ? " · fictional sample" : ""}</span>
            </div>
            {eligibility.issues.length ? <div className="note small" role="status" style={{marginTop:12}}><b>Eligibility and pay check</b><ul>{eligibility.issues.map(i=><li key={i.code}>{i.message}</li>)}</ul><div className="row" style={{gap:8}}>{[...new Map(eligibility.issues.map(i=>gapAction(i.code)).filter(x=>!!x).map(x=>[x!.label,x!])).values()].map(x=><Link key={x.label} className="btn btn-primary btn-sm" href={x.href}>{x.label}</Link>)}</div></div>:null}
            {fee ? <p className="note small" role="note" style={{ marginTop: 12 }}><b>Application fee:</b> {feeLine(fee)}. The circular charges this to apply; pay it only through the method the official circular names.</p> : null}
            {scam.level !== "none" ? <div className={`note small scam-note${scam.level === "high" ? " scam-high" : ""}`} role="alert" style={{ marginTop: 12 }}><b>{scam.level === "high" ? "Warning: this post shows signs of a fake job" : "Check this job carefully before you apply"}</b><ul>{scam.reasons.map((x) => <li key={x}>{x}</li>)}</ul><span>A real employer never asks you to pay to get a job. Do not send money, bank or card details, or original documents. Check the company on its official website before applying.</span></div> : null}
            {descRow?.source_kind === 'bdweb' ? <p className="note small" style={{ marginTop: 12 }}>Confirm the employer, full eligibility and application instructions in the linked original advertisement before applying. A source listing does not guarantee an employer or job offer.</p> : null}
            {job.resp.length ? <><h3 style={{ fontSize: 15, marginTop: 18 }}>Main responsibilities</h3><ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>{job.resp.map((x, i) => <li key={i}>{x}</li>)}</ul></> : null}
            <h3 style={{ fontSize: 15, marginTop: 14 }}>Asks for</h3>
            <div className="skchips" style={{ marginTop: 6 }}>
              {job.required.map((s) => <span key={s} className="sk">{skillLabel(s)}</span>)}
              {job.preferred.map((s) => <span key={"p" + s} className="sk">{skillLabel(s)} · preferred</span>)}
              {job.certs.map((c, i) => <span key={"c" + i} className="sk">{c.names.join(" or ")}{c.required ? "" : " · preferred"}</span>)}
              {!job.required.length && !job.preferred.length && !job.certs.length ? <span className="small muted">The post does not list specific skills.</span> : null}
            </div>
            {description || job.url || canPrepare ? <div className="jd-actions">
              {description ? <details className="jd"><summary className="btn btn-ghost btn-sm">View job description</summary><div className="jd-text">{description}</div></details> : null}
              {job.url ? <a className="btn btn-ghost btn-sm" href={job.url} target="_blank" rel="noopener noreferrer nofollow">Open the original post ↗</a> : null}
              {canPrepare ? <div className="jd-application-group"><ActionsPanel compact jobId={job.id} status={a?.status ?? null} hasPack={!!a?.pack} reminderDate={a?.reminder_date ?? null} appliedAt={a?.applied_at ?? null}
              deadline={job.deadline} today={st.today} applyMethod={job.apply.method} applyTarget={job.apply.target} url={job.url} notYet={sp.notyet === "1"}
              canApply={safety.safe} blockingReason={safety.issues.filter(i=>i.blocking).map(i=>i.message).join(" ")} gmailReady={canEmail} gmail={gmail} gmailStatus={sp.gmail ?? null} /></div> : null}
            </div> : null}
            {canPrepare && aiLeft ? <p className="small muted jd-ai-note">{aiLeft}</p> : null}
            <div className="row" style={{marginTop:12}}><Link prefetch={false} className="btn btn-ghost btn-sm" href="/opportunities">Choose another job</Link>{!a?.applied_at?<QueueDismissButton jobId={job.id} advance/>:null}</div>
            {foundAt.length ? <p className="small muted" style={{ marginTop: 10 }}>Found on: {foundAt.map((u, i) => <span key={u}>{i ? " · " : ""}<a href={u} target="_blank" rel="noopener noreferrer nofollow">{new URL(u).hostname}</a></span>)}{original ? <> · <a href={original} target="_blank" rel="noopener noreferrer nofollow">Employer / original circular ↗</a></> : null}</p> : null}
          </div>
          {!a?.pack && !["applied","interview","offer","closed","withdrawn"].includes(a?.status||"") ? <section className="card panel application-workspace" id="application"><h2>Your CV &amp; cover letter</h2>{canPrepare?<><p className="small muted">Review the company and job details first. Press Apply beside the company name when you are ready to prepare your CV, cover letter and email draft. Reviewing this page does not use AI.</p>{!safety.safe?<p className="note small" role="status">This job does not publish its salary. Confirm the pay before you send your application.</p>:null}</>:<p className="note small" role="status">{safety.issues.filter(i=>i.blocking).map(i=>i.message).join(" ") || "This application cannot be prepared in its current state."}</p>}</section>:null}
          {a?.status === "applied" ? (() => {
            const since = a.applied_at ? -(daysUntil(a.applied_at.slice(0, 10), st.today) ?? 0) : 0;
            // Follow-up emails to employers are not the custom in Bangladesh (owner's call), so they are offered elsewhere only.
            const followUps = job.country !== "BD";
            const to = followUps && job.apply.method === "email" ? job.apply.target : null;
            const fu = to ? followUpDraft({ jobTitle: job.title, company: job.company, appliedOn: a.applied_at, name: st.profile.full_name || st.master.content.name, currentTitle: st.P.currentTitle || null, email: st.profile.email, phone: st.profile.phone }) : null;
            return <ReplyPanel jobId={job.id} company={job.company} daysSince={since} followUp={fu} to={to} canFollowUp={since >= FOLLOWUP_DAYS} followUps={followUps} />;
          })() : null}
          {lockedPack ? (
            <div className="card panel upsell application-workspace" id="application">
              <p className="eyebrow">Your application is ready</p>
              <h3 style={{ margin: "4px 0 6px" }}>Tailored CV and cover letter for {job.company}</h3>
              <p className="small">Your free trial includes one application a day, and today&apos;s is used. Go Pro to open this one now and apply to as many good matches as you like each day.</p>
              <Link className="btn btn-gold" style={{ marginTop: 10 }} href="/upgrade?from=job">Go Pro and apply now</Link>
            </div>
          ) : a?.pack ? (
            <div className="card panel application-workspace" id="application">
              <div className="row" style={{ justifyContent: "space-between" }}><h2 style={{ fontSize: 19 }}>Your application pack</h2><span className="small muted">{a.pack_ai ? "AI tailored for this job" : "Standard draft"}</span></div>
              <div className="application-specific-note" role="note"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 14l2 2 5-5"/></svg><div><b>Prepared specifically for this application</b><p>Your CV and cover letter are prepared for the <strong>{job.title}</strong> role at <strong>{job.company}</strong>.</p></div></div>
              {a.pack.preparation_note?<p className="note small" role="status">{a.pack.preparation_note}</p>:null}
              {a.pack_flags.length ? <p className="note" style={{ marginTop: 10, borderColor: "var(--warn)" }}>Check before sending: {a.pack_flags.join("; ")}.</p> : null}
              {(() => {
                const rows = askRows(a.pack.asks?.length ? a.pack.asks : postAsks(description), { hasPhoto: !!st.profile.photo_path, photoAllowed: r.photo, notice: st.profile.preferences?.notice ?? null, salaryMin: st.profile.preferences?.salaryMin ?? null }).concat(fee ? [{ item: "Application fee", status: "you" as const, note: `Pay ${feeLine(fee)}` }] : []);
                return rows.length || a.pack.instructions ? (
                  <div className="asks">
                    <h3>What this job post asks for</h3>
                    {rows.length ? <ul>{rows.map((x) => <li key={x.item} className={`ask ask-${x.status}`}><span className="ask-mk" aria-hidden>{x.status === "you" ? "!" : "✓"}</span><span><b>{x.item}</b><small>{x.note}</small></span></li>)}</ul> : null}
                    {a.pack.instructions ? <p className="small" style={{ marginTop: 8 }}><b>Instructions in the post:</b> {a.pack.instructions}</p> : null}
                  </div>
                ) : <p className="small muted" style={{ marginTop: 10 }}>The post does not list documents, so your tailored CV and cover letter are ready to send.</p>;
              })()}
              {needsFreshPack?<p className="note small" role="status">Press Apply to prepare fresh documents from your latest CV for this job.</p>:null}
              <PackTabs key={job.id}
                canEdit={["ready","reminder","waiting"].includes(a.status)}
                updatedAt={a.updated_at}
                cvEditor={<ManualCvEditor key={job.id} initial={manualDraft(packMaster,a.pack.edited_cv?[]:st.facts)} baseId={st.master.id} country={st.country} revision={st.profile.search_country_version} application={{jobId:job.id,updatedAt:a.updated_at}} defaultOpen/>}
                cv={<><CvToolbar tpl={tpl} accent={accent} photoAllowed={r.photo} hasPhoto={!!st.profile.photo_path} countryLabel={cname(job.country)} rules={r.rules} downloads={{ pdf: `/api/cv/download?format=print&jobId=${job.id}`, doc: `/api/cv/download?format=doc&jobId=${job.id}`, label: "CV tailored for this job" }} /><CvPreview master={packMaster} tailored={a.pack.edited_cv?null:a.pack} country={job.country} homeCountry={st.homeCountry} style={st.profile.cv_style} personal={st.profile.personal} noticeDays={st.profile.preferences?.notice ?? null} photoUrl={photo} /></>}
                jobId={job.id}
                cover={a.pack.cover_letter}
                subject={a.pack.email_subject}
                email={a.pack.email_body}
                to={job.apply.method === "email" ? job.apply.target : null}
                checklist={a.pack.checklist || []}
              />
              <ApplicationProgress key={`progress-${job.id}`} jobId={job.id} status={a.status} appliedAt={a.applied_at} interviewAt={a.interview_at} history={a.application_events||[]} trial={!pro} remaining={room}/>
            </div>
          ) : null}
          {a?.status === "offer" ? <OfferPanel job={{ title: job.title, company: job.company, country: job.country, salaryMin: job.salaryMin, salaryMax: job.salaryMax }} facts={salaryFacts(st.profile.answer_library, st.profile.preferences, job.country, st.country)} name={st.profile.full_name || st.master.content.name} sym={rule(job.country).sym} per={rule(job.country).per === "year" ? "a year" : "a month"} /> : null}
          {a && ["applied", "interview", "offer"].includes(a.status) ? (
            <InterviewPanel jobId={job.id} company={job.company} at={a.interview_at ?? null} mode={a.interview_mode ?? null} where={a.interview_where ?? null} notes={a.interview_notes ?? null}
              prep={a.interview_prep ? withSalaryPrep(a.interview_prep, job, salaryFacts(st.profile.answer_library, st.profile.preferences, job.country, st.country)) : null} prepAi={!!a.interview_prep_ai} aiReady={aiConfigured()} />
          ) : null}
        </div>
        <aside className="side">
          {!pro ? <div className="card panel upsell" role="status">
            <p className="eyebrow">Free trial</p>
            <h3 style={{ margin: "4px 0 6px" }}>1 application per day · {room} remaining today</h3>
            <p className="small">Your allowance is shared across all countries. Changing country does not reset it.</p>
            {!room ? <Link className="btn btn-gold" style={{ marginTop: 10 }} href="/upgrade">Go Pro and apply to more</Link> : null}
          </div> : null}
          <div className="card panel">
            <p className="eyebrow">Why this job?</p>
            <p style={{ margin: "6px 0 12px" }}><span className={`pill ${BAND[m.band][1]}`}>{fitLabel(m.score)}</span> <b className="num">{m.score}% profile match</b></p>
            {ai?.reason ? <p className={`ai-check ${ai.fit === "strong" ? "ok" : "warn"}`} style={{ marginBottom: 12 }}><b>AI check:</b> {ai.reason}</p> : <p className="small muted" style={{ marginBottom: 12 }}>First estimate from your profile. Our AI reads the full post next to your CV in the daily check and updates this score.</p>}
            {m.matched.length ? <><h3>Strong matches</h3><ul className="why-list">{m.matched.map((t) => <li key={t}><span className="mk ok">✓</span><span>{t}</span></li>)}</ul></> : null}
            {m.gaps.length ? <><h3 style={{ marginTop: 14 }}>Potential gaps</h3><GapList gaps={m.gaps.map((g) => ({ t: g.t, skill: g.skill || null, label: g.skill ? skillLabel(g.skill) : null, action: gapAction(g.k) }))} /></> : null}
            <p className="small muted" style={{ marginTop: 14 }}>The score compares your verified profile with this job&apos;s requirements. It is not a chance of being hired.</p>
          </div>
          {lockedPack || canPrepare ? null : <div className="card panel">
            <ActionsPanel jobId={job.id} status={a?.status ?? null} hasPack={!!a?.pack} reminderDate={a?.reminder_date ?? null} appliedAt={a?.applied_at ?? null}
              deadline={job.deadline} today={st.today} applyMethod={job.apply.method} applyTarget={job.apply.target} url={job.url} notYet={sp.notyet === "1"}
              canApply={safety.safe} blockingReason={safety.issues.filter(i=>i.blocking).map(i=>i.message).join(" ")} gmailReady={canEmail} gmail={gmail} gmailStatus={sp.gmail ?? null} />
          </div>}
        </aside>
      </div>
    </>
  );
}
