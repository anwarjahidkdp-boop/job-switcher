// Onboarding: CV upload -> extraction -> grounded facts -> questions -> preferences -> Master CV.
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { cc, rule, type CountryCode } from "../countries";
import { answerSkillFacts, appearsIn, groundExtraction, verifiedOnly, type CareerFact } from "../facts";
import { checkMasterCv } from "../numbers-check";
import { EXTRACT_PROMPT, MASTER_PROMPT, SYSTEM_RULES } from "../prompts";
import { ExtractionSchema, MasterCvSchema } from "../ai/schemas";
import { aiConfigured, checkBudget, getBudget, runAI } from "../ai";
import { AIError } from "../ai/provider";
import { DEMO_CV_TEXT, DEMO_EXTRACT, DEMO_MASTER } from "../demo";
import { extractCvText, MIME, MIN_CV_CHARS, CvReadError } from "../cv/extract-text";
import { CATEGORIES, INDUSTRY_LIST, isSeniority, normSkill } from "../taxonomy";
import type { CvQuestion, Extraction, ExtractedExperience, MasterCV, PersonalDetails, Preferences } from "../types";
import { loadFacts, loadProfile, type CvDocRow } from "./state";
import { refreshMatches } from "./matches";

export interface Ctx { db: SupabaseClient; admin: SupabaseClient; userId: string }

export async function setCountry(ctx: Ctx, country: string, needsVisa: boolean) {
  const code = cc(country);
  const prev = await loadProfile(ctx.db, ctx.userId);
  const patch: Record<string, unknown> = { target_country: code, needs_visa: code === "BD" ? true : !!needsVisa };
  if (prev?.onboarding_step === "country") patch.onboarding_step = "upload";
  // Changing country resets the currency-dependent salary and the city list (prototype changeCountry()).
  if (prev && prev.preferences && prev.target_country !== code) {
    const o = rule(prev.target_country), n = rule(code);
    const p = { ...prev.preferences };
    if (o.sym !== n.sym || o.per !== n.per) { p.salaryMin = null; p.salaryMax = null; }
    p.locations = code === "BD" ? prev.career_meta?.location || "Dhaka" : "";
    patch.preferences = p;
  }
  const { error } = await ctx.db.from("profiles").update(patch).eq("id", ctx.userId);
  if (error) throw error;
  if (prev && prev.target_country !== code) await refreshMatches(ctx.db, ctx.userId).catch(() => 0);
}

function cleanExtraction(x: Extraction): Extraction {
  return {
    ...x,
    industries: (x.industries || []).map((s) => s.toLowerCase()).filter((s) => INDUSTRY_LIST.includes(s)),
    categories: (x.categories || []).filter((c) => CATEGORIES.includes(c)).slice(0, 2),
    seniority: isSeniority(x.seniority) ? x.seniority : "mid",
    skills: (x.skills || []).map(normSkill),
    questions: (x.questions || []).slice(0, 5).map((q, i) => ({ id: `q${i + 1}`, question: String(q.question || ""), placeholder: String(q.placeholder || "") })).filter((q) => q.question),
  };
}

