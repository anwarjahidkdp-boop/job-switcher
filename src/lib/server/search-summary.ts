import type { SupabaseClient } from "@supabase/supabase-js";

/** Jobs checked for a person, split by fit band. Everything that is not relevant or scores under 55% counts as "other",
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

/** Today's new jobs come back as rows (a few dozen); all-time totals are counted in the database, so the Worker does no scoring. */
export async function searchSummary(db: SupabaseClient, userId: string, country: string, since: Date): Promise<{ today: BandCounts; all: BandCounts } | null> {
  const count = () => db.from("matches").select("job_id,jobs!inner(country)", { count: "exact", head: true }).eq("user_id", userId).eq("jobs.country", country);
  const rel = () => count().eq("relevant", true);
  const [today, total, ex, st, po, lo] = await Promise.all([
    db.from("matches").select("score,relevant,jobs!inner(country,created_at)").eq("user_id", userId).eq("jobs.country", country).gte("jobs.created_at", since.toISOString()).limit(2000),
    count(), rel().gte("score", 90), rel().gte("score", 80).lt("score", 90), rel().gte("score", 70).lt("score", 80), rel().gte("score", 55).lt("score", 70),
  ]);
  if ([today, total, ex, st, po, lo].some((r) => r.error)) return null;
  const n = (r: { count: number | null }) => r.count || 0;
  const banded = n(ex) + n(st) + n(po) + n(lo);
  return {
    today: bandCounts((today.data || []) as { score: number; relevant: boolean }[]),
    all: { total: n(total), ex: n(ex), st: n(st), po: n(po), lo: n(lo), other: Math.max(0, n(total) - banded) },
  };
}
