"use server";
// Small user mutations as server actions. Each runs as the signed-in user (RLS applies).
// Actions called from client code only save; the caller refreshes the page in its own request. Re-rendering a page
// inside the action as well doubles the work of one request, which is what pushed it past the Worker CPU limit.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ctx } from "@/lib/server/page";
import { addUserSkill, reviewFact, saveAnswers, setCountry } from "@/lib/server/onboarding";
import { confirmApplied, TrialLimit, dismissJob, markOpened, setReminder, updateStatus } from "@/lib/server/applications";
import { isAccent, isTemplate, rule, cc } from "@/lib/countries";
import { todayStr } from "@/lib/dates";
import { loadProfile } from "@/lib/server/state";
import { ACCOUNT_KINDS, isSetupKey, SITE_STEPS, siteKey } from "@/lib/setup";


export async function setCountryAction(country: string, needsVisa: boolean, homeCountry?: string) {
  const c = await ctx("/onboarding");
  await setCountry(c, country, needsVisa, homeCountry);
}

export async function setHomeCountryAction(country: string) {
  const c = await ctx();
  await c.db.from("profiles").update({ home_country: cc(country) }).eq("id", c.userId);
}

export async function setNeedsVisaAction(needsVisa: boolean) {
  const c = await ctx();
  await c.db.from("profiles").update({ needs_visa: needsVisa }).eq("id", c.userId);
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
  const { data: master } = await c.db.from("master_cvs").select("id").eq("user_id", c.userId).eq("is_current", true).limit(1).maybeSingle();
  if (!master) redirect("/onboarding");
  const { error } = await c.db.from("profiles").update({ onboarding_step: "done" }).eq("id", c.userId);
  if (error) throw error;
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
}

export async function reviewFactAction(factId: string, keep: boolean) {
  const c = await ctx();
  await reviewFact(c, factId, keep);
}

export async function toggleSetupStepAction(key: string) {
  if (!isSetupKey(key)) return;
  const c = await ctx("/setup");
  const p = await loadProfile(c.db, c.userId);
  const steps = { ...(p?.setup_steps || {}) };
  steps[key] = !steps[key];
  await c.db.from("profiles").update({ setup_steps: steps }).eq("id", c.userId);
  revalidatePath("/setup");
}

/** Saves which email the user's account on a job site uses. Choosing a second Gmail records when, so only a newer Gmail confirmation counts for it. */
export async function setSiteAccountAction(site: string, kind: string) {
  if (!isSetupKey(siteKey("alerts", site)) || !ACCOUNT_KINDS.some((k) => k === kind)) return;
  const c = await ctx("/setup");
  const p = await loadProfile(c.db, c.userId);
  const steps = { ...(p?.setup_steps || {}), [`acct:${site}`]: kind };
  if (kind === "gmail2" && !steps[`forward:${site}`]) steps[`since:${site}`] = new Date().toISOString();
  await c.db.from("profiles").update({ setup_steps: steps }).eq("id", c.userId);
}

/** Clears one job site's steps so its setup can be done again; the Gmail connection stays. */
export async function resetSiteSetupAction(site: string) {
  if (!isSetupKey(siteKey("alerts", site))) return;
  const c = await ctx("/setup");
  const p = await loadProfile(c.db, c.userId);
  const steps = { ...(p?.setup_steps || {}) };
  for (const k of SITE_STEPS) delete steps[siteKey(k, site)];
  for (const k of ["acct", "forward", "since"]) delete steps[`${k}:${site}`];
  await c.db.from("profiles").update({ setup_steps: steps }).eq("id", c.userId);
  revalidatePath("/setup");
}

/** Marks setup steps done (never undoes them); adding the Gmail forwarding address implies it was copied. */
export async function completeSetupStepAction(key: string) {
  if (!isSetupKey(key)) return;
  const c = await ctx("/setup");
  const p = await loadProfile(c.db, c.userId);
  const steps = { ...(p?.setup_steps || {}), [key]: true, ...(key === "forward" ? { address: true } : {}) };
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
}

export async function appliedAction(jobId: string) {
  const c = await ctx();
  try { await confirmApplied(c, jobId); } catch (e) { if (e instanceof TrialLimit) redirect("/upgrade?from=trial"); throw e; }
  revalidatePath("/", "layout");
}

export async function snoozeAction(jobId: string, date: string) {
  const c = await ctx();
  const p = await loadProfile(c.db, c.userId);
  await setReminder(c, jobId, date, todayStr(rule(cc(p?.target_country)).timeZone));
}

export async function statusAction(jobId: string, status: string) {
  const c = await ctx();
  await updateStatus(c, jobId, status);
}

export async function setReminderPrefAction(on: boolean) {
  const c = await ctx();
  await c.db.from("profiles").update({ email_reminders: on }).eq("id", c.userId);
  revalidatePath("/profile");
}

export async function noReplyYetAction(jobId: string) {
  const c = await ctx();
  await c.db.from("applications").update({ reply_checked_at: new Date().toISOString() }).eq("user_id", c.userId).eq("job_id", jobId);
}

export async function saveCareerSafetyAction(formData: FormData) {
  const c = await ctx("/profile");
  const csv = (k: string) => String(formData.get(k) || "").split(",").map((x) => x.trim().toLowerCase()).filter(Boolean).slice(0, 50);
  const num = (k: string) => { const v = String(formData.get(k) || "").trim(); return v && Number.isFinite(Number(v)) ? Math.max(0, Number(v)) : null; };
  const dealBreakers = {
    minSalary: num("minSalary"),
    remoteOnly: formData.get("remoteOnly") === "on",
    noRelocation: formData.get("noRelocation") === "on",
    noContract: formData.get("noContract") === "on",
    sponsorshipRequired: formData.get("sponsorshipRequired") === "on",
    workAuthorizationRequired: formData.get("workAuthorizationRequired") === "on",
    excludedIndustries: csv("excludedIndustries"),
    excludedCompanies: csv("excludedCompanies"),
    excludedRoleTypes: csv("excludedRoleTypes"),
  };
  const wa = String(formData.get("workAuthorization") || "unknown");
  const tri = (k: string) => { const v = String(formData.get(k) || ""); return v === "yes" ? true : v === "no" ? false : null; };
  const answerLibrary = {
    expectedSalary: num("expectedSalary"),
    noticeDays: num("noticeDays"),
    workAuthorization: wa === "yes" || wa === "no" ? wa : "unknown",
    sponsorshipRequired: tri("answerSponsorship"),
    willingToRelocate: tri("willingToRelocate"),
    currentSalary: num("currentSalary"),
    managementYears: num("managementYears"),
    teamSize: num("teamSize"),
    willingToTravel: tri("willingToTravel"),
  };
  const { error } = await c.db.from("profiles").update({ deal_breakers: dealBreakers, answer_library: answerLibrary }).eq("id", c.userId);
  if (error) throw error;
  revalidatePath("/profile");
  revalidatePath("/inbox");
}
