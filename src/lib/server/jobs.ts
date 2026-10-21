// Paste-a-job: the user pastes a job post they found anywhere (Bdjobs, LinkedIn, Facebook, a newspaper...).
// We never log in to job sites and never ask for passwords.
import "server-only";
import { cc, rule } from "../countries";
import { todayStr } from "../dates";
import { aiJobToJob, jobToRow, normaliseJobText } from "../jobs";
import { PASTE_PROMPT, SYSTEM_RULES } from "../prompts";
import { PastedJobSchema, type PastedJobOut } from "../ai/schemas";
import { aiConfigured, runAI } from "../ai";
import { loadProfile } from "./state";
import type { Ctx } from "./applications";

export function safeUrl(u: unknown): string | null {
  try {
    const url = new URL(String(u || "").trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch { return null; }
}

export async function pasteJob(ctx: Ctx, text: string, url: string | null): Promise<{ id: string; ai: boolean }> {
  const t = String(text || "").trim();
  if (t.length < 120) throw new Error("Paste the full job description (at least a few lines).");
  const profile = await loadProfile(ctx.db, ctx.userId);
  const country = cc(profile?.target_country);
  const today = todayStr(rule(country).timeZone);
  const link = safeUrl(url);
  let job, ai = false;
  if (aiConfigured()) {
    const res = await runAI(ctx.admin, ctx.userId, "paste_job", (p) => p.generateJSON({ tier: "fast", system: SYSTEM_RULES, prompt: PASTE_PROMPT(t, country, today), schema: PastedJobSchema }));
    job = aiJobToJob(res.data as PastedJobOut, { country, source: "Pasted by you", url: link, today });
    ai = true;
  } else {
    const lines = t.split(/\n/).map((l) => l.trim()).filter(Boolean);
    job = normaliseJobText({ title: lines[0].slice(0, 140), company: (lines[1] || "").slice(0, 140), text: t, country, url: link, source: "Pasted by you", today });
  }
  const { data, error } = await ctx.db.from("jobs").insert(jobToRow(job, { owner_id: ctx.userId, source_kind: "paste", description: t.slice(0, 20000) })).select("id").single();
  if (error) throw error;
  return { id: data.id as string, ai };
}
