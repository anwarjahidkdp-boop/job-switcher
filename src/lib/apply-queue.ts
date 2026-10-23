import { applicationSafety } from './career-safety';
import type { UserState } from './server/state';

export const AUTO_QUEUE_SIZE = 3;
export const QUEUE_MIN_SCORE = 70;
/** Always derived from current facts, not the score when an old pack was prepared. */
export function applyQueue(st: UserState) {
  if (!st.P) return [];
  const eligible = st.scored.filter(({job,m}) => {
    const a = st.apps[job.id];
    return job.country === st.country && job.active !== false && m.relevant && !m.expired && m.score >= QUEUE_MIN_SCORE
      && !st.dismissed.has(job.id) && (!job.deadline || job.deadline >= st.today)
      && (!a || ['ready','reminder','waiting'].includes(a.status))
      && applicationSafety(job, st.profile.preferences, st.profile.deal_breakers, st.profile.answer_library, st.profile.needs_visa, {P:st.P!,today:st.today}).safe;
  }).sort((a,b) => b.m.score-a.m.score || a.job.id.localeCompare(b.job.id));
  // Top recommendations are automatic; eligible user selections/reminders remain available too.
  const top = new Set(eligible.slice(0,AUTO_QUEUE_SIZE).map(x=>x.job.id));
  return eligible.filter(x => top.has(x.job.id) || st.apps[x.job.id]?.application_events?.some(e=>e.actor==='user'));
}
