import { FitOverviewCard, fitTiles } from "@/components/FitOverviewCard";
import Link from "next/link";
import { strongFitGuide } from "@/lib/strong-fit";
import { PageHead } from "@/components/PageHead";
import { requireAppState } from "@/lib/server/page";
import { skillDemand, skillImpact } from "@/lib/matching";
import { skillLabel } from "@/lib/taxonomy";
import { aiConfigured } from "@/lib/ai";
import { latestCareerReports } from "@/lib/server/career-reports";
import { SkillRows } from "./SkillRows";

export const metadata = { title: "Insights" };

export default async function Insights() {
  const { st, db, userId } = await requireAppState("/insights");
  const reports = await latestCareerReports(db,userId);
  const { rows } = skillDemand(st.scored, st.P);
  const rel = st.scored.filter(x=>x.m.relevant && !x.m.expired);
  const guide = strongFitGuide(rel);
  const max = rows[0]?.n || 1;
  const missed = rel.filter((x) => x.m.score < 70 && !x.m.expired);
  const rc: Record<string, { n: number; examples: string[] }> = {};
  for (const x of missed) { const k = x.m.reason + (x.m.reasonDetail ? ` (${x.m.reasonDetail})` : ""); const r = rc[k] || { n: 0, examples: [] }; r.n++; if (r.examples.length < 2) r.examples.push(`${x.job.title} · ${x.job.company}`); rc[k] = r; }
  const opts = { today: st.today, needVisa: st.profile.needs_visa, homeCountry: st.homeCountry };
  const top = rows.slice(0, 10).map((r) => {
    const imp = r.h.v < 1 ? skillImpact(st.scored, st.P, r.s, opts) : null;
    return { s: r.s, label: skillLabel(r.s), n: r.n, v: r.h.v, pct: Math.round((100 * r.n) / max), impact: imp };
  });
  return (
    <>
      <PageHead kicker="Market insights" title={<>Your career <span>market</span></>} sub={`Based on ${rel.length} relevant jobs analysed for your profile.`} />
      <div className="fit-overview" style={{ marginTop: 18 }}>
        {fitTiles(rel).map(tile=><FitOverviewCard compact key={tile.label} tile={tile} rows={rel}/>)}
      </div>
      <section id="career-guidance" className="card panel career-guidance" aria-label="Career guidance">
        <div className="row" style={{justifyContent:"space-between"}}><h3>Career guidance</h3><span className="pill p-ex">Strong Fit · 90% or higher</span></div>
        {guide?.score!=null ? <p className="small muted">Current best: {guide.score}% · {guide.points} points to Strong Fit.</p> : null}
        {guide?.skills.length ? <><p className="small" style={{marginTop:8}}><b>Skills to develop or confirm</b></p><div className="skchips">{guide.skills.map(s=><span className="sk" key={s.skill}>{s.label}</span>)}</div><Link className="btn btn-ghost btn-sm" style={{marginTop:10}} href="/profile">Update my skills</Link></> : <p className="small muted" style={{marginTop:8}}>{guide ? "No specific skill gap is confirmed yet. Review your profile and the job requirements." : "You have Strong Fit opportunities. Keep your verified skills up to date."}</p>}
      </section>
      <section id="career-reports" className="stack" style={{marginTop:18}} aria-label="Career reports">
        {reports.map(r=><article className="card panel" key={r.id}>
          <h3>{r.kind === "trial" ? "Your First 5 Days with JobPao" : "Your Weekly Career Report"}</h3>
          <p className="small muted">{r.period_start.slice(0,10)} to {r.period_end.slice(0,10)} · UTC · Recorded through {r.period_end.slice(11,16)}</p>
          <dl className="tiles">{([["Jobs checked for you",r.metrics.jobs_analysed],["Relevant opportunities",r.metrics.relevant],["Top matches",r.metrics.strong],["Applications prepared",r.metrics.prepared],["Applications submitted",r.metrics.applied],["Interviews",r.metrics.interviews],["Offers",r.metrics.offers]] as [string,number][]).map(([label,n])=><div className="tile" key={label}><dt className="small">{label}</dt><dd className="num">{n}</dd></div>)}</dl>
          {r.metrics.top_gap?<p className="small">Most common gap: {r.metrics.top_gap}</p>:null}
          {r.metrics.next_deadline?<p className="small">Next application deadline: {r.metrics.next_deadline}</p>:null}
        </article>)}
      </section>
      <div className="dash" style={{ marginTop: 18 }}>
        <div className="card panel"><h3>Most requested skills</h3>
          {top.length ? <SkillRows rows={top} aiReady={aiConfigured()} /> : <p className="small muted">No relevant jobs yet.</p>}
        </div>
        <div className="side"><div className="card panel"><h3>Why opportunities were missed</h3>
          <p className="small muted" style={{ marginBottom: 8 }}>{missed.length} otherwise relevant jobs scored below 70:</p>
          {Object.entries(rc).sort((a, b) => b[1].n - a[1].n).map(([k, r]) => <div key={k} className="qitem"><div><span className="small"><b>{k}</b></span><div className="small muted">{r.examples.join(" · ")}</div></div><b className="num">{r.n}</b></div>)}
          {!missed.length ? <p className="small muted">None.</p> : null}
        </div></div>
      </div>
    </>
  );
}
