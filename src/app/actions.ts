"use server";
// Small user mutations as server actions. Each runs as the signed-in user (RLS applies).
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ctx } from "@/lib/server/page";
import { addUserSkill, reviewFact, saveAnswers, setCountry } from "@/lib/server/onboarding";
import { confirmApplied, dismissJob, markOpened, setReminder, updateStatus } from "@/lib/server/applications";
import { refreshMatches } from "@/lib/server/matches";
import { isAccent, isTemplate, rule, cc } from "@/lib/countries";
import { todayStr } from "@/lib/dates";
import { loadProfile } from "@/lib/server/state";

const SETUP_KEYS = ["address", "alerts", "forward", "filter", "test"];

export async function setCountryAction(country: string, needsVisa: boolean) {
  const c = await ctx("/onboarding");
  await setCountry(c, country, needsVisa);
  revalidatePath("/", "layout");
}

export async function setHomeCountryAction(country: string) {
  const c = await ctx();
  await c.db.from("profiles").update({ home_country: cc(country) }).eq("id", c.userId);
  await refreshMatches(c.db, c.userId).catch(() => 0);
  revalidatePath("/", "layout");
}

export async function setNeedsVisaAction(needsVisa: boolean) {
  const c = await ctx();
  await c.db.from("profiles").update({ needs_visa: needsVisa }).eq("id", c.userId);
  await refreshMatches(c.db, c.userId).catch(() => 0);
  revalidatePath("/", "layout");
}

export async function saveAnswersAction(formData: FormData) {
  const c = await ctx("/onboarding");
  const answers: Record<string, string> = {};
  for (const [k, v] of formData.entries()) if (k.startsWith("a_")) answers[k.slice(2)] = String(v);
  await saveAnswers(c, answers);
  revalidatePath("/onboarding");
}

export async function backToStepAction(step: "country" | "upload" | "prefs") {
  const c = await ctx("/onboarding");
  await c.db.from("profiles").update({ onboarding_step: step }).eq("id", c.userId);
  redirect("/onboarding");
}

export async function finishOnboardingAction(target?: unknown) {
  const c = await ctx("/onboarding");
  await c.db.from("profiles").update({ onboarding_step: "done" }).eq("id", c.userId);
  redirect(target === "/setup" ? "/setup" : "/inbox");
}

export async function setCvStyleAction(patch: { tpl?: string; accent?: string }) {
  const c = await ctx();
  const p = await loadProfile(c.db, c.userId);
  const next = { ...(p?.cv_style || {}) } as Record<string, string>;
  if (isTemplate(patch.tpl)) next.tpl = patch.tpl;
  if (isAccent(patch.accent)) next.accent = patch.accent;
  await c.db.from("profiles").update({ cv_style: next }).eq("id", c.userId);
}

export async function removePhotoAction() {
  const c = await ctx();
  const p = await loadProfile(c.db, c.userId);
  if (p?.photo_path) await c.db.storage.from("cv-files").remove([p.photo_path]);
  await c.db.from("profiles").update({ photo_path: null }).eq("id", c.userId);
}

export async function addSkillAction(skill: string) {
  const c = await ctx();
  await addUserSkill(c, skill);
  revalidatePath("/", "layout");
}

export async function reviewFactAction(factId: string, keep: boolean) {
  const c = await ctx();
  await reviewFact(c, factId, keep);
  revalidatePath("/profile");
}

export async function toggleSetupStepAction(key: string) {
  if (!SETUP_KEYS.includes(key)) return;
  const c = await ctx("/setup");
  const p = await loadProfile(c.db, c.userId);
  const steps = { ...(p?.setup_steps || {}) };
  steps[key] = !steps[key];
  await c.db.from("profiles").update({ setup_steps: steps }).eq("id", c.userId);
  revalidatePath("/setup");
}

export async function dismissAction(jobId: string) {
  const c = await ctx();
  await dismissJob(c, jobId);
  revalidatePath("/inbox");
}

export async function openedAction(jobId: string) {
  const c = await ctx();
  await markOpened(c, jobId);
  revalidatePath(`/jobs/${jobId}`);
}

export async function appliedAction(jobId: string) {
  const c = await ctx();
  await confirmApplied(c, jobId);
  revalidatePath("/", "layout");
}

export async function snoozeAction(jobId: string, date: string) {
  const c = await ctx();
  const p = await loadProfile(c.db, c.userId);
  await setReminder(c, jobId, date, todayStr(rule(cc(p?.target_country)).timeZone));
  revalidatePath("/", "layout");
}

export async function statusAction(jobId: string, status: string) {
  const c = await ctx();
  await updateStatus(c, jobId, status);
  revalidatePath("/applications");
}

export async function setReminderPrefAction(on: boolean) {
  const c = await ctx();
  await c.db.from("profiles").update({ email_reminders: on }).eq("id", c.userId);
  revalidatePath("/profile");
}
