import { PageHead } from '@/components/PageHead';
import Link from 'next/link';
import { isPro, requireAppState } from '@/lib/server/page';
import { trialApplyRoom } from '@/lib/pack-limits';
import { applyQueue, queueHolds, queueSafety } from '@/lib/apply-queue';
import { fitLabel } from '@/lib/matching';
import { DeadlineChip } from '@/components/ui';
import { QueueDismissButton } from '@/components/QueueDismissButton';
import { PrepareApplicationButton } from '@/components/PrepareApplicationButton';
import { fmtDate } from '@/lib/dates';
export const metadata = {title:'Apply Queue'};
export default async function Queue() {
 const {st,db}=await requireAppState('/queue');
 const items=applyQueue(st);
 const holds=queueHolds(st);
 const pro=await isPro(db,st.userId), room=trialApplyRoom(Object.values(st.apps));
 return <>
  <PageHead kicker="To do" title={<>Apply <span>queue</span></>} sub="Your highest matches, ranked automatically. Any required checks are shown before preparation. Remove any choice or choose another opportunity. Nothing is sent without your confirmation." />
  <div className="stack" style={{marginTop:20}}>
   {!pro?<div className="note small" role="status"><b>Free trial: 1 application per day · {room} remaining today</b><div>You choose which application to use. Changing country does not reset this quota.</div></div>:null}
   {items.length?<div className="card">{items.map(({job,m},i)=>{
    const a=st.apps[job.id];
    const check=queueSafety(st,job);
    return <div key={job.id} className="opp apply-queue-item" style={{cursor:'default'}}>
     <div><h4>{i+1}. {job.title}</h4><div className="meta">{job.company} · <b>{m.score}% · {fitLabel(m.score)}</b></div><div className="meta">{!check.safe?'Selected automatically · salary verification needed':a?.pack?'CV + cover letter prepared':'Selected automatically · ready to prepare'}{a?.status==='reminder'&&a.reminder_date?` · Reminder ${fmtDate(a.reminder_date)}`:''}</div>{!check.safe?<p className="small" role="status">Salary is not published. Check the original post or confirm pay with the employer. Preparation is paused until salary suitability is verified.</p>:null}</div>
     <div className="row"><DeadlineChip deadline={job.deadline} today={st.today}/>{check.safe?(a?.pack?<Link prefetch={false} className="btn btn-primary btn-sm" href={`/jobs/${job.id}`}>Review &amp; apply</Link>:<PrepareApplicationButton jobId={job.id}/>):null}{!check.safe||!a?.pack?<Link prefetch={false} className="btn btn-ghost btn-sm" href={`/jobs/${job.id}`}>Review &amp; apply</Link>:null}<QueueDismissButton jobId={job.id}/></div>
    </div>;
   })}</div>:<div className="card panel"><p className="muted">No eligible matches are available to prepare yet. A fit score alone does not confirm application eligibility.</p></div>}
   {items.some(x=>x.m.score<70)?<p className="small muted" role="status">No eligible Good Fit or higher match is available. Your highest eligible lower match is selected for review; its fit score is unchanged.</p>:null}
   {holds.length?<div className="card panel"><h3>Why other matches are not in your queue</h3><p className="small muted">These opportunities need eligibility checks before preparation.</p>{holds.map(({job,m,issues})=><div key={job.id} className="queue-held-item"><div><h4>{job.title} · {m.score}%</h4>{issues.map(issue=><p className="small muted" key={issue.code}>{issue.message}</p>)}<Link prefetch={false} className="btn btn-text btn-sm" href={`/jobs/${job.id}`}>Review requirements →</Link></div></div>)}<Link prefetch={false} className="btn btn-ghost btn-sm" href="/profile">Review my details</Link></div>:null}
   <Link prefetch={false} className="btn btn-ghost" href="/inbox">Choose another opportunity</Link>
  </div>
 </>;
}
