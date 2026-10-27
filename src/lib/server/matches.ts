// Persist deterministic match results (for notifications, and so page views only score the best stored matches plus new jobs).
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadState } from "./state";
import { fitCard } from "./search-summary";
import type { Scored } from "@/lib/matching";

export async function refreshMatches(db: SupabaseClient, userId: string, opts: { invalidateAi?: boolean } = {}): Promise<number> {
  if (opts.invalidateAi) {
    const { error } = await db.from("matches").update({ai_fit:null,ai_score:null,ai_reason:null,ai_checked_at:null}).eq("user_id",userId);
    if(error)throw error;
  }
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
  await reconcileMatchNotifications(db, userId, st.scored);
  return rows.length;
}

/** A "New N% match" notification always states the score the person sees on Home and in the lists. When a later reading
 *  (the AI, a CV edit) moves the job below 70% or out of the field, the notification is withdrawn: it is no longer a Top match. */
export async function reconcileMatchNotifications(db: SupabaseClient, userId: string, scored: Scored[]): Promise<void> {
  const live = new Map(scored.map((x) => [x.job.id, x]));
  const { data, error } = await db.from("notifications").select("id, title, link").eq("user_id", userId).eq("kind", "match");
  if (error) throw error;
  const drop: string[] = [];
  for (const n of (data || []) as { id: string; title: string; link: string | null }[]) {
    const x = live.get(n.link?.match(/^\/jobs\/([^/?#]+)/)?.[1] || "");
    if (!x) continue; // closed or no longer listed: the notification stays as it was
    if (fitCard(x) === "rest") { drop.push(n.id); continue; }
    const title = n.title.replace(/^New \d+% match/, `New ${x.m.score}% match`);
    if (title !== n.title) { const { error: e } = await db.from("notifications").update({ title }).eq("id", n.id); if (e) throw e; }
  }
  if (drop.length) { const { error: e } = await db.from("notifications").delete().in("id", drop); if (e) throw e; }
}

/** Career edits refresh all existing candidates without invoking an AI model. The edit itself stays saved if a refresh fails. */
export async function refreshCareerMatches(db:SupabaseClient,userId:string):Promise<boolean>{
  try{await refreshMatches(db,userId,{invalidateAi:true});return true;}
  catch(e){console.error("Career edit saved; full match refresh pending",e);return false;}
}
