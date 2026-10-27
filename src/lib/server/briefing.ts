import type { SupabaseClient } from "@supabase/supabase-js";
import { cache } from "react";
import { appliedFor } from "@/lib/applied-history";
import { currentCountryApps } from "@/lib/application-country";
import { lastUpdate, nextUpdate } from "@/lib/scan-schedule";
import { foundMs, jobTotals } from "./search-summary";
import { countFoundSince, type UserState } from "./state";

/** Fresh jobs cover the 24 hours up to the market's latest update; a new account sees everything for this long after joining. */
export const FRESH_WINDOW = 24 * 60 * 60 * 1000;

export interface Briefing {
  /** Where the fresh-jobs window starts. */
  since: Date;
  /** "joined": the account joined within the last day (everything found for it so far); "day": the 24 hours up to the
   *  latest update; "last": nothing new in that day, so the 24 hours up to the newest job ever found keep showing
   *  (a quiet market never empties the panel). Older jobs stay in Lifetime. */
  kind: "joined" | "day" | "last";
  /** When the newest job was found for the person (the "Last new job found … ago" line), or null before any. */
  lastFound: Date | null;
  /** The market's latest and next fresh-jobs update (scan-schedule.ts), for the chip. */
  updated: Date;
  next: Date;
  /** Jobs checked for the person in the window, counted like all time (see countFoundSince). */
  checked: number;
}

/** THE fresh-jobs window (Home's "Today's Fresh Jobs"), for Home and for every list its numbers open: the last 24 hours.
 *  Each market is scanned three times a day at its own local times (scan-schedule.ts). The window is anchored to the latest
 *  update, so the numbers stay put between updates and Home and its lists always agree; jobs that arrive in between
 *  (job-alert emails) still count. If nothing is new, the latest finds stay. A job collected before someone joined counts as found when they joined.
 *  `visitCookie` is kept for callers; the window does not depend on visits. */
export const briefingWindow = cache(async function briefingWindow(db: SupabaseClient, st: UserState, _visitCookie: string | undefined, now: number): Promise<Briefing> {
  const analysed = Math.max(st.analysed, st.scored.length);
  const joined = Date.parse(st.profile?.created_at || "");
  const updated = lastUpdate(st.country, now), next = nextUpdate(st.country, now);
  const newest = Math.max(0, ...st.scored.map(foundMs).filter((t) => Number.isFinite(t)));
  const lastFound = newest > 0 ? new Date(newest) : null;
  const window = async (since: Date, kind: Briefing["kind"]): Promise<Briefing> =>
    ({ since, kind, updated, next, lastFound, checked: await countFoundSince(db, { ...st, analysed }, since) });

  if (Number.isFinite(joined) && joined >= now - FRESH_WINDOW) return window(new Date(joined), "joined");
  const day = await window(new Date(updated.getTime() - FRESH_WINDOW), "day");
  const here = currentCountryApps(st.apps, st.country);
  if (jobTotals(st.scored, day.since, day.checked).found > 0 || appliedFor(here, "new", day.since.getTime()).length > 0) return day;
  // Nothing new in the last day: keep the latest finds on show rather than a row of zeros.
  return newest > 0 && newest < day.since.getTime() ? window(new Date(newest - FRESH_WINDOW), "last") : day;
});

/** "about 4 hours ago" for the "Last new job found" line. */
export function foundAgo(t: Date, now: number): string {
  const h = Math.floor((now - t.getTime()) / 3_600_000);
  if (h < 1) return "less than an hour ago";
  if (h < 48) return `about ${h} ${h === 1 ? "hour" : "hours"} ago`;
  return `${Math.floor(h / 24)} days ago`;
}
