import type { Scored } from "@/lib/matching";

/** The instant local midnight began in `timeZone` (ignores a DST change at midnight itself). */
export function dayStart(timeZone: string, now: Date = new Date()): Date {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone, hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(now).map((x) => [x.type, x.value]));
  const secs = (Number(p.hour) % 24) * 3600 + Number(p.minute) * 60 + Number(p.second);
  return new Date(now.getTime() - secs * 1000 - now.getMilliseconds());
}

/** When a job was found for a person who joined at `joinedAt`: when it was added, or when they joined if that is later. */
export function foundAtFor(addedAt: string | null | undefined, joinedAt: string | null | undefined): string | null {
  const a = Date.parse(addedAt || ""), j = Date.parse(joinedAt || "");
  if (!Number.isFinite(j)) return addedAt ?? null;
  return Number.isFinite(a) && a >= j ? addedAt! : joinedAt!;
}

/** When a job was found for this person (see Job.foundAt); NaN when unknown. */
export const foundMs = (x: Scored) => Date.parse(x.job.foundAt ?? x.job.addedAt ?? "");

/** The four fit cards: Strong (90%+), Best (80-89%), Good (70-79%), and everything else (under 70%, outside the field, expired). */
export type FitCard = "ex" | "st" | "po" | "rest";
export type SummaryFilter = "found" | "matched" | FitCard;
export const SUMMARY_FILTERS: readonly SummaryFilter[] = ["found", "matched", "ex", "st", "po", "rest"];

export function fitCard(x: Scored): FitCard {
  const s = x.m.score;
  if (!x.m.relevant || x.m.expired || s < 70) return "rest";
  return s >= 90 ? "ex" : s >= 80 ? "st" : "po";
}

/** THE single source for every job number in the app (Home panels, fit cards, the lists they open).
 *  `rows` = the person's scored jobs loaded on the page; `checked` = every job checked for them in that window, counted
 *  in the database (see countFoundSince), which can be more than the loaded rows. Jobs not loaded are outside the
 *  person's target roles, so they belong to "Stretch & others". A number and the list it opens come from here, so the
 *  list always has exactly that many jobs (the loaded ones plus an "also checked" line for the rest). */
export type JobTotals = Record<SummaryFilter, number>;
export function jobTotals(rows: Scored[], since: Date | null, checked: number): JobTotals {
  const t = since?.getTime();
  const c = { ex: 0, st: 0, po: 0, rest: 0 };
  let loaded = 0;
  for (const x of rows) {
    if (t != null && !(foundMs(x) >= t)) continue;
    loaded++;
    c[fitCard(x)]++;
  }
  const found = Math.max(checked, loaded);
  return { found, matched: c.ex + c.st + c.po, ex: c.ex, st: c.st, po: c.po, rest: found - c.ex - c.st - c.po };
}

/** The list behind one number: the loaded jobs (highest score first) and how many more were checked but not loaded. */
export function jobsBehind(rows: Scored[], since: Date | null, filter: SummaryFilter, checked: number): { rows: Scored[]; count: number; unlisted: number } {
  const list = summaryRows(rows, since, filter);
  const count = jobTotals(rows, since, checked)[filter];
  return { rows: list, count, unlisted: Math.max(0, count - list.length) };
}

/** The loaded jobs behind one summary number: `since` set = a window, null = all time. Highest score first. */
export function summaryRows(rows: Scored[], since: Date | null, filter: SummaryFilter): Scored[] {
  const t = since?.getTime();
  return rows
    .filter((x) => t == null || foundMs(x) >= t)
    .filter((x) => filter === "found" || (filter === "matched" ? fitCard(x) !== "rest" : fitCard(x) === filter))
    .sort((a, b) => b.m.score - a.m.score);
}
