import { applicationSafety } from './career-safety';
import type { UserState } from './server/state';

export const AUTO_QUEUE_SIZE = 3;
export const QUEUE_MIN_SCORE = 70;
/** Open, relevant and not already submitted/removed; shared by ranking and explanations. */
function available(st: UserState) {
  return st.scored.filter(({job,m}) => {
    const a = st.apps[job.id];
    return job.country === st.country && job.active !== false && m.relevant && !m.expired && m.score > 0
      && !st.dismissed.has(job.id) && (!job.deadline || job.deadline >= st.today)
      && (!a || ['ready','reminder','waiting'].includes(a.status));
  }).sort((a,b) => b.m.score-a.m.score || a.job.id.localeCompare(b.job.id));
}
export function queueSafety(st: UserState, job: UserState['scored'][number]['job']) {
  return applicationSafety(job, st.profile.preferences, st.profile.deal_breakers, st.profile.answer_library, st.profile.needs_visa, {P:st.P!,today:st.today});
}
/** Always derived from current facts, not the score when an old pack was prepared. */
export function applyQueue(st: UserState) {
  if (!st.P) return [];
  const eligible = available(st).filter(({job}) => {
    const check=queueSafety(st,job);
    // Undisclosed pay is a verification task, not evidence of low pay. Keep it in
    // the ranked queue for review, but never prepare or send until safety passes.
    return check.safe || check.issues.filter(i=>i.blocking).every(i=>i.code==='salary_unpublished');
  });
  const preferred = eligible.filter(x => x.m.score >= QUEUE_MIN_SCORE);
  // If no Good Fit+ is eligible, select just the highest safe lower match.
  const automatic = preferred.length ? preferred.slice(0,AUTO_QUEUE_SIZE) : eligible.slice(0,1);
  // Top recommendations are automatic; eligible user selections/reminders remain available too.
  const top = new Set(automatic.map(x=>x.job.id));
  return eligible.filter(x => top.has(x.job.id) || st.apps[x.job.id]?.application_events?.some(e=>e.actor==='user'));
}

/** A fit score alone is not permission to apply. Explain why high matches are held. */
export function queueHolds(st: UserState) {
  if (!st.P) return [];
  const selected=new Set(applyQueue(st).map(x=>x.job.id));
  return available(st).filter(x=>!selected.has(x.job.id)).map(x => ({...x, issues:queueSafety(st,x.job).issues.filter(i=>i.blocking)}))
    .filter(x=>x.issues.length).slice(0,3);
}
