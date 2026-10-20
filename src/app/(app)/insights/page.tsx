import { PageHead } from "@/components/PageHead";
import { requireAppState } from "@/lib/server/page";
import { skillDemand, skillImpact } from "@/lib/matching";
import { skillLabel } from "@/lib/taxonomy";
import { aiConfigured } from "@/lib/ai";
import { SkillRows } from "./SkillRows";

export const metadata = { title: "Insights" };

export default async function Insights() {
  const { st } = await requireAppState("/insights");
  const { rel, rows } = skillDemand(st.scored, st.P);
  const max = rows[0]?.n || 1;
  const missed = rel.filter((x) => x.m.score < 70);
  const rc: Record<string, number> = {};
  for (const x of missed) { const k = x.m.reason + (x.m.reasonDetail ? ` (${x.m.reasonDetail})` : ""); rc[k] = (rc[k] || 0) + 1; }
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
        {([["Relevant jobs", rel.length], ["Excellent", band("ex")], ["Strong", band("st")], ["Possible", band("po")], ["Low", band("lo")]] as [string, number][]).map(([l, n]) => <div key={l} className="card tile"><b>{n}</b><span className="small muted">{l}</span></div>)}
      </div>
      <div className="dash" style={{ marginTop: 18 }}>
        <div className="card panel"><h3>Most requested skills</h3>
          {top.length ? <SkillRows rows={top} aiReady={aiConfigured()} /> : <p className="small muted">No relevant jobs yet.</p>}
        </div>
        <div className="side"><div className="card panel"><h3>Why opportunities were missed</h3>
          <p className="small muted" style={{ marginBottom: 8 }}>{missed.length} otherwise relevant jobs scored below Strong:</p>
          {Object.entries(rc).sort((a, b) => b[1] - a[1]).map(([k, n]) => <div key={k} className="qitem"><span className="small">{k}</span><b className="num">{n}</b></div>)}
          {!missed.length ? <p className="small muted">None.</p> : null}
        </div></div>
      </div>
    </>
  );
}
