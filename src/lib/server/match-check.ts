// AI check of a person's matches, run by the daily ingest (no Worker CPU limit there).
// The rule-based score finds candidates; this step reads the full job post next to the Master CV and confirms the
// job (strong), flags a missing must-have (partial) or hides it (no). Each match is checked once, within the AI budget.
import type { SupabaseClient } from "@supabase/supabase-js";
import { AIError, aiConfigured, runAI } from "../ai";
import { MatchCheckSchema, type MatchCheckOut } from "../ai/schemas";
import { rowToJob, type JobRow } from "../jobs";
import { MATCH_CHECK_PROMPT, SYSTEM_RULES } from "../prompts";
import type { MasterCV } from "../types";

// Every job the inbox can show (55+) gets checked, best first, a few at a time to stay inside the AI budget.
export const CHECK_MIN_SCORE = 55;
export const CHECK_PER_RUN = 15;

export async function checkTopMatches(admin: SupabaseClient, userId: string, limit = CHECK_PER_RUN): Promise<number> {
  if (!aiConfigured()) return 0;
  const { data: rows, error } = await admin.from("matches").select("job_id").eq("user_id", userId).eq("relevant", true)
    .gte("score", CHECK_MIN_SCORE).is("ai_checked_at", null).order("score", { ascending: false }).limit(limit);
  if (error) throw error;
  if (!rows?.length) return 0;
  const [{ data: master }, { data: prof }, { data: jobs }] = await Promise.all([
    admin.from("master_cvs").select("content").eq("user_id", userId).eq("is_current", true).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    admin.from("profiles").select("needs_visa").eq("id", userId).maybeSingle(),
    admin.from("jobs").select("*").in("id", rows.map((r) => r.job_id as string)),
  ]);
  if (!master?.content) return 0;
  let n = 0;
  for (const r of (jobs || []) as (JobRow & { description?: string | null })[]) {
    const job = rowToJob(r);
    const text = r.description || [job.title, ...job.resp, ...job.required, ...job.preferred].join("\n");
    let out: MatchCheckOut;
    try {
      const res = await runAI(admin, userId, "match_check", (p) => p.generateJSON({ tier: "fast", system: SYSTEM_RULES, prompt: MATCH_CHECK_PROMPT(master.content as MasterCV, job, text, !!prof?.needs_visa), schema: MatchCheckSchema, maxTokens: 300 }));
      out = res.data as MatchCheckOut;
    } catch (e) {
      if (e instanceof AIError) break; // out of budget or not set up: the rest stay unchecked and show as before
      throw e;
    }
    await admin.from("matches").update({ ai_fit: out.fit, ai_score: Math.max(0, Math.min(100, Math.round(Number(out.score) || 0))), ai_chance: out.chance, ai_reason: String(out.reason || "").slice(0, 300), ai_checked_at: new Date().toISOString() }).eq("user_id", userId).eq("job_id", r.id);
    n++;
  }
  return n;
}
