import Link from 'next/link';
import type {ReactNode} from 'react';
import type {ApplicationRow} from '@/lib/server/state';
import {isResolvedApplication} from '@/lib/applied-history';
import {STATUS_LABEL} from '@/lib/types';
/** Submitted history is a tracking action, never another Apply prompt. */
export function JobApplicationAction({application:a,children}:{application?:Pick<ApplicationRow,'status'|'applied_at'>;children:ReactNode}){
 if(!isResolvedApplication(a))return <>{children}</>;
 const label=a&&['applied','interview','offer','closed','withdrawn'].includes(a.status)?STATUS_LABEL[a.status]:'Applied';
 return <Link className="btn btn-sm job-submitted-status" prefetch={false} href="/applications" aria-label={`View application status: ${label}`}>✓ {label}</Link>;
}
