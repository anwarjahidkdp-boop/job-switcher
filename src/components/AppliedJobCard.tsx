import Link from 'next/link';
import type {ReactNode} from 'react';
import type {ApplicationRow} from '@/lib/server/state';
import type {Job} from '@/lib/types';
import {STATUS_LABEL} from '@/lib/types';
import {fmtDate} from '@/lib/dates';
import {rule} from '@/lib/countries';
import {applicationMilestones} from '@/lib/applied-history';
export function AppliedJobCard({application:a,job,controls}:{application:ApplicationRow;job:Job;controls?:ReactNode}){
 const stages=applicationMilestones(a);
 const statusLabel=a.status==="interview" ? (a.application_events?.some(e=>e.event==="Interview completed")?"Interviewed":"Interview scheduled") : STATUS_LABEL[a.status];
 const interviewWhen=a.interview_at?new Date(a.interview_at).toLocaleString('en-GB',{timeZone:rule(job.country).timeZone,day:'numeric',month:'short',year:'numeric',hour:'numeric',minute:'2-digit',hour12:true,timeZoneName:'short'}):null;
 return <article className="applied-job-card" data-status={a.status} data-applied-job={job.id} aria-label={`${job.title} at ${job.company}`}>
  <div className="applied-job-heading"><div><h2>{job.title}</h2><p>{job.company}{job.location?` · ${job.location}`:''}</p></div><span className="applied-status">{statusLabel}</span></div>
  {a.applied_at?<p className="small muted">Applied on {fmtDate(a.applied_at.slice(0,10))}</p>:null}
  <dl className="applied-job-stages"><div><dt>Interview</dt><dd>{interviewWhen|| (stages.interview?'Call recorded':'Not recorded yet')}</dd></div><div><dt>Job offer</dt><dd>{stages.offer?'Received':'Not recorded yet'}</dd></div></dl>
  <div className="row applied-job-actions"><Link prefetch={false} className="btn btn-primary btn-sm" href={`/jobs/${job.id}${a.status==='interview'?'#interview':'#application-progress'}`}>{a.status==='interview'?'Interview preparation':'Manage application'}</Link>{controls}</div>
 </article>;
}
