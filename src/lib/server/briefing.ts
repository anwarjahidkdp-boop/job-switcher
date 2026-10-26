import type { SupabaseClient } from "@supabase/supabase-js";
import { lastUpdate, nextUpdate } from "@/lib/scan-schedule";
import { countFoundSince, type UserState } from "./state";

/** Fresh jobs cover the 24 hours up to the market's latest update; a new account sees everything for this long after joining. */
export const FRESH_WINDOW = 24 * 60 * 60 * 1000;

export interface Briefing {
  /** Where the fresh-jobs window starts. */
  since: Date;
  /** "joined": the account joined within the last day (everything found for it so far); "day": the 24 hours up to the
   *  latest update. Older jobs leave this window and stay in Lifetime; an empty window shows when the next jobs land. */
  kind: "joined" | "day";
  /** The market's latest and next fresh-jobs update (scan-schedule.ts), for the chip. */
  updated: Date;
  next: Date;
  /** Jobs checked for the person in the window, counted like all time (see countFoundSince). */
  checked: number;
}

/** THE fresh-jobs window (Home's "Today's Fresh Jobs"), for Home and for every list its numbers open: the last 24 hours.
 *  Each market is scanned three times a day at its own local times (scan-schedule.ts). The window is anchored to the latest
 *  update, so the numbers stay put between updates and Home and its lists always agree; jobs that arrive in between
 *  (job-alert emails) still count. A job collected before someone joined counts as found when they joined.
 *  `visitCookie` is kept for callers; the window does not depend on visits. */
export async function briefingWindow(db: SupabaseClient, st: UserState, _visitCookie: string | undefined, now: number): Promise<Briefing> {
  const analysed = Math.max(st.analysed, st.scored.length);
  const joined = Date.parse(st.profile?.created_at || "");
  const updated = lastUpdate(st.country, now), next = nextUpdate(st.country, now);
  const window = async (since: Date, kind: Briefing["kind"]): Promise<Briefing> =>
    ({ since, kind, updated, next, checked: await countFoundSince(db, { ...st, analysed }, since) });

  if (Number.isFinite(joined) && joined >= now - FRESH_WINDOW) return window(new Date(joined), "joined");
  return window(new Date(updated.getTime() - FRESH_WINDOW), "day");
}
