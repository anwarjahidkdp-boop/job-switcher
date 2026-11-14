import type { SupabaseClient } from "@supabase/supabase-js";
import { reedDetailsUrl, reedSnippet } from "../ingest/boards";
import { stripHtml } from "../jobs";

/**
 * The job's description for writing documents. Reed search results keep only the first lines of an advert; when that is all
 * we have, read the full advert once (one API call), save it for everyone, and use it. Any failure falls back to what is stored.
 */
export async function fullAdvert(db: SupabaseClient, admin: SupabaseClient, jobId: string, env: Record<string, string | undefined> = process.env, fetcher: typeof fetch = fetch): Promise<string | null> {
  const { data } = await db.from("jobs").select("description, source_kind, external_id").eq("id", jobId).maybeSingle();
  const stored = (data?.description as string | null) || null;
  const ext = String(data?.external_id || "");
  if (data?.source_kind !== "reed" || !ext.startsWith("reed:") || !reedSnippet(stored) || !env.REED_API_KEY) return stored;
  try {
    const res = await fetcher(reedDetailsUrl(ext.slice(5)), { headers: { authorization: "Basic " + btoa(env.REED_API_KEY + ":"), accept: "application/json" }, signal: AbortSignal.timeout(6000) });
    if (!res.ok) return stored;
    const html = ((await res.json()) as { jobDescription?: string })?.jobDescription;
    const full = html ? stripHtml(html).slice(0, 20000) : "";
    if (full.length <= (stored || "").length) return stored;
    await admin.from("jobs").update({ description: full }).eq("id", jobId);
    return full;
  } catch {
    return stored;
  }
}
