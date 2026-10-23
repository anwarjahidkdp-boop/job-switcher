// Onboarding: CV upload -> extraction -> grounded facts -> questions -> preferences -> Master CV.
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { cc, rule, type CountryCode } from "../countries";
import { answerSkillFacts, appearsIn, groundExtraction, verifiedOnly, type CareerFact, type CareerMeta, type RemovedItem } from "../facts";
import { bnDigits, dropRemoved, EditRefused, factRefs, hasBangla, FIELDS, MAX_EDIT_CHARS, MAX_EDITS_KEPT, nextRemoved, planFactEdits, type FactOp } from "../cv-edit";
import { checkMasterCv } from "../numbers-check";
import { CV_EDIT_PROMPT, TRANSLATE_EDIT_PROMPT, EXTRACT_PROMPT, MASTER_PROMPT, OCR_PROMPT, OCR_SYSTEM, SYSTEM_RULES } from "../prompts";
import { CvEditSchema, ExtractionSchema, MasterBuildSchema, TranslateSchema, type CvEditOut } from "../ai/schemas";
import { aiConfigured, checkBudget, getBudget, runAI } from "../ai";
import { AIError } from "../ai/provider";
import { DEMO_CV_TEXT, DEMO_EXTRACT, DEMO_MASTER } from "../demo";
import { MAX_CV_TEXT, MIME, MIN_CV_CHARS, CvReadError, sniffImage, sniffKind, tidy } from "../cv/sniff";
import { CATEGORIES, INDUSTRY_LIST, isSeniority, normSkill, skillLabel } from "../taxonomy";
import { mergePersonal } from "../cv/conventions";
import { applySuggestion, cleanSuggestions, dismissSuggestion } from "../cv/suggestions";
import type { CvQuestion, Extraction, ExtractedExperience, MasterCV, PersonalDetails, Preferences } from "../types";
import { DEFAULT_META, loadFacts, loadProfile, type CvDocRow, type ProfileRow } from "./state";
import { freshnessQuestions } from "../cv-fresh";
import { todayStr } from "../dates";

export interface Ctx { db: SupabaseClient; admin: SupabaseClient; userId: string }

