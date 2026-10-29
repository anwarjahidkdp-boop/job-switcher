import { requireActiveAccess, trialAccess } from "./trial-access";
// Application lifecycle. The app never submits anything without the user's own press: "applied" (and interview/offer/withdrawn)
// is set only in the user's session, either by their confirmation or after they press Apply and Gmail accepts the email
// (see gmail.ts). A DB trigger enforces this again.
import "server-only";
import { randomUUID } from "node:crypto";
import { applicationCv } from "../application-documents";
import { assertSearchCountry } from "../application-country";
import type { SupabaseClient } from "@supabase/supabase-js";
import { daysUntil, fmtDate } from "../dates";
import { checkPack } from "../numbers-check";
import { PACK_PROMPT, SYSTEM_RULES } from "../prompts";
import { postAsks } from "../job-asks";
import { PackLetterSchema, PackTailorSchema } from "../ai/schemas";
import { aiConfigured, getBudget, runAI } from "../ai";
import { limitNotice, packAllowance, packLimits, trialApplyRoom } from "../pack-limits";
import { aiErrCopy } from "../ai/provider";
import { templatePack } from "../template-pack";
import type { AppStatus, ApplicationPack, Job } from "../types";
import { applicationSafety, canPrepareDraft, type SafetyCheck } from "../career-safety";
import { loadJob, loadState, type ApplicationRow } from "./state";

export interface Ctx { db: SupabaseClient; admin: SupabaseClient; userId: string }

async function getApp(ctx: Ctx, jobId: string) {
  const { data } = await ctx.db.from("applications").select("*").eq("user_id", ctx.userId).eq("job_id", jobId).maybeSingle();
  return data as ApplicationRow | null;
}
async function event(ctx: Ctx, applicationId: string, text: string, status?: string) {
  // Background work (the daily auto-prepare) runs with the service role and is recorded as the system's, not the user's.
  const actor = ctx.db === ctx.admin ? "system" : "user";
  const { error } = await ctx.db.from("application_events").insert({ application_id: applicationId, user_id: ctx.userId, event: text, status: status ?? null, actor });
  if (error) console.error("application event", error);
}
async function ensureApp(ctx: Ctx, jobId: string): Promise<ApplicationRow> {
  const existing = await getApp(ctx, jobId);
  if (existing) return existing;
  const { data, error } = await ctx.db.from("applications").insert({ user_id: ctx.userId, job_id: jobId, status: "preparing" }).select("*").single();
  if (error?.code === "23505") { const again = await getApp(ctx, jobId); if (again) return again; } // a second press created it first
  if (error) throw error;
  return data as ApplicationRow;
}

/** Statuses after the person sent the application: nothing the app prepares may move them back. */
export const SUBMITTED: AppStatus[] = ["applied", "interview", "offer", "closed", "withdrawn"];

/** Paid Pro with time left (a lapsed period is not Pro, whatever its status says). */
export async function hasPro(ctx: Pick<Ctx, "db" | "userId">): Promise<boolean> {
  const { data } = await ctx.db.from("subscriptions").select("plan_code, status, current_period_end").eq("user_id", ctx.userId).maybeSingle();
  return !!data && data.plan_code === "pro" && data.status === "active" && (!data.current_period_end || Date.parse(data.current_period_end) > Date.now());
}

/** The free trial's daily application is used; callers send the person to the Pro page. */
export class TrialLimit extends Error {}
export class ApplicationPreparationLimit extends Error {}
export class ApplicationSafetyError extends Error { constructor(public check: SafetyCheck) { super(check.issues.map((x) => x.message).join(" ")); } }

/** Free plan: one application a day, 5 in all. Every path to "applied" checks this (the database checks it again). */
export async function assertCanApply(ctx: Pick<Ctx, "db" | "userId">, jobId?: string) {
  const access=await trialAccess(ctx.db,ctx.userId);
  if(access.pro)return;
  // A prepared application survives trial expiry and may be submitted once.
  if(access.expired){
    if(!jobId)throw new TrialLimit("Subscribe to create new applications.");
    const {data:existing,error:existingError}=await ctx.db.from("applications").select("pack,applied_at").eq("user_id",ctx.userId).eq("job_id",jobId).maybeSingle();
    if(existingError)throw existingError;
    if(existing?.pack&&!existing.applied_at)return;
    throw new TrialLimit("Subscribe to create new applications.");
  }
  const { data: sent, error } = await ctx.db.from("applications").select("applied_at").eq("user_id", ctx.userId).not("applied_at", "is", null);
  if (error) throw error;
  if (!trialApplyRoom((sent || []) as { applied_at: string | null }[])) throw new TrialLimit(TRIAL_LIMIT_COPY);
}
const TRIAL_LIMIT_COPY = "Your free trial includes one application a day. Go Pro to apply to more jobs today.";
/** The database refused "applied" because the free limit is used (see guard_application_limits). */
export const isTrialLimitError = (e: unknown) => !!e && typeof e === "object" && String((e as { message?: string }).message || "").startsWith("Your free trial includes one application a day");

