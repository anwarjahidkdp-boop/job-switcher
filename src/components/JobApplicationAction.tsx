import Link from 'next/link';
import type {ReactNode} from 'react';
import type {ApplicationRow} from '@/lib/server/state';
import {isResolvedApplication} from '@/lib/applied-history';
import {STATUS_LABEL} from '@/lib/types';
/** Submitted history is a tracking action, never another Apply prompt. */
export function JobApplicationAction({application:a,children}:{application?:Pick<ApplicationRow,'status'|'applied_at'> & {application_events?:{event:string}[]};children:ReactNode}){
 if(!isResolvedApplication(a))return a && ['ready','reminder','waiting'].includes(a.status) ? <Link className="btn btn-primary btn-sm queue-review-cta" prefetch={false} href="#application">✓ Prepared</Link> : <>{children}</>;
 const label=a && a.status==='interview' ? (a.application_events?.some(e=>e.event==='Interview completed')?'Interviewed':'Interview scheduled') : a&&['applied','offer','closed','withdrawn'].includes(a.status)?STATUS_LABEL[a.status]:'Applied';
 return <Link className="btn btn-sm job-submitted-status" prefetch={false} href={a?.status==='interview'?'#interview':'/applications'} aria-label={`View application status: ${label}`}>✓ {label}</Link>;
}