/** Upload (or paste, or demo) a CV, extract with AI, store grounded facts. Returns the questions to ask. */
export async function ingestCv(ctx: Ctx, input: { file?: { name: string; bytes: Uint8Array }; text?: string; demo?: boolean }) {
  const profile = await loadProfile(ctx.db, ctx.userId);
  if (!profile) throw new Error("profile missing");
  const country = cc(profile.target_country);
  let text = "", storagePath: string | null = null, fileName: string | null = null, mime: string | null = null, size: number | null = null;
  if (!input.demo) {
    // Fail fast (before storing anything) when AI is unavailable or the user is over their cap.
    if (!aiConfigured()) throw new AIError("not_configured");
    checkBudget(await getBudget(ctx.admin, ctx.userId));
  }
  if (input.demo) text = DEMO_CV_TEXT;
  else if (input.file) {
    const r = await extractCvText(input.file.bytes, input.file.name);
    text = r.text;
    if (text.length < MIN_CV_CHARS) throw new CvReadError("We could not read enough text from this file. If it is a scanned image, paste the text instead.");
    fileName = input.file.name.slice(0, 200); mime = MIME[r.kind]; size = input.file.bytes.byteLength;
    storagePath = `${ctx.userId}/cv/${randomUUID()}.${r.kind}`;
    const up = await ctx.db.storage.from("cv-files").upload(storagePath, input.file.bytes, { contentType: mime, upsert: false });
    if (up.error) throw new Error("Could not store your CV: " + up.error.message);
  } else {
    text = String(input.text || "").trim();
    if (text.length < MIN_CV_CHARS) throw new CvReadError("That looks too short for a CV. Paste the full text.");
  }

  let extraction: Extraction;
  if (input.demo) extraction = JSON.parse(JSON.stringify(DEMO_EXTRACT));
  else {
    const res = await runAI(ctx.admin, ctx.userId, "cv_extract", (p) => p.generateJSON({ tier: "fast", system: SYSTEM_RULES, prompt: EXTRACT_PROMPT(text, country), schema: ExtractionSchema }));
    extraction = cleanExtraction(res.data as Extraction);
    if (!extraction.experiences) throw new AIError("invalid_json");
  }
  const questions: (CvQuestion & { demo?: string })[] = extraction.questions;

  await ctx.db.from("cv_documents").update({ is_current: false }).eq("user_id", ctx.userId).eq("is_current", true);
  const { data: doc, error } = await ctx.db.from("cv_documents").insert({
    user_id: ctx.userId, storage_path: storagePath, file_name: fileName, mime_type: mime, size_bytes: size, text_content: text,
    extraction, questions: questions.map(({ id, question, placeholder }) => ({ id, question, placeholder })), is_demo: !!input.demo,
    answers: input.demo ? Object.fromEntries(questions.map((q) => [q.id, q.demo || ""])) : {},
  }).select("id").single();
  if (error) throw error;

  // A new CV replaces facts from the previous CV and its answers; skills the user added themselves are kept.
  await ctx.db.from("career_facts").delete().eq("user_id", ctx.userId).in("provenance", ["cv", "answer"]);
  const facts = groundExtraction(extraction, text);
  if (facts.length) {
    const { error: fe } = await ctx.db.from("career_facts").insert(facts.map((f) => ({ ...f, user_id: ctx.userId, cv_document_id: doc.id })));
    if (fe) throw fe;
  }
  await ctx.db.from("profiles").update({
    full_name: extraction.name || profile.full_name, phone: extraction.phone, city: extraction.location,
    career_meta: { industries: extraction.industries, categories: extraction.categories, seniority: extraction.seniority, target_roles: extraction.target_roles, location: extraction.location },
    onboarding_step: "questions",
  }).eq("id", ctx.userId);
  return { cvDocumentId: doc.id as string, questions, found: { roles: extraction.experiences.length, degrees: extraction.education.length, skills: extraction.skills.length }, unverified: facts.filter((f) => !f.verified).length, name: extraction.name };
}

export async function saveAnswers(ctx: Ctx, answers: Record<string, string>) {
  const { data: doc } = await ctx.db.from("cv_documents").select("id, questions").eq("user_id", ctx.userId).eq("is_current", true).maybeSingle();
  if (!doc) throw new Error("Upload a CV first.");
  const qs = (doc.questions || []) as CvQuestion[];
  const clean: Record<string, string> = {};
  for (const q of qs) clean[q.id] = String(answers[q.id] || "").trim().slice(0, 1000);
  await ctx.db.from("cv_documents").update({ answers: clean }).eq("id", doc.id);
  await ctx.db.from("career_facts").delete().eq("user_id", ctx.userId).eq("kind", "answer");
  const rows = qs.filter((q) => clean[q.id]).map((q) => ({ user_id: ctx.userId, cv_document_id: doc.id, kind: "answer", provenance: "answer", verified: true, data: { questionId: q.id, question: q.question, answer: clean[q.id] } }));
  if (rows.length) await ctx.db.from("career_facts").insert(rows);
  await ctx.db.from("profiles").update({ onboarding_step: "prefs" }).eq("id", ctx.userId);
}

const num = (v: unknown) => (v === "" || v == null || isNaN(Number(v)) ? null : Math.max(0, Number(v)));
export async function savePreferences(ctx: Ctx, prefs: Partial<Preferences>, personal: PersonalDetails | null) {
  const profile = await loadProfile(ctx.db, ctx.userId);
  const p: Preferences = {
    roles: String(prefs.roles || "").slice(0, 500), locations: String(prefs.locations || "").slice(0, 300),
    salaryMin: num(prefs.salaryMin), salaryMax: num(prefs.salaryMax), notice: num(prefs.notice),
    mode: (["On-site", "Hybrid", "Remote", "Any"] as const).includes(prefs.mode as Preferences["mode"]) ? (prefs.mode as Preferences["mode"]) : "On-site",
  };
  const patch: Record<string, unknown> = { preferences: p };
  if (personal) patch.personal = { nationality: String(personal.nationality || "").slice(0, 80), dob: String(personal.dob || "").slice(0, 40), visa: String(personal.visa || "").slice(0, 120) };
  await ctx.db.from("profiles").update(patch).eq("id", ctx.userId);
  if (profile?.onboarding_step === "done") await refreshMatches(ctx.db, ctx.userId).catch(() => 0);
}

