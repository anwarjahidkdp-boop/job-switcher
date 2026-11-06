// When does a failing job source deserve the owner's attention?
//
// Many free sources fail now and then (a site times out, blocks us for an hour, or is down for maintenance) and work
// again on the next scan. Turning the whole hourly run red for each of those hides the alerts that matter. So:
//   - a source's failure is recorded on its ingestion_sources row with the time it started failing
//     (last_error = "[since <ISO time>] <message>"), and listed in the run's summary;
//   - the run goes red only when a source that used to deliver jobs has now been failing for a whole day, once, on the
//     first scan after it crosses that mark (later failing scans stay green until it recovers and breaks again);
//   - the run also goes red when it collected nothing at all, or a core step crashed (see run.ts).

export const BROKEN_AFTER_MS = 24 * 60 * 60_000;

const SINCE = /^\[since (\d{4}-\d{2}-\d{2}T[\d:.]+Z)\] /;

export interface SourceHealth { last_status?: string | null; last_error?: string | null; last_run_at?: string | null; jobs_found?: number | null }

/** When this source's current run of failures began (now, if it was working before this run). */
export function failingSince(src: SourceHealth, now: number): number {
  if (src.last_status !== "error") return now;
  const m = SINCE.exec(src.last_error || "");
  const t = m ? Date.parse(m[1]) : NaN;
  // Rows written before this rule have no start time: the count starts now.
  return Number.isFinite(t) && t <= now ? t : now;
}

/** The last_error text to store for a failing source. */
export function failureNote(since: number, message: string): string {
  return `[since ${new Date(since).toISOString()}] ${message.replace(SINCE, "")}`.slice(0, 500);
}

/** The message without the failing-since marker (for logs). */
export const plainError = (note: string | null | undefined) => (note || "").replace(SINCE, "");

/**
 * True on the one scan where a source that used to deliver jobs first passes a day of failing.
 * `src` is the row as it was before this run; `now` is when this run's attempt failed.
 */
export function newlyBroken(src: SourceHealth, now: number): boolean {
  if (!src.jobs_found) return false; // never delivered anything (or a site that blocks us from the start): nothing was lost
  const since = failingSince(src, now);
  if (now - since < BROKEN_AFTER_MS) return false;
  const prev = src.last_run_at ? Date.parse(src.last_run_at) : NaN;
  // Alert once: the previous failing scan was still inside the day.
  return !Number.isFinite(prev) || prev - since < BROKEN_AFTER_MS;
}

/** Network hiccups worth one more try in the same run (not blocks like HTTP 403 or bad board tokens). */
export function isTransient(e: unknown): boolean {
  const msg = e instanceof Error ? `${e.name} ${e.message} ${(e as { cause?: { code?: string } }).cause?.code || ""}` : String(e);
  return /timeout|timed out|aborted|fetch failed|ECONNRESET|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|ENOTFOUND|socket hang up|HTTP 5\d\d|HTTP 429/i.test(msg);
}

/** Runs `fn`, and once more after `waitMs` if the first try hit a network hiccup. */
export async function withRetry<T>(fn: () => Promise<T>, waitMs = 5_000): Promise<T> {
  try { return await fn(); } catch (e) {
    if (!isTransient(e)) throw e;
    await new Promise((r) => setTimeout(r, waitMs));
    return fn();
  }
}
