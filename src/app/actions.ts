"use server";
// Small user mutations as server actions. Each runs as the signed-in user (RLS applies).
// Actions called from client code only save; the caller refreshes the page in its own request. Re-rendering a page
// inside the action as well doubles the work of one request, which is what pushed it past the Worker CPU limit.
import { refreshCareerMatches } from "@/lib/server/matches";
import { setupRequirements,validBirthDate } from "@/lib/eligibility";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ctx } from "@/lib/server/page";
import { addUserSkill, reviewFact, saveAnswers, setCountry } from "@/lib/server/onboarding";
import { confirmApplied, TrialLimit, dismissJob, markOpened, setReminder, updateStatus } from "@/lib/server/applications";
import { isAccent, isTemplate, rule, cc } from "@/lib/countries";
import { todayStr } from "@/lib/dates";
import { loadProfile } from "@/lib/server/state";
import { ACCOUNT_KINDS, isSetupKey, SITE_STEPS, siteKey, LINKEDIN_URL, LINKEDIN_DONE } from "@/lib/setup";
import { linkedinUrl } from "@/lib/linkedin";


export async function setCountryAction(country: string, needsVisa: boolean, homeCountry?: string) {
  const c = await ctx("/onboarding");
  await setCountry(c, country, needsVisa, homeCountry);
}

export async function setHomeCountryAction(country: string) {
  const c = await ctx();
  const { error } = await c.db.from("profiles").update({ home_country: cc(country) }).eq("id", c.userId);
  if (error) throw error;
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
  const profile = await loadProfile(c.db, c.userId);
  if (!profile || !["reveal", "done"].includes(profile.onboarding_step)) redirect("/onboarding");
  if(setupRequirements(profile).length)redirect("/onboarding?step=prefs");
  const { data: master } = await c.db.from("master_cvs").select("id").eq("user_id", c.userId).eq("is_current", true).limit(1).maybeSingle();
  if (!master) redirect("/onboarding");
  const { data: finished, error } = await c.db.from("profiles").update({ onboarding_step: "done" }).eq("id", c.userId)
    .eq("target_country", profile.target_country).eq("search_country_version", profile.search_country_version)
    .in("onboarding_step", ["reveal", "done"]).select("id").maybeSingle();
  if (error) throw error;
  if (!finished) redirect("/onboarding");
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
  revalidatePath("/queue");
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
  revalidatePath("/","layout");
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
  for (const key of ["minSalary","expectedSalary","noticeDays","currentSalary","managementYears","teamSize"]) {
    const raw = String(formData.get(key) || "").trim();
    if (raw && (!Number.isFinite(Number(raw)) || Number(raw) < 0 || ((key === "minSalary" || key === "expectedSalary") && Number(raw) === 0))) throw new Error("Enter a valid salary or choose no fixed minimum / negotiable. Other numeric answers may be 0.");
  }
  const dealBreakers = {
    minSalary: formData.get("minimumMode") === "none" ? null : num("minSalary"),
    minSalarySet: formData.get("minimumMode") === "none" || num("minSalary") != null,
    excludedCompaniesSet: formData.get("excludedCompaniesMode") === "none" || csv("excludedCompanies").length > 0,
    excludedIndustriesSet: formData.get("excludedIndustriesMode") === "none" || csv("excludedIndustries").length > 0,
    excludedRoleTypesSet: formData.get("excludedRoleTypesMode") === "none" || csv("excludedRoleTypes").length > 0,
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
  const birthDate=String(formData.get("birthDate")||"").trim();
  if(birthDate&&!validBirthDate(birthDate))throw new Error("Enter a valid date of birth.");
  const profile=await loadProfile(c.db,c.userId);
  if(!profile)throw new Error("Profile missing");
  const answerLibrary = {
    salaryCountry:profile.target_country,currentSalaryCountry:profile.target_country,
    birthDate:birthDate||profile.answer_library?.birthDate||profile.personal?.dob||null,
    expectedSalary: formData.get("salaryMode") === "negotiable" ? null : num("expectedSalary"),
    salaryNegotiable: formData.get("salaryMode") === "negotiable",
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
  await refreshCareerMatches(c.admin,c.userId);
  revalidatePath("/profile");
  revalidatePath("/inbox");
  revalidatePath("/insights");
}

/** "Connect LinkedIn": saves the person's public profile link (LinkedIn has no API to edit a profile for them). */
export async function saveLinkedinAction(raw: string) {
  const url = linkedinUrl(raw);
  if (!url) throw new Error("Enter your LinkedIn profile link, like linkedin.com/in/your-name.");
  const c = await ctx("/linkedin");
  const p = await loadProfile(c.db, c.userId);
  const { error } = await c.db.from("profiles").update({ setup_steps: { ...(p?.setup_steps || {}), [LINKEDIN_URL]: url } }).eq("id", c.userId);
  if (error) throw error;
}

/** The person says they copied the new sections into LinkedIn; Home stops asking. */
export async function markLinkedinUpdatedAction(done: boolean) {
  const c = await ctx("/linkedin");
  const p = await loadProfile(c.db, c.userId);
  const steps = { ...(p?.setup_steps || {}) };
  if (done) steps[LINKEDIN_DONE] = new Date().toISOString(); else delete steps[LINKEDIN_DONE];
  const { error } = await c.db.from("profiles").update({ setup_steps: steps }).eq("id", c.userId);
  if (error) throw error;
}
