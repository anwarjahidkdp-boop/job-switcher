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
 return <><PageHead slim title={<>Applied</>}/><div className="applied-job-list" aria-label="Submitted applications">
  {visible.length?visible.map(({a,job})=><AppliedJobCard key={a.id} application={a} job={job!} controls={['applied','interview','offer'].includes(a.status)?<StatusSelect jobId={job!.id}/>:null}/>):<p className="card panel muted">No submitted applications yet. A job appears here after you confirm that you applied.</p>}
 </div></>;
}
