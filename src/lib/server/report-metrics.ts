// Career report numbers (trial Day 2-5, weekly report, Insights) from the same functions Home uses: jobTotals for jobs,
// appliedFor for applications, strongFitGaps for the main gap. A report never shows a number Home would not show.
import type { SupabaseClient } from "@supabase/supabase-js";
import { currentCountryApps } from "../application-country";
import { appliedFor } from "../applied-history";
import { strongFitGaps } from "../fit-gaps";
import type { CareerMetrics, CareerReport } from "./career-reports";
import { fitCard, foundMs, jobTotals } from "./search-summary";
import { countFoundSince, loadState, type UserState } from "./state";

const OPEN = new Set(["preparing", "ready", "reminder", "waiting"]);

/** Report metrics for [start, end) from a loaded state; `checked` = jobs counted in the database for that window. */
export function metricsFromState(st: Pick<UserState, "scored" | "apps" | "country" | "today">, start: Date, end: Date, checked: number): CareerMetrics {
  const s = start.getTime(), e = end.getTime();
  const within = (iso?: string | null) => { const t = Date.parse(iso || ""); return t >= s && t < e; };
  const rows = st.scored.filter((x) => !(foundMs(x) >= e));
  const t = jobTotals(rows, start, checked);
  const here = currentCountryApps(st.apps, st.country);
  const apps = Object.values(here);
  const reached = (status: string) => apps.filter((a) => (a.application_events || []).some((ev) => ev.status === status && within(ev.created_at))).length;
  const windowRows = rows.filter((x) => foundMs(x) >= s);
  const gap = strongFitGaps(windowRows).gaps[0];
  const deadlines = new Map(st.scored.map((x) => [x.job.id, x.job]));
  const next = apps.filter((a) => OPEN.has(a.status)).map((a) => deadlines.get(a.job_id))
    .filter((j) => j && j.active !== false && j.deadline && j.deadline >= st.today).map((j) => j!.deadline!).sort()[0] ?? null;
  return {
    v: 2,
    jobs_analysed: t.found,
    relevant: t.matched,
    strong: t.ex,
    prepared: apps.filter((a) => a.pack && (within(a.created_at) || (a.application_events || []).some((ev) => ev.status === "ready" && within(ev.created_at)))).length,
    applied: appliedFor(here, "new", s).filter((a) => Date.parse(a.applied_at!) < e).length,
    interviews: reached("interview"),
    offers: reached("offer"),
    top_gap: gap ? `${gap.text.split(":")[0]} (${gap.jobs} of your ${windowRows.filter((x) => fitCard(x) === "st" || fitCard(x) === "po").length} near matches)` : null,
    next_deadline: next,
  };
}

export async function liveCareerMetrics(db: SupabaseClient, userId: string, start: Date, end: Date, now = Date.now()): Promise<CareerMetrics | null> {
  const st = await loadState(db, userId);
  if (!st) return null;
  const e = Math.min(end.getTime(), now);
  // A trial starts at signup, a moment after the account row: jobs found "at joining" belong to that first window.
  const joined = Date.parse(st.profile.created_at || "");
  const from = Number.isFinite(joined) && start.getTime() - joined < 10 * 60_000 ? new Date(Math.min(joined, start.getTime())) : start;
  const checked = Math.max(0, (await countFoundSince(db, st, from)) - (e < now ? await countFoundSince(db, st, new Date(e)) : 0));
  return metricsFromState(st, from, new Date(e), checked);
}

/** Saves a report once per (person, kind, period); a retry returns the saved one so the email and Insights agree. */
export async function saveLiveCareerReport(db: SupabaseClient, userId: string, kind: "trial" | "weekly", start: Date, end: Date): Promise<CareerReport | null> {
  const find = () => db.from("career_reports").select("id,kind,period_start,period_end,metrics").eq("user_id", userId).eq("kind", kind).eq("period_start", start.toISOString()).maybeSingle();
  const prev = await find();
  if (prev.error) throw prev.error;
  if (prev.data) return prev.data as CareerReport;
  const metrics = await liveCareerMetrics(db, userId, start, end);
  if (!metrics) return null;
  const { data, error } = await db.from("career_reports").insert({ user_id: userId, kind, period_start: start.toISOString(), period_end: end.toISOString(), metrics }).select("id,kind,period_start,period_end,metrics").maybeSingle();
  if (!error && data) return data as CareerReport;
  const again = await find();
  if (again.error) throw again.error;
  if (!again.data) throw error || new Error("career report not saved");
  return again.data as CareerReport;
}
