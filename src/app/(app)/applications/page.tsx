import Link from 'next/link';
import {PageHead} from '@/components/PageHead';
import {AppliedJobCard} from '@/components/AppliedJobCard';
import {requireAppState} from '@/lib/server/page';
import {loadJob} from '@/lib/server/state';
import {submittedApplications,applicationMilestones} from '@/lib/applied-history';
import {rule} from '@/lib/countries';
import {nowMs} from '@/lib/today';
import {dayStart} from '@/lib/server/search-summary';
import {StatusSelect} from './StatusSelect';
export const metadata={title:'Applied'};
const FILTER={today:'Applied today',interview:'Interviewed',offer:'Job offers'} as const;
export default async function Applications({searchParams}:{searchParams:Promise<{when?:string;status?:string}>}){
 const {st,db}=await requireAppState('/applications');
 const sp=await searchParams;
 // Home links here with a filter: applied today, or the jobs that reached an interview or an offer.
 const filter=sp.when==='today'?'today':sp.status==='interview'||sp.status==='offer'?sp.status:null;
 const since=dayStart(rule(st.country).timeZone,new Date(nowMs())).getTime();
 const jobs=new Map(st.scored.map(x=>[x.job.id,x.job]));
 const rows=await Promise.all(submittedApplications(st.apps).map(async a=>({a,job:jobs.get(a.job_id)||await loadJob(db,a.job_id)})));
 const visible=rows.filter(r=>r.job);
 // Earlier search countries are kept as history, apart from the current country's list.
 const keep=(r:typeof visible[number])=>filter==='today'?!!r.a.applied_at&&Date.parse(r.a.applied_at)>=since:filter?applicationMilestones(r.a)[filter]:true;
 const current=visible.filter(r=>r.job!.country===st.country&&keep(r)), earlier=filter?[]:visible.filter(r=>r.job!.country!==st.country);
 const card=({a,job}:typeof visible[number])=><AppliedJobCard key={a.id} application={a} job={job!} controls={['applied','interview','offer'].includes(a.status)?<StatusSelect jobId={job!.id}/>:null}/>;
 return <><PageHead slim title={<>{filter?FILTER[filter]:'Applied'}</>}/><div className="applied-job-list" aria-label="Submitted applications">
  {filter?<p className="card panel small" style={{display:'flex',justifyContent:'space-between',gap:10,flexWrap:'wrap'}}><span>{current.length} {current.length===1?'application':'applications'}</span><Link prefetch={false} href="/applications">Show all applied →</Link></p>:null}
  {current.length?current.map(card):<p className="card panel muted">{filter?'Nothing here yet.':'No submitted applications yet. A job appears here after you confirm that you applied.'}</p>}
  {earlier.length?<details className="card panel"><summary>Earlier search country · {earlier.length} {earlier.length===1?'application':'applications'}</summary><div className="applied-job-list" style={{marginTop:12}}>{earlier.map(card)}</div></details>:null}
 </div></>;
}
