// Interview tracking (the user records an interview call) and AI interview preparation from the job and the verified Master CV.
import "server-only";
import { aiConfigured, runAI } from "../ai";
import { aiErrCopy } from "../ai/provider";
import { InterviewPrepSchema } from "../ai/schemas";
import { INTERVIEW_PROMPT, SYSTEM_RULES } from "../prompts";
import { templateInterview } from "../interview/template";
import { fmtDate } from "../dates";
import type { InterviewPrep } from "../types";
import { loadJob, loadState } from "./state";
import type { Ctx } from "./applications";

const MODES = { in_person: "In person", phone: "Phone", video: "Video call" } as const;
export type InterviewMode = keyof typeof MODES;

export interface InterviewInput { date: string; time: string | null; mode: InterviewMode; where: string | null; notes: string | null; tzOffsetMin: number }

export async function saveInterview(ctx: Ctx, jobId: string, inp: InterviewInput) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(inp.date)) throw new Error("Choose the interview date.");
  if (inp.time && !/^\d{2}:\d{2}$/.test(inp.time)) throw new Error("Choose a valid time.");
  if (!(inp.mode in MODES)) throw new Error("Choose how the interview happens.");
  const { data: app } = await ctx.db.from("applications").select("id, status").eq("user_id", ctx.userId).eq("job_id", jobId).maybeSingle();
  if (!app || !["applied", "interview", "offer"].includes(app.status)) throw new Error("Confirm that you applied first.");
  // The user's local wall-clock time, converted with the offset their browser reported.
  const local = Date.parse(`${inp.date}T${inp.time || "09:00"}:00Z`);
  const at = new Date(local + (Number(inp.tzOffsetMin) || 0) * 60000).toISOString();
  const status = app.status === "offer" ? "offer" : "interview";
  const { error } = await ctx.db.from("applications").update({
    status, interview_at: at, interview_mode: inp.mode,
    interview_where: inp.where?.slice(0, 300) || null, interview_notes: inp.notes?.slice(0, 2000) || null,
  }).eq("id", app.id);
  if (error) throw error;
  await ctx.db.from("application_events").insert({ application_id: app.id, user_id: ctx.userId, event: `Interview call: ${fmtDate(inp.date)}${inp.time ? " " + inp.time : ""} (${MODES[inp.mode]})`, status, actor: "user" });
}

export async function prepareInterview(ctx: Ctx, jobId: string): Promise<{ ai: boolean; notice?: string }> {
  const st = await loadState(ctx.db, ctx.userId);
  const app = st?.apps[jobId];
  if (!st?.master || !app) throw new Error("Apply for this job first.");
  const job = await loadJob(ctx.db, jobId);
  if (!job) throw new Error("Job not found");
  let prep: InterviewPrep | null = null, ai = false, notice: string | undefined;
  if (aiConfigured()) {
    try {
      const r = await runAI(ctx.admin, ctx.userId, "interview", (p) => p.generateJSON({ tier: "quality", system: SYSTEM_RULES, prompt: INTERVIEW_PROMPT(st.master!.content, job, app.interview_mode ?? null), schema: InterviewPrepSchema }));
      prep = r.data as InterviewPrep;
      ai = prep.questions.length > 0;
    } catch (e) {
      notice = aiErrCopy(e) + " Showing the standard preparation.";
    }
  }
  if (!ai) prep = templateInterview(job, st.master.content);
  const { error } = await ctx.db.from("applications").update({ interview_prep: prep, interview_prep_ai: ai }).eq("id", app.id);
  if (error) throw error;
  // The person asked for it, so the event is theirs (users may only append user events).
  const { error: ee } = await ctx.db.from("application_events").insert({ application_id: app.id, user_id: ctx.userId, event: "Interview preparation ready", status: null, actor: "user" });
  if (ee) console.error("interview event", ee);
  return { ai, notice };
}
