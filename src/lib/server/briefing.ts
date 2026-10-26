import type { SupabaseClient } from "@supabase/supabase-js";
import { appliedFor } from "@/lib/applied-history";
import { currentCountryApps } from "@/lib/application-country";
import { rule } from "@/lib/countries";
import { lastUpdate, nextUpdate } from "@/lib/scan-schedule";
import { dayStart, foundMs, jobTotals } from "./search-summary";
import { countFoundSince, type UserState } from "./state";

/** The latest market scan: jobs found within this long before the newest one. */
export const SCAN_WINDOW = 12 * 60 * 60 * 1000;

/** A new account is briefed on everything found for it for this long after joining. */
export const NEW_ACCOUNT_WINDOW = 24 * 60 * 60 * 1000;

export interface Briefing {
  /** Where the fresh-jobs window starts. */
  since: Date;
  /** "joined": the account joined within the last day (everything found for it so far); "today": since local midnight;
   *  "yesterday": nothing yet today, so since yesterday's midnight; "scan": nothing in two days, so the latest market scan. */
  kind: "joined" | "today" | "yesterday" | "scan";
  /** The time the chip shows: joining, the window start, or the latest scan. */
  shownAt: Date;
  /** The market's latest and next fresh-jobs update (scan-schedule.ts), for the chip. */
  updated: Date;
  next: Date;
  /** Jobs checked for the person in the window, counted like all time (see countFoundSince). */
  checked: number;
}

/** THE fresh-jobs window (Home's "Today's Fresh Jobs"), for Home and for every list its numbers open: today, in the person's time zone.
 *  Each market is updated three times a day at its own local times (scan-schedule.ts), so the window grows through the day.
 *  A job collected before someone joined counts as found when they joined, so a new account's first day holds it all.
 *  `visitCookie` is kept for callers; the window does not depend on visits. */
export async function briefingWindow(db: SupabaseClient, st: UserState, _visitCookie: string | undefined, now: number): Promise<Briefing> {
  const analysed = Math.max(st.analysed, st.scored.length);
  const joined = Date.parse(st.profile?.created_at || "");
  const tz = rule(st.country).timeZone;
  const updated = lastUpdate(st.country, now), next = nextUpdate(st.country, now);
  const today = dayStart(tz, new Date(now));
  const here = currentCountryApps(st.apps, st.country);
  const window = async (since: Date, kind: Briefing["kind"], shownAt = since): Promise<Briefing> =>
    ({ since, kind, shownAt, updated, next, checked: await countFoundSince(db, { ...st, analysed }, since) });
  const anything = (b: Briefing) => jobTotals(st.scored, b.since, b.checked).found > 0 || appliedFor(here, "new", b.since.getTime()).length > 0;

  if (Number.isFinite(joined) && joined >= now - NEW_ACCOUNT_WINDOW) return window(new Date(joined), "joined");
  const day = await window(today, "today");
  if (anything(day)) return day;
  // Before the first update of the day (or after a missed scan): yesterday's briefing, then the latest scan.
  const yesterday = await window(dayStart(tz, new Date(today.getTime() - 1)), "yesterday");
  if (anything(yesterday)) return yesterday;
  const lastFound = Math.max(0, ...st.scored.map(foundMs).filter((t) => Number.isFinite(t)));
  if (lastFound > 0 && lastFound < yesterday.since.getTime()) return window(new Date(lastFound - SCAN_WINDOW), "scan", new Date(lastFound));
  return day;
}
