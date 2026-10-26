// "New since your last visit" on Home: a cookie holds when the previous visit and the latest visit were, as
// "previousMs.latestMs". A visit ends after 30 minutes away, so refreshing during a visit keeps the same window.
export const VISIT_COOKIE = "jp_visit";
const MIN = 60_000, DAY = 86_400_000;
export const VISIT_GAP = 30 * MIN;
/** First visit on this device: the last day. */
export const FIRST_WINDOW = DAY;
/** Away longer than this: show the last week, not everything since. */
export const MAX_WINDOW = 7 * DAY;

function parse(raw: string | undefined, now: number): { prev: number | null; last: number | null } {
  const [p, l] = String(raw || "").split(".").map(Number);
  const ok = (n: number) => Number.isFinite(n) && n > 0 && n <= now;
  return { prev: ok(p) ? p : null, last: ok(l) ? l : null };
}
const clamp = (since: number, now: number) => Math.min(now, Math.max(since, now - MAX_WINDOW));

/** Where the "new" window starts for this request. */
export function visitSince(raw: string | undefined, now: number): number {
  const { prev } = parse(raw, now);
  return clamp(prev ?? now - FIRST_WINDOW, now);
}

/** The cookie value after a Home request at `now`: a new visit moves the window start to the previous visit. */
export function nextVisit(raw: string | undefined, now: number): string {
  const { prev, last } = parse(raw, now);
  const start = last == null ? now - FIRST_WINDOW : now - last > VISIT_GAP ? last : prev ?? last;
  return `${clamp(start, now)}.${now}`;
}

/** A window start passed in a link (`since=`), kept inside the same limits. */
export function sinceParam(raw: string | undefined, now: number): number | null {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 && n <= now ? clamp(n, now) : null;
}