/** Generate the Master CV from verified facts only, then run the deterministic post-checks. */
export async function buildMasterCv(ctx: Ctx) {
  const profile = await loadProfile(ctx.db, ctx.userId);
  if (!profile) throw new Error("profile missing");
  const country: CountryCode = cc(profile.target_country);
  const { data: docRow } = await ctx.db.from("cv_documents").select("id, text_content, questions, answers, is_demo, extraction").eq("user_id", ctx.userId).eq("is_current", true).maybeSingle();
  const doc = docRow as (CvDocRow & { extraction: Extraction | null }) | null;
  if (!doc) throw new Error("Upload a CV first.");
  const facts = await loadFacts(ctx.db, ctx.userId);
  const v = verifiedOnly(facts);
  const verifiedFacts = {
    experiences: v.filter((f) => f.kind === "experience").map((f) => f.data as unknown as ExtractedExperience),
    education: v.filter((f) => f.kind === "education").map((f) => f.data) as never[],
    certifications: v.filter((f) => f.kind === "certification").map((f) => f.data) as never[],
    skills: v.filter((f) => f.kind === "skill").map((f) => String((f.data as { name: string }).name)),
    languages: v.filter((f) => f.kind === "language").map((f) => String((f.data as { name: string }).name)),
  };
  const answers = doc.answers || {};
  const answersText = Object.values(answers).filter(Boolean).join("\n");

  let m: MasterCV, ai = false, model: string | null = null;
  if (doc.is_demo && !aiConfigured()) m = JSON.parse(JSON.stringify(DEMO_MASTER));
  else {
    const res = await runAI(ctx.admin, ctx.userId, "master_cv", (p) => p.generateJSON({ tier: "quality", system: SYSTEM_RULES, prompt: MASTER_PROMPT(doc.text_content, verifiedFacts, doc.questions || [], answers, profile.preferences?.roles || "", country), schema: MasterCvSchema }));
    m = res.data as MasterCV; ai = true; model = res.usage.model;
  }
  // Dates always come from verified facts, never from the generator.
  m.experience = (m.experience || []).map((e) => {
    const f = verifiedFacts.experiences.find((x) => appearsIn(x.company, e.company) || appearsIn(e.company, x.company));
    return f ? { ...e, start: f.start, end: f.end } : e;
  });
  const checked = checkMasterCv(m, {
    cvText: doc.text_content, answersText, extra: JSON.stringify(profile.preferences || {}),
    verifiedCompanies: verifiedFacts.experiences.map((e) => e.company), verifiedSkills: verifiedFacts.skills,
  });

  // Skills the generator says the answers confirmed: keep only those the answers really mention.
  const existing = new Set(verifiedFacts.skills.map(normSkill));
  const newSkills = answerSkillFacts(m.extra_skills || [], answersText, existing);
  if (newSkills.length) await ctx.db.from("career_facts").insert(newSkills.map((f: CareerFact) => ({ ...f, user_id: ctx.userId, cv_document_id: doc.id })));

  const { data: prev } = await ctx.db.from("master_cvs").select("version").eq("user_id", ctx.userId).order("version", { ascending: false }).limit(1).maybeSingle();
  await ctx.db.from("master_cvs").update({ is_current: false }).eq("user_id", ctx.userId).eq("is_current", true);
  const { error } = await ctx.db.from("master_cvs").insert({ user_id: ctx.userId, version: (prev?.version || 0) + 1, content: checked.master, flags: checked.flags, ai, model, source_cv_document_id: doc.id });
  if (error) throw error;
  await ctx.db.from("profiles").update({ onboarding_step: profile.onboarding_step === "done" ? "done" : "reveal" }).eq("id", ctx.userId);
  await refreshMatches(ctx.db, ctx.userId).catch(() => 0);
  return { flags: checked.flags, ai };
}

/** Skills the user confirms they have (prototype addSkill). Provenance "user", verified by the user's explicit confirmation. */
export async function addUserSkill(ctx: Ctx, skill: string) {
  const name = normSkill(skill).slice(0, 60);
  if (!name) return;
  const facts = await loadFacts(ctx.db, ctx.userId);
  if (facts.some((f) => f.kind === "skill" && f.verified && normSkill((f.data as { name: string }).name) === name)) return;
  const pending = facts.find((f) => f.kind === "skill" && !f.verified && normSkill((f.data as { name: string }).name) === name);
  if (pending?.id) await ctx.db.from("career_facts").update({ verified: true, provenance: "user" }).eq("id", pending.id);
  else await ctx.db.from("career_facts").insert({ user_id: ctx.userId, kind: "skill", data: { name }, provenance: "user", verified: true });
  await refreshMatches(ctx.db, ctx.userId).catch(() => 0);
}

/** The user confirms (or removes) a CV fact we could not find in their CV text. */
export async function reviewFact(ctx: Ctx, factId: string, keep: boolean) {
  if (keep) await ctx.db.from("career_facts").update({ verified: true }).eq("id", factId).eq("user_id", ctx.userId);
  else await ctx.db.from("career_facts").delete().eq("id", factId).eq("user_id", ctx.userId);
  await refreshMatches(ctx.db, ctx.userId).catch(() => 0);
}
