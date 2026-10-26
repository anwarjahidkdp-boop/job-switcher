// "New since your last visit" on Home: a cookie holds when the previous visit and the latest visit were, and whose
// visits they were, as "previousMs.latestMs.account". A visit ends after 30 minutes away, so refreshing during a visit
// keeps the same window. The cookie is per browser, so another account's visits on the same phone never count:
// a cookie from another account reads as "no visit yet". previousMs 0 = still in the first visit.
export const VISIT_COOKIE = "jp_visit";
const MIN = 60_000, DAY = 86_400_000;
export const VISIT_GAP = 30 * MIN;
/** First visit of an account that joined long ago, on this device: the last day. */
export const FIRST_WINDOW = DAY;
/** Away longer than this: show the last week, not everything since. */
export const MAX_WINDOW = 7 * DAY;

/** Short tag of the account id, so the cookie knows whose visits it holds. */
const tag = (user: string) => String(user || "").replace(/[^a-z0-9]/gi, "").slice(0, 12);

function parse(raw: string | undefined, now: number, user: string): { prev: number | null; last: number | null } {
  const [p, l, who] = String(raw || "").split(".");
  if (who !== tag(user)) return { prev: null, last: null };
  const ok = (n: number) => Number.isFinite(n) && n > 0 && n <= now;
  return { prev: ok(Number(p)) ? Number(p) : null, last: ok(Number(l)) ? Number(l) : null };
}
const clamp = (since: number, now: number) => Math.min(now, Math.max(since, now - MAX_WINDOW));

/** A new account's first visit covers everything found since it joined; an older account's covers the last day. */
const firstSince = (now: number, joined?: number) => joined != null && Number.isFinite(joined) && joined <= now && now - joined <= MAX_WINDOW ? joined : now - FIRST_WINDOW;

/** Where the "new" window starts for this request. */
export function visitSince(raw: string | undefined, now: number, user: string, joined?: number): number {
  const { prev } = parse(raw, now, user);
  return clamp(prev ?? firstSince(now, joined), now);
}

/** The cookie value after a Home request at `now`: a new visit moves the window start to the previous visit. */
export function nextVisit(raw: string | undefined, now: number, user: string): string {
  const { prev, last } = parse(raw, now, user);
  const start = last == null ? 0 : now - last > VISIT_GAP ? clamp(last, now) : prev ?? 0;
  return `${start}.${now}.${tag(user)}`;
}

/** A window start passed in a link (`since=`), kept inside the same limits. */
export function sinceParam(raw: string | undefined, now: number): number | null {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 && n <= now ? clamp(n, now) : null;
}
