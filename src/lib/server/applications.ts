// Application lifecycle. The app never submits anything without the user's own press: "applied" (and interview/offer/withdrawn)
// is set only in the user's session, either by their confirmation or after they press Apply and Gmail accepts the email
// (see gmail.ts). A DB trigger enforces this again.
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { daysUntil, fmtDate } from "../dates";
import { checkPack } from "../numbers-check";
import { PACK_PROMPT, SYSTEM_RULES } from "../prompts";
import { PackLetterSchema, PackTailorSchema } from "../ai/schemas";
import { aiConfigured, runAI } from "../ai";
import { aiErrCopy } from "../ai/provider";
import { templatePack } from "../template-pack";
import type { AppStatus, ApplicationPack, Job } from "../types";
import { loadJob, loadState, type ApplicationRow } from "./state";

export interface Ctx { db: SupabaseClient; admin: SupabaseClient; userId: string }

async function getApp(ctx: Ctx, jobId: string) {
  const { data } = await ctx.db.from("applications").select("*").eq("user_id", ctx.userId).eq("job_id", jobId).maybeSingle();
  return data as ApplicationRow | null;
}
async function event(ctx: Ctx, applicationId: string, text: string, status?: string) {
  await ctx.db.from("application_events").insert({ application_id: applicationId, user_id: ctx.userId, event: text, status: status ?? null, actor: "user" });
}
async function ensureApp(ctx: Ctx, jobId: string): Promise<ApplicationRow> {
  const existing = await getApp(ctx, jobId);
  if (existing) return existing;
  const { data, error } = await ctx.db.from("applications").insert({ user_id: ctx.userId, job_id: jobId, status: "preparing" }).select("*").single();
  if (error) throw error;
  return data as ApplicationRow;
}

async function requireJob(ctx: Ctx, jobId: string): Promise<Job> {
  const job = await loadJob(ctx.db, jobId);
  if (!job) throw new Error("Job not found");
  return job;
}

/** Prepare the application pack: AI (tailoring on the fast tier, letter on the quality tier) or the deterministic template. */
export async function preparePack(ctx: Ctx, jobId: string): Promise<{ flags: string[]; ai: boolean; notice?: string }> {
  const st = await loadState(ctx.db, ctx.userId);
  if (!st || !st.P || !st.master) throw new Error("Finish your profile first.");
  const job = await requireJob(ctx, jobId);
  const app = await ensureApp(ctx, jobId);
  await event(ctx, app.id, "Preparing application");
  if (app.status !== "reminder") await ctx.db.from("applications").update({ status: "preparing" }).eq("id", app.id);

  const master = st.master.content;
  const needVisa = st.profile.needs_visa;
  let pack: ApplicationPack | null = null, ai = false, model: string | null = null, notice: string | undefined;
  if (aiConfigured()) {
    try {
      const tailor = await runAI(ctx.admin, ctx.userId, "pack", (p) => p.generateJSON({ tier: "fast", system: SYSTEM_RULES, prompt: PACK_PROMPT("tailor", master, job, st.P!, needVisa, st.homeCountry), schema: PackTailorSchema }));
      const letter = await runAI(ctx.admin, ctx.userId, "pack", (p) => p.generateJSON({ tier: "quality", system: SYSTEM_RULES, prompt: PACK_PROMPT("letter", master, job, st.P!, needVisa, st.homeCountry), schema: PackLetterSchema }));
      pack = { ...(tailor.data as Omit<ApplicationPack, "cover_letter" | "email_subject" | "email_body">), ...(letter.data as Pick<ApplicationPack, "cover_letter" | "email_subject" | "email_body">) };
      ai = true; model = `${tailor.usage.model} + ${letter.usage.model}`;
    } catch (e) {
      notice = aiErrCopy(e) + " Showing the template version.";
    }
  }
  if (!pack || !pack.cover_letter) { pack = templatePack(job, master, st.P, { needVisa, homeCountry: st.homeCountry }); ai = false; }
  const checked = checkPack(pack, master, { job, prefs: st.profile.preferences, today: st.today });
  const fresh = await getApp(ctx, jobId);
  const status: AppStatus = fresh?.status === "reminder" ? "reminder" : "ready";
  await ctx.db.from("applications").update({ pack: checked.pack, pack_flags: checked.flags, pack_ai: ai, pack_model: model, status }).eq("id", app.id);
  await event(ctx, app.id, "Application ready", status);
  return { flags: checked.flags, ai, notice };
}

export async function setReminder(ctx: Ctx, jobId: string, date: string, today: string): Promise<{ needsPack: boolean }> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Choose a date.");
  const job = await requireJob(ctx, jobId);
  if ((daysUntil(date, today) ?? 0) < 0) throw new Error("Choose today or a later date.");
  if (job.deadline && date > job.deadline) throw new Error(`This is after the deadline of ${fmtDate(job.deadline)}. Choose an earlier date.`);
  const app = await ensureApp(ctx, jobId);
  if (["applied", "interview", "offer", "closed", "withdrawn"].includes(app.status)) throw new Error("This application is already submitted.");
  await ctx.db.from("applications").update({ status: "reminder", reminder_date: date }).eq("id", app.id);
  await ctx.db.from("reminders").upsert({ user_id: ctx.userId, application_id: app.id, job_id: jobId, due_date: date, sent_at: null, send_error: null }, { onConflict: "application_id" });
  await event(ctx, app.id, (app.status === "reminder" ? "Reminder moved to " : "Reminder set for ") + fmtDate(date), "reminder");
  return { needsPack: !app.pack };
}

export async function markOpened(ctx: Ctx, jobId: string) {
  const app = await ensureApp(ctx, jobId);
  if (["applied", "interview", "offer", "closed", "withdrawn"].includes(app.status)) return;
  await ctx.db.from("applications").update({ status: "waiting" }).eq("id", app.id);
  await event(ctx, app.id, "Opened the application", "waiting");
}

/** The user tells us they submitted. This is the only path to "applied". */
export async function confirmApplied(ctx: Ctx, jobId: string) {
  const app = await ensureApp(ctx, jobId);
  const { error } = await ctx.db.from("applications").update({ status: "applied" }).eq("id", app.id);
  if (error) throw error;
  await ctx.db.from("reminders").delete().eq("application_id", app.id).is("sent_at", null);
  await event(ctx, app.id, "You confirmed: applied", "applied");
}

const LATER: AppStatus[] = ["interview", "offer", "closed", "withdrawn"];
export async function updateStatus(ctx: Ctx, jobId: string, status: string) {
  if (!LATER.includes(status as AppStatus)) throw new Error("Unknown status");
  const app = await getApp(ctx, jobId);
  if (!app || !["applied", "interview", "offer"].includes(app.status)) throw new Error("Confirm the application first.");
  const { error } = await ctx.db.from("applications").update({ status }).eq("id", app.id);
  if (error) throw error;
  const labels: Record<string, string> = { interview: "Interview", offer: "Offer", closed: "Rejected / Closed", withdrawn: "Withdrawn" };
  await event(ctx, app.id, "Status: " + labels[status], status);
}

export async function dismissJob(ctx: Ctx, jobId: string) {
  const { data } = await ctx.db.from("profiles").select("dismissed_job_ids").eq("id", ctx.userId).single();
  const ids = new Set<string>((data?.dismissed_job_ids as string[]) || []);
  ids.add(jobId);
  await ctx.db.from("profiles").update({ dismissed_job_ids: [...ids].slice(-2000) }).eq("id", ctx.userId);
}