async function requireJob(ctx: Ctx, jobId: string): Promise<Job> {
  const job = await loadJob(ctx.db, jobId);
  if (!job) throw new Error("Job not found");
  const { data: profile, error } = await ctx.db.from("profiles").select("target_country").eq("id", ctx.userId).maybeSingle();
  if (error) throw error;
  if (!profile) throw new Error("Profile missing");
  assertSearchCountry(job.country, profile.target_country);
  return job;
}

/** Prepare the application pack: AI (tailoring on the fast tier, letter on the quality tier) or the deterministic template. */
/** How many more AI-tailored applications this person can have now (each pack's cover-letter call marks one). */
export async function packAllowanceFor(admin: Ctx["admin"], userId: string) {
  const [budget, { data: prof }, { data: rows }] = await Promise.all([
    getBudget(admin, userId),
    admin.from("profiles").select("home_country").eq("id", userId).maybeSingle(),
    admin.from("ai_usage").select("created_at").eq("user_id", userId).eq("feature", "pack_letter").gte("created_at", new Date(Date.now() - 31 * 86_400_000).toISOString()),
  ]);
  const plan = budget?.plan === "pro" ? "pro" : "trial";
  return { ...packAllowance((rows || []).map((r) => r.created_at as string), packLimits(plan, prof?.home_country as string | undefined)), plan };
}

export async function preparePack(ctx: Ctx, jobId: string, opts:{standardOnly?:boolean}={}): Promise<{ flags: string[]; ai: boolean; notice?: string }> {
  const st = await loadState(ctx.db, ctx.userId);
  if (!st || !st.P || !st.master) throw new Error("Finish your profile first.");
  const job = await requireJob(ctx, jobId);
  if (job.active === false) throw new Error("This listing is unavailable while its status or source is reviewed. Choose an active opportunity.");
  if (job.deadline && job.deadline < st.today) throw new Error("This vacancy has closed.");
  const safety = applicationSafety(job, st.profile.preferences, st.profile.deal_breakers, st.profile.answer_library, st.profile.needs_visa, {P:st.P!,today:st.today});
  if (!canPrepareDraft(safety)) throw new ApplicationSafetyError(safety);
  const existing = await getApp(ctx,jobId);
  if(existing?.pack)return {flags:existing.pack_flags||[],ai:!!existing.pack_ai,notice:"Already prepared. Your saved documents have not been changed."};
  await requireActiveAccess(ctx.db,ctx.userId);
  // Do not silently save an irreversible standard pack when the AI allowance is exhausted.
  // People can still use their existing CV and apply independently to any suitable vacancy.
  const currentAllowance = aiConfigured() ? await packAllowanceFor(ctx.admin, ctx.userId) : null;
  if (currentAllowance && currentAllowance.left <= 0) {
    throw new ApplicationPreparationLimit(limitNotice(currentAllowance) + " Your saved CV is available for independent applications. We recommend focusing on your strongest-fit opportunities.");
  }
  const reviewOnly = !safety.safe;
  const app = await ensureApp(ctx, jobId);
  if (SUBMITTED.includes(app.status)) throw new Error("This application is already sent.");
  if (app.pack) return {flags:app.pack_flags||[],ai:!!app.pack_ai,notice:"Already prepared. Your saved documents have not been changed."};
  const preparationToken=randomUUID();
  const {data:claimed,error:claimError}=await ctx.db.rpc("claim_application_preparation",{p_job:jobId,p_token:preparationToken});
  if(claimError)throw claimError;
  if(!claimed){
    const latest=await getApp(ctx,jobId);
    if(latest?.pack)return {flags:latest.pack_flags||[],ai:!!latest.pack_ai,notice:"Already prepared. Your saved documents have not been changed."};
    throw new Error("This application is already being prepared. Open the saved documents when it finishes.");
  }
  await event(ctx, app.id, "Preparing application");

  const master = st.master.content;
  const needVisa = st.profile.needs_visa;
  // The full post: what it asks applicants to send drives the pack and its checklist.
  const { data: jd } = await ctx.db.from("jobs").select("description").eq("id", jobId).maybeSingle();
  const description = (jd?.description as string | null) || null;
  let pack: ApplicationPack | null = null, ai = false, model: string | null = null, notice: string | undefined;
  if (opts.standardOnly) notice = "Standard draft requested. No AI allowance was used.";
  const allowance = opts.standardOnly ? null : currentAllowance;
  if (allowance?.left) {
    try {
      const tailor = await runAI(ctx.admin, ctx.userId, "pack", (p) => p.generateJSON({ tier: "fast", system: SYSTEM_RULES, prompt: PACK_PROMPT("tailor", master, job, st.P!, needVisa, st.homeCountry, { description }), schema: PackTailorSchema }));
      const td = tailor.data as { asks?: string[]; instructions?: string | null };
      const letter = await runAI(ctx.admin, ctx.userId, "pack_letter", (p) => p.generateJSON({ tier: "quality", system: SYSTEM_RULES, prompt: PACK_PROMPT("letter", master, job, st.P!, needVisa, st.homeCountry, { asks: td.asks, instructions: td.instructions }), schema: PackLetterSchema }));
      pack = { ...(tailor.data as Omit<ApplicationPack, "cover_letter" | "email_subject" | "email_body">), ...(letter.data as Pick<ApplicationPack, "cover_letter" | "email_subject" | "email_body">) };
      ai = true; model = `${tailor.usage.model} + ${letter.usage.model}`;
    } catch (e) {
      notice = aiErrCopy(e) + " Showing the template version.";
    }
  }
  if (!pack || !pack.cover_letter) { pack = templatePack(job, master, st.P, { needVisa, homeCountry: st.homeCountry }); ai = false; }
  if (!pack.asks?.length) pack.asks = postAsks(description);
  const checked = checkPack(pack, master, { job, prefs: st.profile.preferences, today: st.today });
  checked.pack.prepared_for={job_id:job.id,source_cv_id:st.master.id};
  // Persist the exact verified CV used for this first preparation. A later Master CV edit must not rewrite it.
  checked.pack.source_cv_snapshot=structuredClone(master);

  if(!ai&&!reviewOnly)checked.pack.preparation_note=notice||"Standard draft: AI tailoring is unavailable. Review before applying.";
  if (reviewOnly) checked.flags.push("Salary not published — confirm pay before applying");
  // The atomic claim temporarily sets Preparing; keep the pre-existing reminder after saving.
  const status: AppStatus = app.status === "reminder" ? "reminder" : "ready";
  const { data: saved, error: saveErr } = await ctx.db.from("applications").update({ pack: checked.pack, pack_flags: checked.flags, pack_ai: ai, pack_model: model, status,preparation_token:null,preparation_started_at:null }).eq("id", app.id).eq("preparation_token",preparationToken).not("status", "in", `(${SUBMITTED.join(",")})`).is("sending_at", null).is("pack",null).select("id").maybeSingle();
  if (saveErr) throw saveErr;
  if (!saved) return {flags:checked.flags,ai,notice:"This application was already prepared in another request. Its first saved version has been kept."};
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
  const { data: scheduled, error: scheduleError } = await ctx.db.from("applications").update({ status: "reminder", reminder_date: date }).eq("id", app.id).not("status", "in", `(${SUBMITTED.join(",")})`).is("sending_at", null).select("id").maybeSingle();
  if (scheduleError) throw scheduleError;
  if (!scheduled) throw new Error("This application is being sent or was already submitted.");
  const { error: reminderError } = await ctx.db.from("reminders").upsert({ user_id: ctx.userId, application_id: app.id, job_id: jobId, due_date: date, sent_at: null, send_error: null }, { onConflict: "application_id" });
  if (reminderError) throw reminderError;
  await event(ctx, app.id, (app.status === "reminder" ? "Reminder moved to " : "Reminder set for ") + fmtDate(date), "reminder");
  return { needsPack: !app.pack };
}

