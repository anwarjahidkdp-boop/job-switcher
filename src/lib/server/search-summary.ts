import type { Scored } from "@/lib/matching";

/** Jobs found for a person, split by fit band. Everything that is not relevant or scores under 55% counts as "other",
 *  so the five parts always add up to the total. */
export interface BandCounts { total: number; ex: number; st: number; po: number; lo: number; other: number }

export function bandCounts(rows: { score: number; relevant: boolean }[]): BandCounts {
  const c: BandCounts = { total: rows.length, ex: 0, st: 0, po: 0, lo: 0, other: 0 };
  for (const r of rows) {
    if (!r.relevant || r.score < 55) c.other++;
    else if (r.score >= 90) c.ex++;
    else if (r.score >= 80) c.st++;
    else if (r.score >= 70) c.po++;
    else c.lo++;
  }
  return c;
}

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

/** Counts from the same scores the page shows, so the summary and the opportunities list always agree.
 *  Today = jobs found for the person since `since`; all time = every visible job (`analysed`), banded from the scored ones. */
export function searchSummary(rows: Scored[], since: Date, analysed: number): { today: BandCounts; all: BandCounts } {
  const fit = (x: Scored) => ({ score: x.m.score, relevant: x.m.relevant && !x.m.expired });
  const t = since.getTime();
  const today = bandCounts(rows.filter((x) => foundMs(x) >= t).map(fit));
  const scored = bandCounts(rows.map(fit));
  const total = Math.max(analysed, rows.length);
  return { today, all: { ...scored, total, other: total - scored.ex - scored.st - scored.po - scored.lo } };
}

/** The four summary cards. Uses the same rules as `bandCounts`, so a card's list has exactly its count. */
export type FitCard = "ex" | "st" | "po" | "rest";
export type SummaryFilter = "found" | "matched" | FitCard;
export const SUMMARY_FILTERS: readonly SummaryFilter[] = ["found", "matched", "ex", "st", "po", "rest"];

export function fitCard(x: Scored): FitCard {
  const s = x.m.score;
  if (!x.m.relevant || x.m.expired || s < 70) return "rest";
  return s >= 90 ? "ex" : s >= 80 ? "st" : "po";
}

/** The jobs behind one summary number: `since` set = Today panel, null = All time. Highest score first. */
export function summaryRows(rows: Scored[], since: Date | null, filter: SummaryFilter): Scored[] {
  const t = since?.getTime();
  return rows
    .filter((x) => t == null || foundMs(x) >= t)
    .filter((x) => filter === "found" || (filter === "matched" ? fitCard(x) !== "rest" : fitCard(x) === filter))
    .sort((a, b) => b.m.score - a.m.score);
}
