// "Strengthen my CV" on the server: ask the results questions, then write the answers into the Master CV.
import "server-only";
import { aiConfigured, runAI } from "../ai";
import { BoostApplySchema, BoostQuestionsSchema } from "../ai/schemas";
import { cc } from "../countries";
import { applyBoost, boostOffered, boostRole, cleanBoostQuestions, isBoostQuestion } from "../cv-boost";
import { BOOST_APPLY_PROMPT, BOOST_QUESTIONS_PROMPT, SYSTEM_RULES } from "../prompts";
import type { CvQuestion, MasterCV } from "../types";
import { saveMaster, type Ctx } from "./onboarding";
import { loadProfile, type CvDocRow } from "./state";
import { trialAccess } from "./trial-access";

async function boostContext(ctx: Ctx) {
  const profile = await loadProfile(ctx.db, ctx.userId);
  if (!profile) throw new Error("Profile missing");
  const country = cc(profile.target_country);
  if (!boostOffered(country)) throw new Error("This is not available for your search country yet.");
  const [{ data: doc, error: docError }, { data: master, error: mError }] = await Promise.all([
    ctx.db.from("cv_documents").select("id, questions, answers, is_demo").eq("user_id", ctx.userId).eq("is_current", true).maybeSingle(),
    ctx.db.from("master_cvs").select("content, flags, ai, model, source_cv_document_id").eq("user_id", ctx.userId).eq("is_current", true).maybeSingle(),
  ]);
  if (docError) throw docError;
  if (mError) throw mError;
  if (!doc || !master) throw new Error("Upload your CV first.");
  if (!(await trialAccess(ctx.db, ctx.userId)).active) throw new Error("Subscribe to strengthen your CV with AI.");
  if (!aiConfigured()) throw new Error("AI writing is not available right now. Try again later.");
  return { profile, country, doc: doc as Pick<CvDocRow, "id" | "questions" | "answers" | "is_demo">, master };
}

/** The open results questions: the ones still waiting for answers, or a new round written by the AI. */
export async function askBoost(ctx: Ctx): Promise<CvQuestion[]> {
  const { country, doc, master } = await boostContext(ctx);
  const all = (doc.questions || []) as CvQuestion[];
  const answers = doc.answers || {};
  const open = all.filter((q) => isBoostQuestion(q) && !String(answers[q.id] || "").trim());
  if (open.length) return open;
  const m = master.content as MasterCV;
  const earlier = all.filter(isBoostQuestion).map((q) => q.question);
  const r = await runAI(ctx.admin, ctx.userId, "cv_boost", (p) => p.generateJSON({ tier: "fast", system: SYSTEM_RULES, prompt: BOOST_QUESTIONS_PROMPT(m, country, earlier), schema: BoostQuestionsSchema, maxTokens: 1500 }));
  const fresh = cleanBoostQuestions((r.data as { questions: { role: number; question: string; placeholder: string; suggestions: string[] }[] }).questions, m, Date.now().toString(36));
  if (!fresh.length) throw new Error("We could not find anything to ask about. Try again later.");
  const stored = fresh.map(({ id, question, placeholder, suggestions }) => ({ id, question, placeholder, suggestions }));
  const { error } = await ctx.db.from("cv_documents").update({ questions: [...all, ...stored] }).eq("id", doc.id).eq("user_id", ctx.userId);
  if (error) throw error;
  return stored;
}

/**
 * Saves the answers on the CV document first (so they are never lost and every later rebuild uses them), then writes
 * them into the Master CV. Unanswered questions are removed, so a later round can ask again.
 */
export async function applyBoostAnswers(ctx: Ctx, raw: unknown): Promise<{ changed: number; answered: number }> {
  const { profile, country, doc, master } = await boostContext(ctx);
  const input = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const all = (doc.questions || []) as CvQuestion[];
  // Any results question named in the request (a retried request finds its answers already saved and simply rewrites).
  const given = all.filter(isBoostQuestion).map((q) => ({ q, answer: String(input[q.id] ?? "").trim().slice(0, 600) })).filter((x) => x.answer && !/^(not sure|n\/?a|no|none|don'?t know|-)$/i.test(x.answer));
  if (!given.length) throw new Error("Answer at least one question, or tap Not now.");
  const answers = { ...(doc.answers || {}), ...Object.fromEntries(given.map((x) => [x.q.id, x.answer])) };
  const keep = all.filter((q) => !isBoostQuestion(q) || String(answers[q.id] || "").trim());
  const { error } = await ctx.db.from("cv_documents").update({ questions: keep, answers }).eq("id", doc.id).eq("user_id", ctx.userId);
  if (error) throw error;

  const m = master.content as MasterCV;
  const qa = given.map((x) => ({ role: boostRole(x.q.id) ?? 0, question: x.q.question, answer: x.answer }));
  const r = await runAI(ctx.admin, ctx.userId, "cv_boost", (p) => p.generateJSON({ tier: "quality", system: SYSTEM_RULES, prompt: BOOST_APPLY_PROMPT(m, country, qa), schema: BoostApplySchema, maxTokens: 3000 }));
  const out = applyBoost(m, (r.data as { roles: { role: number; bullets: string[] }[] }).roles || [], given.map((x) => x.answer).join("\n"));
  if (out.changed) await saveMaster(ctx, out.master, master.flags || [], true, r.usage.model, doc.id, profile, false);
  return { changed: out.changed, answered: given.length };
}
