import Link from 'next/link';
import type {Scored} from '@/lib/matching';
import {fitReasonSummary} from '@/lib/fit-reasons';
export function FitReasons({rows}:{rows:Scored[]}){
 const {total,groups}=fitReasonSummary(rows);
 return <section className="card panel fit-reasons" aria-label="Reasons for lower job matches"><h3>Why some jobs are below Good Fit</h3>
  <p className="small muted fit-reasons-intro">{total?`${total} jobs have a profile match below 70%, the Good Fit threshold. Grouped by main reason.`:'No current relevant jobs are below 70%.'}</p>
  {total?<><p className="small muted">Counts mean jobs, not scores or lost points. These are matching gaps, not missed applications or employer rejections.</p>
   <ul className="fit-reasons-list">{groups.map(g=><li key={g.key}><div className="fit-reason-heading"><h4>{g.title}</h4><span className="fit-reason-count">{g.count} {g.count===1?'job':'jobs'}</span></div><p className="small muted">{g.description}</p>
    <details><summary>View {g.examples.length===1?'example':'examples'} ({g.examples.length})</summary><ul>{g.examples.map(e=><li key={e.id}><Link prefetch={false} href={`/jobs/${e.id}`}>{e.title} · {e.company}</Link><span className="small muted">{e.score}% match</span><p className="small">{e.explanation}</p></li>)}</ul></details>
   </li>)}</ul><Link className="btn btn-ghost btn-sm" href="/profile">Review my CV and preferences</Link></>:null}
 </section>;
}
