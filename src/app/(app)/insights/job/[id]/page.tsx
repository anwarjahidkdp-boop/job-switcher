import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHead } from "@/components/PageHead";
import { Ring } from "@/components/ui";
import { requireAppState } from "@/lib/server/page";
import { liveMatch } from "@/lib/server/state";
import { BAND, fitLabel } from "@/lib/matching";
import { scoreGap } from "@/lib/score-gap";
import { skillLabel } from "@/lib/taxonomy";
import { gapAction } from "@/lib/gap-actions";
import { GapList } from "../../../jobs/[id]/client";

export const metadata = { title: "Career guide for this job" };

const IMPACT = { high: "Big effect", medium: "Some effect", low: "Small effect" } as const;

export default async function JobGapGuide({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { st, db } = await requireAppState(`/insights/job/${id}`);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const x = await liveMatch(st, db, id);
  if (!x) notFound();
  const { job, m } = x;
  const g = scoreGap(x, st.aiCheck.get(id));
  const back = { href: `/jobs/${job.id}`, label: "Back to the job" };
  return (
    <>
      <PageHead slim back={back} kicker="Career guide" title={<>Why <span>{g.score}%</span>, not 100%</>} />
      <div className="stack" style={{ gap: 16, marginTop: 10, maxWidth: 820 }}>
        <section className="card panel" aria-label="Your match for this job">
          <div className="gap-head">
            <Ring score={m.score} band={m.band} />
            <div style={{ minWidth: 0 }}>
              <h2 style={{ fontSize: 19, margin: 0 }}>{job.title}</h2>
              <p className="small muted" style={{ marginTop: 2 }}>{job.company}{job.location ? ` · ${job.location}` : ""}</p>
              <p className="small" style={{ marginTop: 6 }}><span className={`pill ${BAND[m.band][1]}`}>{!m.relevant ? "Outside your field" : m.expired ? "Deadline passed" : fitLabel(m.score)}</span> <b>{g.score}% match · {g.missing}% missing</b></p>
            </div>
          </div>
          <div className="gap-meter" role="img" aria-label={`${g.score}% matched, ${g.missing}% missing`}><i style={{ width: `${g.score}%` }} /><b style={{ width: `${g.missing}%` }} /></div>
          <div className="gap-legend"><span>Matched {g.score}%</span><span>Missing {g.missing}%</span></div>
          {g.source === "ai" ? <>
            <p className="small" style={{ marginTop: 12 }}>Our AI read the full job post next to your CV and gave {g.aiScore}%{g.cap ? `, held at ${g.cap.at}% by a requirement below` : ""}. It weighs the gaps below together, so we show how much each one matters, not exact points.</p>
            {g.aiReason ? <p className="ai-check warn gap-ai"><b>AI reading:</b> {g.aiReason}</p> : null}
          </> : <p className="small" style={{ marginTop: 12 }}>Your profile covers {g.score}% of what this post asks for. {g.missing ? `The other ${g.missing}% comes from ${g.reasons.length === 1 ? "this gap" : "these gaps"}:` : "Nothing is missing."}</p>}
          {!m.relevant ? <p className="note small" style={{ marginTop: 10 }}>This job is outside your field, so it is not counted as a Top match whatever its score.</p> : null}
        </section>

        {g.reasons.length ? <section className="card panel" aria-label="What is missing and how to close it">
          <h2 style={{ fontSize: 18, margin: 0 }}>What is missing, and how to close it</h2>
          <ol className="gap-list">
            {g.reasons.map((r) => <li key={r.key} className="gap-item">
              <div className="gap-item-head"><h3>{r.title}</h3>{r.pts != null ? <span className="gap-pts">−{r.pts}%</span> : <span className={`gap-impact ${r.impact}`}>{IMPACT[r.impact]}</span>}</div>
              {r.gaps.length ? <GapList gaps={r.gaps.slice(0, 4).map((x) => ({ t: x.t, skill: x.skill || null, label: x.skill ? skillLabel(x.skill) : null, action: gapAction(x.k) }))} /> : null}
              <div className="gap-do small"><b>What to do:</b> {r.advice}
                {r.learn.length ? <div className="gap-learn">{r.learn.map((l) => <span key={l.skill}><b style={{ color: "inherit" }}>{l.label}:</b> {l.links.slice(0, 2).map((k, i) => <span key={k.label}>{i ? " · " : " "}<a href={k.href} target="_blank" rel="noopener noreferrer nofollow">{k.label} ↗</a></span>)}</span>)}</div> : null}
              </div>
              {r.action || ["role", "loc", "edu", "cert", "exp"].includes(r.key) ? <div className="row" style={{ marginTop: 10, gap: 8 }}><Link prefetch={false} className="btn btn-ghost btn-sm" href={r.action?.href || "/profile"}>{r.action?.label || "Update my profile"}</Link></div> : null}
            </li>)}
          </ol>
        </section> : g.missing ? <section className="card panel"><p className="small">No single gap stands out for this job. Check that your CV shows your recent results and every skill you use.</p></section> : null}

        <section className="card panel" aria-label="About this score">
          <p className="small muted">The score compares your verified profile with this job&apos;s requirements. Closing a gap raises your match; it is not a promise of an interview. Only add skills and qualifications you really have, because we use them in every application.</p>
          <div className="row" style={{ marginTop: 10, gap: 8 }}><Link prefetch={false} className="btn btn-primary btn-sm" href={`/jobs/${job.id}`}>Review this job</Link><Link prefetch={false} className="btn btn-ghost btn-sm" href="/insights#career-guidance">Full career guide</Link></div>
        </section>
      </div>
    </>
  );
}