export async function setCountry(ctx: Ctx, country: string, needsVisa: boolean, homeCountry?: string) {
  const code = cc(country);
  const prev = await loadProfile(ctx.db, ctx.userId);
  if (!prev) throw new Error("Profile missing");
  if (homeCountry && cc(homeCountry) !== prev.home_country && prev.billing_country_locked) {
    throw new Error("Your subscription country is fixed after initial setup.");
  }
  const home = homeCountry ? cc(homeCountry) : cc(prev.home_country);
  const patch: Record<string, unknown> = { target_country: code, needs_visa: code === home ? false : !!needsVisa };
  if (homeCountry) patch.home_country = home;
  if (prev.onboarding_step === "country") { patch.onboarding_step = "upload"; patch.cv_style = { tpl: rule(code).tpl }; }
  // The database resets country-specific setup atomically, including direct REST updates.
  const { error } = await ctx.db.from("profiles").update(patch).eq("id", ctx.userId);
  if (error) throw error;
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

export type CvTextSource = "file" | "paste" | "ocr" | "demo";

/**
 * Upload (or paste, or demo) a CV, extract with AI, store grounded facts. Returns the questions to ask.
 * PDF/DOCX text is extracted in the browser (src/lib/cv/browser-read.ts) and arrives as `text`; the original file
 * arrives alongside it only to be stored privately. Scanned CVs arrive as text the user checked after transcription.
 */
export async function ingestCv(ctx: Ctx, input: { file?: { name: string; bytes: Uint8Array }; text?: string; demo?: boolean; source?: CvTextSource }) {
  const profile = await loadProfile(ctx.db, ctx.userId);
  if (!profile) throw new Error("profile missing");
  const country = cc(profile.target_country);
  let text = "", storagePath: string | null = null, fileName: string | null = null, mime: string | null = null, size: number | null = null;
  let source: CvTextSource = input.demo ? "demo" : input.source === "ocr" ? "ocr" : input.file ? "file" : "paste";
  if (!input.demo) {
    // Fail fast (before storing anything) when AI is unavailable or the user is over their cap.
    if (!aiConfigured()) throw new AIError("not_configured");
    checkBudget(await getBudget(ctx.admin, ctx.userId));
  }
  if (input.demo) text = DEMO_CV_TEXT;
  else {
    text = tidy(String(input.text || "")).slice(0, MAX_CV_TEXT);
    if (input.file) {
      const kind = sniffKind(input.file.bytes, input.file.name);
      // Plain text needs no parser, so the server can read it itself.
      if (!text && kind === "txt") text = tidy(new TextDecoder("utf-8").decode(input.file.bytes)).slice(0, MAX_CV_TEXT);
      if (text.length < MIN_CV_CHARS) throw new CvReadError("We could not read enough text from this file. Take a photo of each page instead, or paste the text.");
      fileName = input.file.name.slice(0, 200); mime = MIME[kind]; size = input.file.bytes.byteLength;
      storagePath = `${ctx.userId}/cv/${randomUUID()}.${kind}`;
      const up = await ctx.db.storage.from("cv-files").upload(storagePath, input.file.bytes, { contentType: mime, upsert: false });
      if (up.error) throw new Error("Could not store your CV: " + up.error.message);
    } else if (text.length < MIN_CV_CHARS) throw new CvReadError("That looks too short for a CV. Paste the full text.");
  }
  if (source === "file" && !input.file) source = "paste";

  let extraction: Extraction;
  if (input.demo) extraction = JSON.parse(JSON.stringify(DEMO_EXTRACT));
  else {
    const res = await runAI(ctx.admin, ctx.userId, "cv_extract", (p) => p.generateJSON({ tier: "fast", system: SYSTEM_RULES, prompt: EXTRACT_PROMPT(text, country), schema: ExtractionSchema }));
    extraction = cleanExtraction(res.data as Extraction);
    if (!extraction.experiences) throw new AIError("invalid_json");
  }
  // An old CV (newest date a year or more ago) first asks whether the current role and dates still hold.
  const fresh = input.demo ? [] : freshnessQuestions(extraction, todayStr(rule(country).timeZone));
  const questions: (CvQuestion & { demo?: string })[] = [...fresh, ...extraction.questions].slice(0, 6);

  const facts = groundExtraction(extraction, text);
  const { data: docId, error } = await ctx.db.rpc("replace_cv", {
    p_document: {
      storage_path: storagePath, file_name: fileName, mime_type: mime, size_bytes: size, text_content: text, text_source: source,
      extraction, questions: questions.map(({ id, question, placeholder }) => ({ id, question, placeholder })), is_demo: !!input.demo,
      answers: input.demo ? Object.fromEntries(questions.map((q) => [q.id, q.demo || ""])) : {},
    },
    p_facts: facts,
    p_profile: {
      full_name: extraction.name || profile.full_name, phone: extraction.phone, city: extraction.location,
      career_meta: { industries: extraction.industries, categories: extraction.categories, seniority: extraction.seniority, target_roles: extraction.target_roles, location: extraction.location },
    },
  });
  if (error) throw error;

  return { cvDocumentId: docId as string, questions, found: { roles: extraction.experiences.length, degrees: extraction.education.length, skills: extraction.skills.length }, unverified: facts.filter((f) => !f.verified).length, name: extraction.name };
}

export const MAX_SCAN_PAGES = 4;
export const MAX_PAGE_BYTES = 3 * 1024 * 1024;

/**
 * Transcribe photographed or scanned CV pages with the vision model (fast tier), metered against the user's AI budget.
 * The page images are never written to storage: they are held in memory for this one request and discarded.
 * The user reviews and corrects the text before it goes through ingestCv like pasted text.
 */
export async function transcribeCv(ctx: Ctx, pages: Uint8Array[]) {
  if (!pages.length) throw new CvReadError("Add at least one page.");
  if (pages.length > MAX_SCAN_PAGES) throw new CvReadError(`Send at most ${MAX_SCAN_PAGES} pages.`);
  const images = pages.map((b) => {
    if (b.byteLength > MAX_PAGE_BYTES) throw new CvReadError("A page image is too large. Try again; the app shrinks photos before sending.");
    const mediaType = sniffImage(b);
    if (!mediaType) throw new CvReadError("Pages must be JPG, PNG or WebP images.");
    return { mediaType, data: Buffer.from(b).toString("base64") };
  });
  if (!aiConfigured()) throw new AIError("not_configured");
  const res = await runAI(ctx.admin, ctx.userId, "cv_ocr", (p) => p.readImages({ tier: "fast", system: OCR_SYSTEM, prompt: OCR_PROMPT(images.length), images, maxTokens: 8000 }));
  const text = tidy(res.text.replace(/^```[a-z]*\n?|\n?```$/g, "")).slice(0, MAX_CV_TEXT);
  if (/^NO_CV_TEXT\b/.test(text) || text.length < 40) throw new CvReadError("We could not read a CV in these photos. Make sure each page is flat, well lit and in focus, then try again.");
  return { text, truncated: res.truncated, pages: images.length };
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
export async function savePreferences(ctx: Ctx, prefs: Partial<Preferences>, personal: PersonalDetails | null, destination?: { country: string; revision: number; needsVisa?: boolean }) {
  const p: Preferences = {
    roles: String(prefs.roles || "").slice(0, 500), locations: String(prefs.locations || "").slice(0, 300),
    salaryMin: num(prefs.salaryMin), salaryMax: num(prefs.salaryMax), notice: num(prefs.notice),
    mode: (["On-site", "Hybrid", "Remote", "Any"] as const).includes(prefs.mode as Preferences["mode"]) ? (prefs.mode as Preferences["mode"]) : "On-site",
  };
  const patch: Record<string, unknown> = { preferences: p };
  if (personal) {
    const { data, error } = await ctx.db.from("profiles").select("personal").eq("id", ctx.userId).maybeSingle();
    if (error) throw error;
    patch.personal = mergePersonal((data?.personal as PersonalDetails | null) ?? null, personal);
  }
  if (typeof destination?.needsVisa === "boolean") patch.needs_visa = destination.needsVisa;
  let query = ctx.db.from("profiles").update(patch).eq("id", ctx.userId);
  if (destination) query = query.eq("target_country", destination.country).eq("search_country_version", destination.revision);
  const { data, error } = await query.select("id").maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Your job-search country changed. Reload and complete setup for the current country.");
}

const verifiedFactsFor = (facts: CareerFact[]) => {
  const v = verifiedOnly(facts);
  return {
    experiences: v.filter((f) => f.kind === "experience").map((f) => f.data as unknown as ExtractedExperience),
    education: v.filter((f) => f.kind === "education").map((f) => f.data) as never[],
    certifications: v.filter((f) => f.kind === "certification").map((f) => f.data) as never[],
    skills: v.filter((f) => f.kind === "skill").map((f) => String((f.data as { name: string }).name)),
    languages: v.filter((f) => f.kind === "language").map((f) => String((f.data as { name: string }).name)),
  };
};
type VerifiedFacts = ReturnType<typeof verifiedFactsFor>;
const metaOf = (p: ProfileRow): CareerMeta => ({ ...DEFAULT_META, ...(p.career_meta || {}) });

/**
 * Deterministic checks shared by the build and the edit: dates from verified facts, employers, skills and numbers
 * against the sources, then items the person removed. What the person typed or added counts as a source.
 */
function finishMaster(m: MasterCV, vf: VerifiedFacts, facts: CareerFact[], src: { cvText: string; answersText: string; prefs: unknown; edits: string[]; removed: RemovedItem[] }) {
  // Dates always come from verified facts, never from the generator.
  m.experience = (m.experience || []).map((e) => {
    const f = vf.experiences.find((x) => appearsIn(x.company, e.company) || appearsIn(e.company, x.company));
    return f ? { ...e, start: f.start, end: f.end } : e;
  });
  const userFacts = verifiedOnly(facts).filter((f) => f.provenance === "user").map((f) => f.data);
  const checked = checkMasterCv(m, {
    cvText: src.cvText, answersText: src.answersText, extra: JSON.stringify(src.prefs || {}) + "\n" + src.edits.join("\n") + "\n" + JSON.stringify(userFacts),
    verifiedCompanies: vf.experiences.map((e) => e.company), verifiedSkills: vf.skills,
  });
  return { master: dropRemoved(checked.master, src.removed), flags: checked.flags };
}

async function saveMaster(ctx: Ctx, content: MasterCV, flags: string[], ai: boolean, model: string | null, docId: string | null, profile: ProfileRow, completeSetup = false) {
  const { error } = await ctx.db.rpc("publish_country_master_cv", { p_content: content, p_flags: flags, p_ai: ai, p_model: model, p_document_id: docId, p_country: profile.target_country, p_revision: profile.search_country_version, p_complete_setup: completeSetup });
  if (error) throw error;
}

/** Generate the Master CV from verified facts only, then run the deterministic post-checks. */
export async function buildMasterCv(ctx: Ctx) {
  const profile = await loadProfile(ctx.db, ctx.userId);
  if (!profile) throw new Error("profile missing");
  const country: CountryCode = cc(profile.target_country);
  const { data: docRow, error: docError } = await ctx.db.from("cv_documents").select("id, text_content, questions, answers, is_demo, extraction").eq("user_id", ctx.userId).eq("is_current", true).maybeSingle();
  if (docError) throw docError;
  const doc = docRow as (CvDocRow & { extraction: Extraction | null }) | null;
  if (!doc) throw new Error("Upload a CV first.");
  // Country changes reuse the already improved CV. Country-specific rendering needs no paid AI call.
  if (profile.onboarding_step === "prefs" && profile.search_country_version > 0) {
    const { data: existing, error } = await ctx.db.from("master_cvs").select("content, flags, ai, model, source_cv_document_id").eq("user_id", ctx.userId).eq("is_current", true).maybeSingle();
    if (error) throw error;
    if (existing && existing.source_cv_document_id === doc.id) {
      await saveMaster(ctx, existing.content as MasterCV, existing.flags || [], !!existing.ai, existing.model, doc.id, profile, true);
      return { flags: existing.flags || [], ai: false, reused: true };
    }
  }
  const facts = await loadFacts(ctx.db, ctx.userId);
  const verifiedFacts = verifiedFactsFor(facts);
  const answers = doc.answers || {};
  const answersText = Object.values(answers).filter(Boolean).join("\n");
  const meta = metaOf(profile);
  const edits = meta.edits || [], removed = meta.removed || [];

  let m: MasterCV, ai = false, model: string | null = null;
  if (doc.is_demo && !aiConfigured()) m = JSON.parse(JSON.stringify(DEMO_MASTER));
  else {
    const res = await runAI(ctx.admin, ctx.userId, "master_cv", (p) => p.generateJSON({ tier: "quality", system: SYSTEM_RULES, prompt: MASTER_PROMPT(doc.text_content, verifiedFacts, doc.questions || [], answers, profile.preferences?.roles || "", country, { edits, removed: removed.map((r) => `${r.kind}: ${r.label}`) }), schema: MasterBuildSchema }));
    m = res.data as MasterCV; ai = true; model = res.usage.model;
  }
  // Recommendations are kept apart from the checked CV and offered to the person (cleanSuggestions keeps only ones still on it).
  const rawSuggestions = m.suggestions;
  m = { ...m, suggestions: undefined };
  const checked = finishMaster(m, verifiedFacts, facts, { cvText: doc.text_content, answersText, prefs: profile.preferences, edits, removed });
  checked.master.suggestions = cleanSuggestions(checked.master, rawSuggestions);

  // Skills the generator says the answers confirmed: keep only those the answers really mention.
  const existing = new Set(verifiedFacts.skills.map(normSkill));
  const newSkills = answerSkillFacts(m.extra_skills || [], answersText, existing);
  if (newSkills.length) await ctx.db.from("career_facts").insert(newSkills.map((f: CareerFact) => ({ ...f, user_id: ctx.userId, cv_document_id: doc.id })));

  await saveMaster(ctx, checked.master, checked.flags, ai, model, doc.id, profile, true);
  return { flags: checked.flags, ai };
}

/**
 * "Ask AI to change your CV": apply one typed instruction. The AI proposes fact changes and the edited Master CV;
 * the fact changes are checked against what the person typed (planFactEdits) before anything is stored, so the
 * change sticks for later rebuilds and application packs. Facts added or corrected this way have provenance "user".
 */
export async function editMasterCv(ctx: Ctx, instruction: string, language: string | null = null) {
  let text = bnDigits(String(instruction || "")).replace(/"""/g, "\"").replace(/\s+/g, " ").trim().slice(0, MAX_EDIT_CHARS);
  if (text.length < 3) throw new EditRefused("Tell us what to change in your CV.");
  if (!aiConfigured()) throw new AIError("not_configured");
  // Written (or spoken) in Bangla or the local language: translate it first, then apply the English version with the same checks.
  let readAs = "";
  const nonLatin = /[^\u0000-\u024F\s\d.,;:!?'"()&%/+-]/.test(text);
  if (hasBangla(text) || language || nonLatin) {
    const from = hasBangla(text) ? "Bangla" : language || "the person's language";
    const tr = await runAI(ctx.admin, ctx.userId, "cv_edit", (p) => p.generateJSON({ tier: "fast", system: SYSTEM_RULES, prompt: TRANSLATE_EDIT_PROMPT(text, from), schema: TranslateSchema, maxTokens: 800 }));
    const en = bnDigits(String((tr.data as { english?: string }).english || "")).replace(/"""/g, "\"").replace(/\s+/g, " ").trim().slice(0, MAX_EDIT_CHARS);
    if (en.length < 3 || hasBangla(en)) throw new EditRefused("We could not read that. Try saying it another way.");
    text = readAs = en;
  }
  const profile = await loadProfile(ctx.db, ctx.userId);
  if (!profile) throw new Error("profile missing");
  const [{ data: masterRow }, { data: docRow }, facts] = await Promise.all([
    ctx.db.from("master_cvs").select("content").eq("user_id", ctx.userId).eq("is_current", true).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ctx.db.from("cv_documents").select("id, text_content, answers").eq("user_id", ctx.userId).eq("is_current", true).maybeSingle(),
    loadFacts(ctx.db, ctx.userId),
  ]);
  const before = (masterRow?.content as MasterCV | undefined) || null;
  if (!before) throw new EditRefused("Create your CV first, then ask for changes.");
  const doc = docRow as Pick<CvDocRow, "id" | "text_content" | "answers"> | null;

  const refs = factRefs(facts).map(({ ref, fact }) => ({ ref, kind: fact.kind, data: fact.data, confirmed: fact.verified }));
  const res = await runAI(ctx.admin, ctx.userId, "cv_edit", (p) => p.generateJSON({ tier: "quality", system: SYSTEM_RULES, prompt: CV_EDIT_PROMPT({ ...before, suggestions: undefined }, refs, text), schema: CvEditSchema, maxTokens: 12000 }));
  const out = res.data as CvEditOut;
  if (!out.ok || !out.master) throw new EditRefused(String(out.message || "").slice(0, 300) || "We could not tell what to change. Try saying it another way, for example \"remove the skill Tally\".");

  const meta = metaOf(profile);
  const ops: FactOp[] = (out.ops || []).map((o) => ({
    op: o.op, ref: o.ref || null, kind: o.kind, clear: o.clear || [],
    values: Object.fromEntries((o.values || []).filter((x) => FIELDS[o.kind].includes(x.field)).map((x) => [x.field, x.value])),
  }));
  const plan = planFactEdits(facts, ops, text, meta.removed || []);
  const m: MasterCV = { ...(out.master as MasterCV), improvements: before.improvements, extra_skills: before.extra_skills };
  m.suggestions = cleanSuggestions(m, before.suggestions);
  // A skill the person added is on the CV even if the model left it out.
  const listed = new Set([...(m.skills_core || []), ...(m.skills_tools || [])].map(normSkill));
  for (const f of plan.add) if (f.kind === "skill" && !listed.has(normSkill(f.data.name))) m.skills_core = [...(m.skills_core || []), skillLabel(normSkill(f.data.name))];
  const factsChange = plan.remove.length + plan.update.length + plan.add.length;
  if (!factsChange && JSON.stringify(m) === JSON.stringify(before)) throw new EditRefused("We could not find anything to change for that. Name the item the way it appears on your CV.");

  if (plan.remove.length) {
    const { error } = await ctx.db.from("career_facts").delete().eq("user_id", ctx.userId).in("id", plan.remove);
    if (error) throw error;
  }
  for (const u of plan.update) {
    const { error } = await ctx.db.from("career_facts").update({ data: u.data, provenance: "user", verified: true }).eq("id", u.id).eq("user_id", ctx.userId);
    if (error) throw error;
  }
  if (plan.add.length) {
    const { error } = await ctx.db.from("career_facts").insert(plan.add.map((f) => ({ ...f, user_id: ctx.userId, cv_document_id: doc?.id ?? null })));
    if (error) throw error;
  }

  const edits = [...(meta.edits || []), text].slice(-MAX_EDITS_KEPT);
  const removed = nextRemoved(meta.removed || [], plan);
  const after = await loadFacts(ctx.db, ctx.userId);
  const answersText = Object.values(doc?.answers || {}).filter(Boolean).join("\n");
  const checked = finishMaster(m, verifiedFactsFor(after), after, { cvText: doc?.text_content || "", answersText, prefs: profile.preferences, edits, removed });
  await saveMaster(ctx, checked.master, checked.flags, true, res.usage.model, doc?.id ?? null, profile);
  await ctx.db.from("profiles").update({ career_meta: { ...meta, edits, removed } }).eq("id", ctx.userId);
  const message = String(out.message || "Your CV was updated.").slice(0, 300);
  return { message: readAs ? `We read your request as: "${readAs}". ${message}` : message, flags: checked.flags };
}

/** The person chose an option for a recommended change (or dismissed it). The change is kept for later rebuilds as their own edit. */
export async function resolveSuggestion(ctx: Ctx, id: string, option: number | null) {
  const profile = await loadProfile(ctx.db, ctx.userId);
  if (!profile) throw new Error("profile missing");
  const [{ data: masterRow }, { data: docRow }, facts] = await Promise.all([
    ctx.db.from("master_cvs").select("content, flags, ai, model, source_cv_document_id").eq("user_id", ctx.userId).eq("is_current", true).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ctx.db.from("cv_documents").select("id, text_content, answers").eq("user_id", ctx.userId).eq("is_current", true).maybeSingle(),
    loadFacts(ctx.db, ctx.userId),
  ]);
  const before = (masterRow?.content as MasterCV | undefined) || null;
  if (!before) throw new EditRefused("Create your CV first.");
  if (option === null) {
    await ctx.db.from("master_cvs").update({ content: dismissSuggestion(before, id) }).eq("user_id", ctx.userId).eq("is_current", true);
    return { message: "Kept as it is." };
  }
  const applied = applySuggestion(before, id, option);
  if (!applied) throw new EditRefused("That line has changed since. Refresh the page to see the latest suggestions.");
  const meta = metaOf(profile);
  const edits = [...(meta.edits || []), applied.edit].slice(-MAX_EDITS_KEPT);
  const doc = docRow as Pick<CvDocRow, "id" | "text_content" | "answers"> | null;
  const answersText = Object.values(doc?.answers || {}).filter(Boolean).join("\n");
  const rest = applied.master.suggestions;
  const checked = finishMaster({ ...applied.master, suggestions: undefined }, verifiedFactsFor(facts), facts, { cvText: doc?.text_content || "", answersText, prefs: profile.preferences, edits, removed: meta.removed || [] });
  checked.master.suggestions = cleanSuggestions(checked.master, rest);
  await saveMaster(ctx, checked.master, checked.flags, !!masterRow?.ai, (masterRow?.model as string | null) ?? null, doc?.id ?? null, profile);
  await ctx.db.from("profiles").update({ career_meta: { ...meta, edits } }).eq("id", ctx.userId);
  return { message: "Changed on your CV." };
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
}

/** The user confirms (or removes) a CV fact we could not find in their CV text. */
export async function reviewFact(ctx: Ctx, factId: string, keep: boolean) {
  if (keep) {
    // The same role already on the CV (same title and dates): confirming must not add it twice.
    const facts = await loadFacts(ctx.db, ctx.userId);
    const f = facts.find((x) => x.id === factId);
    const key = (d: Record<string, unknown>) => [d.title, d.start, d.end].map((v) => String(v ?? "").trim().toLowerCase()).join("|");
    if (f?.kind === "experience" && facts.some((x) => x.id !== factId && x.kind === "experience" && x.verified && key(x.data) === key(f.data))) keep = false;
  }
  if (keep) await ctx.db.from("career_facts").update({ verified: true }).eq("id", factId).eq("user_id", ctx.userId);
  else await ctx.db.from("career_facts").delete().eq("id", factId).eq("user_id", ctx.userId);
}
