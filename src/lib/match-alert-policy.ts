/** Job-match engagement without notification spam or extending paid features. */
export const MATCH_PUSH_PER_24H = 3;
export const MATCH_TRIAL_GRACE_DAYS = 7;
const DAY_MS = 86_400_000;
export interface MatchAlertSubscription {
  plan_code?: string | null;
  status?: string | null;
  trial_ends_at?: string | null;
  current_period_end?: string | null;
}
/** Trial users can still discover jobs for 7 days after the trial, but cannot prepare AI packs. */
export function eligibleForMatchAlerts(sub: MatchAlertSubscription | null | undefined, now: Date): boolean {
  if (!sub) return false;
  if (sub.plan_code === "pro" && sub.status === "active") {
    return !sub.current_period_end || Date.parse(sub.current_period_end) > now.getTime();
  }
  if (sub.plan_code !== "trial" || !sub.trial_ends_at) return false;
  const ends = Date.parse(sub.trial_ends_at);
  return Number.isFinite(ends) && now.getTime() < ends + MATCH_TRIAL_GRACE_DAYS * DAY_MS;
}
/** At most three high-fit job notifications in any rolling 24-hour window. */
export function matchPushRoom(sentInLast24h: number): number {
  return Math.max(0, MATCH_PUSH_PER_24H - Math.max(0, sentInLast24h));
}
