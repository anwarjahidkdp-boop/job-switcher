import type { SupabaseClient } from "@supabase/supabase-js";
import { appliedFor } from "@/lib/applied-history";
import { currentCountryApps } from "@/lib/application-country";
import { visitSince } from "@/lib/visit";
import { foundMs, jobTotals } from "./search-summary";
import { countFoundSince, type UserState } from "./state";

/** The latest market scan: jobs found within this long before the newest one (the scan runs once a day). */
export const SCAN_WINDOW = 12 * 60 * 60 * 1000;

export interface Briefing {
  /** Where the Opportunity Briefing window starts. */
  since: Date;
  /** "joined": a new account's first briefing (everything since joining); "visit": new since the last visit;
   *  "scan": nothing new since the last visit, so the latest market scan instead. */
  kind: "joined" | "visit" | "scan";
  /** The time the chip shows: joining, the window start, or the latest scan. */
  shownAt: Date;
  /** Jobs checked for the person in the window, counted like all time (see countFoundSince). */
  checked: number;
}

/** THE Opportunity Briefing window, for Home and for every list a Briefing number opens. */
export async function briefingWindow(db: SupabaseClient, st: UserState, visitCookie: string | undefined, now: number): Promise<Briefing> {
  const analysed = Math.max(st.analysed, st.scored.length);
  const joined = Date.parse(st.profile?.created_at || "");
  const visit = new Date(visitSince(visitCookie, now, st.userId, joined));
  const lastFound = Math.max(0, ...st.scored.map(foundMs).filter((t) => Number.isFinite(t)));
  const sent = appliedFor(currentCountryApps(st.apps, st.country), "new", visit.getTime()).length;
  const visitChecked = await countFoundSince(db, { ...st, analysed }, visit);
  // Nothing found and nothing sent since that visit (jobs arrive once a day): brief the latest market scan.
  if (!sent && !jobTotals(st.scored, visit, visitChecked).found && lastFound > 0 && lastFound < visit.getTime()) {
    const since = new Date(lastFound - SCAN_WINDOW);
    return { since, kind: "scan", shownAt: new Date(lastFound), checked: await countFoundSince(db, { ...st, analysed }, since) };
  }
  const kind = Number.isFinite(joined) && visit.getTime() <= joined ? "joined" : "visit";
  return { since: visit, kind, shownAt: visit, checked: visitChecked };
}
