import { PageHead } from "@/components/PageHead";
import { requireAppState } from "@/lib/server/page";
import { BAND, skillDemand, skillImpact } from "@/lib/matching";
import { skillLabel } from "@/lib/taxonomy";
import { aiConfigured } from "@/lib/ai";
import { latestCareerReports } from "@/lib/server/career-reports";
import { SkillRows } from "./SkillRows";

export const metadata = { title: "Insights" };

export default async function Insights() {
  const { st, db, userId } = await requireAppState("/insights");
  const reports = await latestCareerReports(db,userId);
  const { rel, rows } = skillDemand(st.scored, st.P);
  const max = rows[0]?.n || 1;
  const missed = rel.filter((x) => x.m.score < 70 && !x.m.expired);
  const rc: Record<string, { n: number; examples: string[] }> = {};
  for (const x of missed) { const k = x.m.reason + (x.m.reasonDetail ? ` (${x.m.reasonDetail})` : ""); const r = rc[k] || { n: 0, examples: [] }; r.n++; if (r.examples.length < 2) r.examples.push(`${x.job.title} · ${x.job.company}`); rc[k] = r; }
  const opts = { today: st.today, needVisa: st.profile.needs_visa, homeCountry: st.homeCountry };
  const top = rows.slice(0, 10).map((r) => {
    const imp = r.h.v < 1 ? skillImpact(st.scored, st.P, r.s, opts) : null;
    return { s: r.s, label: skillLabel(r.s), n: r.n, v: r.h.v, pct: Math.round((100 * r.n) / max), impact: imp };
  });
  const band = (b: string) => rel.filter((x) => x.m.band === b).length;
  return (
    <>
      <PageHead kicker="Market insights" title={<>Your career <span>market</span></>} sub={`Based on ${rel.length} relevant jobs analysed for your profile.`} />
      <div className="tiles" style={{ marginTop: 18 }}>
        {([["Relevant jobs", rel.length], [BAND.ex[0], band("ex")], [BAND.st[0], band("st")], [BAND.po[0], band("po")], [BAND.lo[0], band("lo")]] as [string, number][]).map(([l, n]) => <div key={l} className="card tile"><b>{n}</b><span className="small muted">{l}</span></div>)}
      </div>
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
