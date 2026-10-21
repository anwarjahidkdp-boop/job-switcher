import { PageHead } from "@/components/PageHead";
import { notFound } from "next/navigation";
import { requireAppState, photoUrl } from "@/lib/server/page";
import { loadJob, withAiScores } from "@/lib/server/state";
import { scoreJob, BAND } from "@/lib/matching";
import { money, perLabel, rule, cname } from "@/lib/countries";
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
import { ReplyPanel } from "./ReplyPanel";
import { followUpDraft } from "@/lib/followup";
import { daysUntil } from "@/lib/dates";
import { FOLLOWUP_DAYS } from "@/lib/server/nudges";
import { normCompany } from "@/lib/ingest/sponsors";

export const metadata = { title: "Job" };
export const maxDuration = 120;

export default async function JobPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ notyet?: string; gmail?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const { st, db } = await requireAppState(`/jobs/${id}`);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const job = st.scored.find((x) => x.job.id === id)?.job || (await loadJob(db, id));
  if (!job) notFound();
  const m = withAiScores([{ job, m: scoreJob(job, st.P, { today: st.today, needVisa: st.profile.needs_visa, homeCountry: st.homeCountry }) }], st.aiCheck)[0].m;
  const ai = st.aiCheck.get(job.id);
  const a = st.apps[job.id];
  // UK jobs, for people who need a work visa: is the employer on the GOV.UK register of licensed sponsors? Display only, never changes the score.
  const sponsor = job.country === "GB" && st.profile.needs_visa && normCompany(job.company)
    ? (await db.from("uk_sponsors").select("name").eq("name_norm", normCompany(job.company)).maybeSingle()).data : null;
  const r = rule(job.country);
  const { tpl, accent } = resolveStyle(st.profile.cv_style, job.country);
  const photo = a?.pack ? await photoUrl(db, st.profile.photo_path) : null;
  const canEmail = job.apply.method === "email" && !!job.apply.target && gmailConfigured();
  const gmail = canEmail ? await gmailAccount(createAdminClient(), st.userId) : null;
  return (
    <>
      <PageHead slim back={{ href: "/inbox", label: "Back to opportunities" }} />
      <div className="jobgrid" style={{ marginTop: 10 }}>
        <div className="stack" style={{ gap: 18 }}>
          <div className="card panel">
            <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
              <div><h1 style={{ fontSize: 26 }}>{job.title}</h1><p className="muted" style={{ marginTop: 4 }}>{job.company}{job.location ? ` · ${job.location}` : ""} · {job.type || "Full-time"}</p></div>
              <Ring score={m.score} band={m.band} />
            </div>
            <div className="row" style={{ marginTop: 12, gap: 8 }}>
              <DeadlineChip deadline={job.deadline} today={st.today} />
              {job.salaryMax ? <span className="pill p-neutral">{money(job.salaryMin, job.country)}–{money(job.salaryMax, job.country)}{perLabel(job.country)}</span> : <span className="pill p-neutral">Salary not disclosed</span>}
              {sponsor ? <span className="pill p-st" title={`${sponsor.name} is on the GOV.UK register of licensed sponsors`}>✓ Licensed UK visa sponsor</span> : null}
              {job.visa === true ? <span className="pill p-st">Visa sponsorship</span> : job.visa === false && job.country !== st.homeCountry ? <span className="pill p-warn">No sponsorship</span> : null}
              {job.minYears != null ? <span className="pill p-neutral">{job.minYears}+ years</span> : null}
              <span className="pill p-neutral">{job.source}{job.isSample ? " · fictional sample" : ""}</span>
            </div>
            {job.resp.length ? <><h3 style={{ fontSize: 15, marginTop: 18 }}>Main responsibilities</h3><ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>{job.resp.map((x, i) => <li key={i}>{x}</li>)}</ul></> : null}
            <h3 style={{ fontSize: 15, marginTop: 14 }}>Asks for</h3>
            <div className="skchips" style={{ marginTop: 6 }}>
              {job.required.map((s) => <span key={s} className="sk">{skillLabel(s)}</span>)}
              {job.preferred.map((s) => <span key={"p" + s} className="sk">{skillLabel(s)} · preferred</span>)}
              {job.certs.map((c, i) => <span key={"c" + i} className="sk">{c.names.join(" or ")}{c.required ? "" : " · preferred"}</span>)}
              {!job.required.length && !job.preferred.length && !job.certs.length ? <span className="small muted">The post does not list specific skills.</span> : null}
            </div>
            {job.url ? <p className="small" style={{ marginTop: 14 }}><a href={job.url} target="_blank" rel="noopener noreferrer nofollow">View the original post ↗</a></p> : null}
          </div>
          {a?.status === "applied" ? (() => {
            const since = a.applied_at ? -(daysUntil(a.applied_at.slice(0, 10), st.today) ?? 0) : 0;
            // Follow-up emails to employers are not the custom in Bangladesh (owner's call), so they are offered elsewhere only.
            const followUps = job.country !== "BD";
            const to = followUps && job.apply.method === "email" ? job.apply.target : null;
            const fu = to ? followUpDraft({ jobTitle: job.title, company: job.company, appliedOn: a.applied_at, name: st.profile.full_name || st.master.content.name, currentTitle: st.P.currentTitle || null, email: st.profile.email, phone: st.profile.phone }) : null;
            return <ReplyPanel jobId={job.id} company={job.company} daysSince={since} followUp={fu} to={to} canFollowUp={since >= FOLLOWUP_DAYS} followUps={followUps} />;
          })() : null}
          {a && ["applied", "interview", "offer"].includes(a.status) ? (
            <InterviewPanel jobId={job.id} company={job.company} at={a.interview_at ?? null} mode={a.interview_mode ?? null} where={a.interview_where ?? null} notes={a.interview_notes ?? null}
              prep={a.interview_prep ?? null} prepAi={!!a.interview_prep_ai} aiReady={aiConfigured()} />
          ) : null}
          {a?.pack ? (
            <div className="card panel">
              <div className="row" style={{ justifyContent: "space-between" }}><h2 style={{ fontSize: 19 }}>Your application pack</h2><span className="small muted">{a.pack_ai ? "Prepared with Claude from your verified profile" : "Template version"}</span></div>
              {a.pack_flags.length ? <p className="note" style={{ marginTop: 10, borderColor: "var(--warn)" }}>Check before sending: {a.pack_flags.join("; ")}.</p> : null}
              <PackTabs
                emphasis={a.pack.emphasis || []}
                cv={<><CvToolbar tpl={tpl} accent={accent} photoAllowed={r.photo} hasPhoto={!!st.profile.photo_path} countryLabel={cname(job.country)} rules={r.rules} /><CvPreview master={st.master.content} tailored={a.pack} country={job.country} homeCountry={st.homeCountry} style={st.profile.cv_style} personal={st.profile.personal} photoUrl={photo} /></>}
                jobId={job.id}
                cover={a.pack.cover_letter}
                subject={a.pack.email_subject}
                email={a.pack.email_body}
                to={job.apply.method === "email" ? job.apply.target : null}
                checklist={a.pack.checklist || []}
              />
            </div>
          ) : null}
        </div>
        <aside className="side">
          <div className="card panel">
            <p className="eyebrow">Why this job?</p>
            <p style={{ margin: "6px 0 12px" }}><span className={`pill ${BAND[m.band][1]}`}>{BAND[m.band][0]}</span> <b className="num">{m.score}% profile match</b></p>
            {ai?.reason ? <p className={`ai-check ${ai.fit === "strong" ? "ok" : "warn"}`} style={{ marginBottom: 12 }}><b>AI check:</b> {ai.reason}</p> : <p className="small muted" style={{ marginBottom: 12 }}>First estimate from your profile. Our AI reads the full post next to your CV in the daily check and updates this score.</p>}
            {m.matched.length ? <><h3>Strong matches</h3><ul className="why-list">{m.matched.map((t) => <li key={t}><span className="mk ok">✓</span><span>{t}</span></li>)}</ul></> : null}
            {m.gaps.length ? <><h3 style={{ marginTop: 14 }}>Potential gaps</h3><GapList gaps={m.gaps.map((g) => ({ t: g.t, skill: g.skill || null, label: g.skill ? skillLabel(g.skill) : null }))} /></> : null}
            <p className="small muted" style={{ marginTop: 14 }}>The score compares your verified profile with this job&apos;s requirements. It is not a chance of being hired.</p>
          </div>
          <div className="card panel">
            <ActionsPanel jobId={job.id} status={a?.status ?? null} hasPack={!!a?.pack} reminderDate={a?.reminder_date ?? null} appliedAt={a?.applied_at ?? null}
              deadline={job.deadline} today={st.today} applyMethod={job.apply.method} applyTarget={job.apply.target} url={job.url} notYet={sp.notyet === "1"}
              gmailReady={canEmail} gmail={gmail} gmailStatus={sp.gmail ?? null} />
          </div>
        </aside>
      </div>
    </>
  );
}