export async function markOpened(ctx: Ctx, jobId: string) {
  const st=await loadState(ctx.db,ctx.userId);
  if(!st?.P)throw new Error("Finish your profile first.");
  const job=await requireJob(ctx,jobId);
  const check=applicationSafety(job,st.profile.preferences,st.profile.deal_breakers,st.profile.answer_library,st.profile.needs_visa,{P:st.P,today:st.today});
  if(!check.safe)throw new ApplicationSafetyError(check);
  const app = await ensureApp(ctx, jobId);
  if (["applied", "interview", "offer", "closed", "withdrawn"].includes(app.status)) return;
  await ctx.db.from("applications").update({ status: "waiting" }).eq("id", app.id).not("status", "in", `(${SUBMITTED.join(",")})`).is("sending_at", null);
  await event(ctx, app.id, "Opened the application", "waiting");
}

/** The user tells us they submitted. This is the only path to "applied". */

export async function confirmApplied(ctx: Ctx, jobId: string) {
  return confirmExternalApplied(ctx, jobId);
}

/** Explicit user confirmation records history; it never sends or spends AI allowance. */
export async function confirmExternalApplied(ctx: Ctx, jobId: string) {
  const current=await getApp(ctx,jobId);
  if(!current?.pack)throw new Error("Prepare the CV and cover letter before confirming your application.");
  const { error } = await ctx.db.rpc("confirm_external_application", { p_job: jobId });
  if (error) throw error;
}

const LATER: AppStatus[] = ["offer", "closed", "withdrawn"];
export async function updateStatus(ctx: Ctx, jobId: string, status: string) {
  if(status!=="interviewed"&&!LATER.includes(status as AppStatus)) throw new Error("Unknown status");
  const app = await getApp(ctx, jobId);
  if (!app || !["applied", "interview", "offer"].includes(app.status)) throw new Error("Confirm the application first.");
  if(status==="interviewed"){
    if(app.status!=="interview"||!app.interview_at)throw new Error("Record the interview schedule before marking it completed.");
    const {data:old}=await ctx.db.from("application_events").select("id").eq("application_id",app.id).eq("event","Interview completed").limit(1).maybeSingle();
    if(!old)await event(ctx,app.id,"Interview completed","interview");
    return;
  }
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
