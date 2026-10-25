import {PageHead} from '@/components/PageHead';
import {AppliedJobCard} from '@/components/AppliedJobCard';
import {requireAppState} from '@/lib/server/page';
import {loadJob} from '@/lib/server/state';
import {submittedApplications} from '@/lib/applied-history';
import {StatusSelect} from './StatusSelect';
export const metadata={title:'Applied'};
export default async function Applications(){
 const {st,db}=await requireAppState('/applications');
 const jobs=new Map(st.scored.map(x=>[x.job.id,x.job]));
 const rows=await Promise.all(submittedApplications(st.apps).map(async a=>({a,job:jobs.get(a.job_id)||await loadJob(db,a.job_id)})));
 const visible=rows.filter(r=>r.job);
 // Earlier search countries are kept as history, apart from the current country's list.
 const current=visible.filter(r=>r.job!.country===st.country), earlier=visible.filter(r=>r.job!.country!==st.country);
 const card=({a,job}:typeof visible[number])=><AppliedJobCard key={a.id} application={a} job={job!} controls={['applied','interview','offer'].includes(a.status)?<StatusSelect jobId={job!.id}/>:null}/>;
 return <><PageHead slim title={<>Applied</>}/><div className="applied-job-list" aria-label="Submitted applications">
  {current.length?current.map(card):<p className="card panel muted">No submitted applications yet. A job appears here after you confirm that you applied.</p>}
  {earlier.length?<details className="card panel"><summary>Earlier search country · {earlier.length} {earlier.length===1?'application':'applications'}</summary><div className="applied-job-list" style={{marginTop:12}}>{earlier.map(card)}</div></details>:null}
 </div></>;
}
