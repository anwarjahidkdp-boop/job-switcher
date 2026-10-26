import type {ApplicationRow} from './server/state';
/** Prepared packs and reminders are not submissions. Keep confirmed history after closing/withdrawal. */
export function submittedApplications(apps:Record<string,ApplicationRow>){
 return Object.values(apps).filter(a=>!!a.applied_at||['applied','interview','offer'].includes(a.status)).sort((a,b)=>b.updated_at.localeCompare(a.updated_at));
}
export function applicationMilestones(a:ApplicationRow){
 const history=a.application_events||[];
 return {interview:!!a.interview_at||a.status==='interview'||history.some(e=>e.status==='interview'),offer:a.status==='offer'||history.some(e=>e.status==='offer')};
}

/** THE single source for every application number and the Applied list it opens (Home tiles and /applications).
 *  `apps` = one search country's applications. new/today = submitted at or after `since`. */
export type AppliedFilter='all'|'new'|'today'|'interview'|'offer';
export function appliedFor(apps:Record<string,ApplicationRow>,filter:AppliedFilter,since?:number):ApplicationRow[]{
 return submittedApplications(apps).filter(a=>filter==='all'?true:filter==='new'||filter==='today'?!!a.applied_at&&since!=null&&Date.parse(a.applied_at)>=since:applicationMilestones(a)[filter]);
}

/** Completed decisions must never be promoted as a fresh opportunity, even in legacy rows. */
export function isResolvedApplication(a?:Pick<ApplicationRow,'status'|'applied_at'>):boolean{
 return !!a&&(!!a.applied_at||['applied','interview','offer','closed','withdrawn'].includes(a.status));
}
