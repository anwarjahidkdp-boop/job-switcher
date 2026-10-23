import { PageHead } from '@/components/PageHead';
import Link from 'next/link';
import { isPro, requireAppState } from '@/lib/server/page';
import { trialApplyRoom } from '@/lib/pack-limits';
import { applyQueue } from '@/lib/apply-queue';
import { fitLabel } from '@/lib/matching';
import { DeadlineChip } from '@/components/ui';
import { QueueDismissButton } from '@/components/QueueDismissButton';
import { PrepareApplicationButton } from '@/components/PrepareApplicationButton';
import { fmtDate } from '@/lib/dates';
export const metadata = {title:'Apply Queue'};
export default async function Queue() {
 const {st,db}=await requireAppState('/queue');
 const items=applyQueue(st);
 const pro=await isPro(db,st.userId), room=trialApplyRoom(Object.values(st.apps));
 return <>
  <PageHead kicker="To do" title={<>Apply <span>queue</span></>} sub="Your highest eligible matches, ranked automatically. Remove any choice or choose another opportunity. Nothing is sent without your confirmation." />
  <div className="stack" style={{marginTop:20}}>
   {!pro?<div className="note small" role="status"><b>Free trial: 1 application per day · {room} remaining today</b><div>You choose which application to use. Changing country does not reset this quota.</div></div>:null}
   {items.length?<div className="card">{items.map(({job,m},i)=>{
    const a=st.apps[job.id];
    return <div key={job.id} className="opp apply-queue-item" style={{cursor:'default'}}>
     <div><h4>{i+1}. {job.title}</h4><div className="meta">{job.company} · <b>{m.score}% · {fitLabel(m.score)}</b></div><div className="meta">{a?.pack?'CV + cover letter prepared':'Selected automatically · ready to prepare'}{a?.status==='reminder'&&a.reminder_date?` · Reminder ${fmtDate(a.reminder_date)}`:''}</div></div>
     <div className="row"><DeadlineChip deadline={job.deadline} today={st.today}/>{a?.pack?<Link prefetch={false} className="btn btn-primary btn-sm" href={`/jobs/${job.id}`}>Review application</Link>:<PrepareApplicationButton jobId={job.id}/>}<Link prefetch={false} className="btn btn-ghost btn-sm" href={`/jobs/${job.id}`}>Review opportunity</Link><QueueDismissButton jobId={job.id}/></div>
    </div>;
   })}</div>:<div className="card panel"><p className="muted">No eligible Good Fit or higher matches yet (70%+). Lower matches are not added automatically.</p></div>}
   <Link prefetch={false} className="btn btn-ghost" href="/inbox">Choose another opportunity</Link>
  </div>
 </>;
}
