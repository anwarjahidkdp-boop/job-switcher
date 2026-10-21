// Persist deterministic match results (for notifications, and so page views only score the best stored matches plus new jobs).
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadState } from "./state";

export async function refreshMatches(db: SupabaseClient, userId: string): Promise<number> {
  const st = await loadState(db, userId, undefined, { allJobs: true });
  if (!st || !st.P) return 0;
  const rows = st.scored.map(({ job, m }) => ({
    user_id: userId, job_id: job.id, score: m.score, band: m.band, relevant: m.relevant, capped: m.capped,
    reason: m.reason, matched: m.matched, gaps: m.gaps, computed_at: new Date().toISOString(),
  }));
  // Jobs no longer scored (outside the person's categories, or no longer relevant under new rules) must not reach the digest.
  const keep = rows.map((r) => r.job_id);
  let stale = db.from("matches").update({ relevant: false }).eq("user_id", userId).eq("relevant", true);
  if (keep.length) stale = stale.not("job_id", "in", `(${keep.join(",")})`);
  const { error: se } = await stale;
  if (se) throw se;
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await db.from("matches").upsert(rows.slice(i, i + 500), { onConflict: "user_id,job_id" });
    if (error) throw error;
  }
  return rows.length;
}
