// UK application writing on request: the supporting statement public-sector employers score against the person
// specification, and answers to the employer's own application-form questions. Both are written only from the CV
// used for this application and are saved inside the application's pack, so they stay with this job.
import "server-only";
import { applicationCv, packBoundToJob } from "../application-documents";
import { aiConfigured, runAI } from "../ai";
import { FormAnswerSchema, UkStatementSchema } from "../ai/schemas";
import { FORM_ANSWER_PROMPT, SYSTEM_RULES, UK_STATEMENT_PROMPT } from "../prompts";
import { cleanFormQuestion, formWordLimit, MAX_FORM_ANSWERS } from "../uk-application";
import type { ApplicationPack, FormAnswer, UkStatement } from "../types";
import { loadJob, loadState } from "./state";
import { trialAccess } from "./trial-access";
import type { Ctx } from "./applications";

async function writingContext(ctx: Ctx, jobId: string) {
  const st = await loadState(ctx.db, ctx.userId);
  const app = st?.apps[jobId];
  if (!st?.master || !app?.pack) throw new Error("Prepare your CV and cover letter for this job first.");
  if (!packBoundToJob(app.pack, jobId)) throw new Error("Prepare documents for this job first.");
  const job = await loadJob(ctx.db, jobId);
  if (!job) throw new Error("Job not found");
  const access = await trialAccess(ctx.db, ctx.userId);
  if (!access.active) throw new Error("Subscribe to write supporting statements and form answers with AI.");
  if (!aiConfigured()) throw new Error("AI writing is not available right now. Try again later.");
  return { app, job, cv: applicationCv(st.master.content, app.pack) };
}

/** Saves one field of the pack, re-reading the stored pack first so an edit made meanwhile is kept. */
async function savePack(ctx: Ctx, appId: string, patch: Partial<ApplicationPack>) {
  const { data, error } = await ctx.db.from("applications").select("pack").eq("id", appId).eq("user_id", ctx.userId).maybeSingle();
  if (error) throw error;
  if (!data?.pack) throw new Error("Prepare your CV and cover letter for this job first.");
  const { error: e } = await ctx.db.from("applications").update({ pack: { ...(data.pack as ApplicationPack), ...patch } }).eq("id", appId).eq("user_id", ctx.userId);
  if (e) throw e;
}

export async function writeUkStatement(ctx: Ctx, jobId: string): Promise<UkStatement> {
  const { app, job, cv } = await writingContext(ctx, jobId);
  const { data: d } = await ctx.db.from("jobs").select("description").eq("id", jobId).maybeSingle();
  const description = String(d?.description || "");
  // AI errors go up as they are: the API turns them into the right message and status, and the page retries cut-off calls.
  const r = await runAI(ctx.admin, ctx.userId, "uk_statement", (p) => p.generateJSON({ tier: "quality", system: SYSTEM_RULES, prompt: UK_STATEMENT_PROMPT(cv, job, description), schema: UkStatementSchema, maxTokens: 4000 }));
  const data = r.data as Omit<UkStatement, "ai" | "at">;
  if (!data.statement?.trim()) throw new Error("The statement came back empty. Try again.");
  const out: UkStatement = { statement: data.statement.trim().slice(0, 12000), criteria: (data.criteria || []).slice(0, 20), ai: true, at: new Date().toISOString() };
  await savePack(ctx, app.id, { uk_statement: out });
  return out;
}

export async function answerFormQuestion(ctx: Ctx, jobId: string, rawQuestion: unknown, rawLimit: unknown): Promise<FormAnswer> {
  const question = cleanFormQuestion(rawQuestion);
  if (!question) throw new Error("Paste the question from the application form.");
  const limit = formWordLimit(rawLimit, question);
  const { app, job, cv } = await writingContext(ctx, jobId);
  const r = await runAI(ctx.admin, ctx.userId, "form_answer", (p) => p.generateJSON({ tier: "quality", system: SYSTEM_RULES, prompt: FORM_ANSWER_PROMPT(cv, job, question, limit), schema: FormAnswerSchema, maxTokens: 1500 }));
  const answer = String((r.data as { answer: string }).answer || "").trim();
  if (!answer) throw new Error("The answer came back empty. Try again.");
  const item: FormAnswer = { question, answer: answer.slice(0, 6000), limit, at: new Date().toISOString() };
  const prev = (app.pack?.form_answers || []).filter((x) => x.question.toLowerCase() !== question.toLowerCase());
  await savePack(ctx, app.id, { form_answers: [item, ...prev].slice(0, MAX_FORM_ANSWERS) });
  return item;
}
