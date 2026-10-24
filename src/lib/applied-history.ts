import type {ApplicationRow} from './server/state';
/** Prepared packs and reminders are not submissions. Keep confirmed history after closing/withdrawal. */
export function submittedApplications(apps:Record<string,ApplicationRow>){
 return Object.values(apps).filter(a=>!!a.applied_at||['applied','interview','offer'].includes(a.status)).sort((a,b)=>b.updated_at.localeCompare(a.updated_at));
}
export function applicationMilestones(a:ApplicationRow){
 const history=a.application_events||[];
 return {interview:!!a.interview_at||a.status==='interview'||history.some(e=>e.status==='interview'),offer:a.status==='offer'||history.some(e=>e.status==='offer')};
}

/** Completed decisions must never be promoted as a fresh opportunity, even in legacy rows. */
export function isResolvedApplication(a?:Pick<ApplicationRow,'status'|'applied_at'>):boolean{
 return !!a&&(!!a.applied_at||['applied','interview','offer','closed','withdrawn'].includes(a.status));
}
