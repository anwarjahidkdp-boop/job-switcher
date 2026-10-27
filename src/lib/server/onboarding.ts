import { localSearchAnswers } from "../application-defaults";
import { fillPersonalFromCv } from "../cv/personal-read";
import { setupRequirements,validBirthDate } from "../eligibility";
import type { AnswerLibrary } from "../career-safety";
import { refreshCareerMatches } from "./matches";
// Onboarding: CV upload -> extraction -> grounded facts -> questions -> preferences -> Master CV.
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { cc, rule, type CountryCode } from "../countries";
import { answerSkillFacts, appearsIn, buildMatchProfile, groundExtraction, verifiedOnly, type CareerFact, type CareerMeta, type RemovedItem } from "../facts";
import { dropRemoved, EditRefused, MAX_EDITS_KEPT } from "../cv-edit";
import { checkMasterCv } from "../numbers-check";
import { EXTRACT_PROMPT, MASTER_PROMPT, OCR_PROMPT, OCR_SYSTEM, SYSTEM_RULES } from "../prompts";
import { ExtractionSchema, MasterBuildSchema } from "../ai/schemas";
import { aiConfigured, checkBudget, getBudget, runAI } from "../ai";
import { AIError } from "../ai/provider";
import { DEMO_CV_TEXT, DEMO_EXTRACT, DEMO_MASTER } from "../demo";
import { MAX_CV_TEXT, MIME, MIN_CV_CHARS, CvReadError, sniffImage, sniffKind, tidy } from "../cv/sniff";
import { CATEGORIES, INDUSTRY_LIST, isSeniority, normSkill } from "../taxonomy";
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
  if(code!==prev.target_country){patch.answer_library={...prev.answer_library,birthDate:prev.answer_library?.birthDate||prev.personal?.dob||null,expectedSalary:null,salaryNegotiable:false,salaryCountry:code,currentSalaryCountry:prev.answer_library?.currentSalaryCountry||prev.target_country,workAuthorization:"unknown",sponsorshipRequired:null,willingToRelocate:null};patch.deal_breakers={...prev.deal_breakers,minSalary:null,minSalarySet:false};}
  if (prev.onboarding_step === "country") { patch.onboarding_step = "upload"; patch.cv_style = { tpl: rule(code).tpl }; }
  // The database resets country-specific setup atomically, including direct REST updates.
  const { error } = await ctx.db.from("profiles").update(patch).eq("id", ctx.userId);
  if (error) throw error;
}

/** At most 4 short, distinct tap-to-fill answers. */
export function cleanAnswerChoices(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const seen = new Set<string>();
  return v.map((x) => String(x ?? "").trim()).filter((x) => x && x.length <= 80 && !seen.has(x.toLowerCase()) && seen.add(x.toLowerCase())).slice(0, 4);
}

function cleanExtraction(x: Extraction): Extraction {
  return {
    ...x,
    industries: (x.industries || []).map((s) => s.toLowerCase()).filter((s) => INDUSTRY_LIST.includes(s)),
    categories: (x.categories || []).filter((c) => CATEGORIES.includes(c)).slice(0, 2),
    seniority: isSeniority(x.seniority) ? x.seniority : "mid",
    skills: (x.skills || []).map(normSkill),
    questions: (x.questions || []).slice(0, 5).map((q, i) => ({ id: `q${i + 1}`, question: String(q.question || ""), placeholder: String(q.placeholder || ""), suggestions: cleanAnswerChoices(q.suggestions) })).filter((q) => q.question),
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
      extraction, questions: questions.map(({ id, question, placeholder, suggestions }) => ({ id, question, placeholder, suggestions: suggestions || [] })), is_demo: !!input.demo,
      answers: input.demo ? Object.fromEntries(questions.map((q) => [q.id, q.demo || ""])) : {},
    },
    p_facts: facts,
    p_profile: {
      full_name: extraction.name || profile.full_name, phone: extraction.phone, city: extraction.location,
      career_meta: { ...(profile.career_meta?.guided_setup ? {guided_setup:true} : {}), industries: extraction.industries, categories: extraction.categories, seniority: extraction.seniority, target_roles: extraction.target_roles, location: extraction.location },
    },
  });
  if (error) throw error;
  const personal=fillPersonalFromCv(profile.personal,text);
  if(JSON.stringify(personal)!==JSON.stringify(profile.personal||{})){const saved=await ctx.db.from("profiles").update({personal}).eq("id",ctx.userId);if(saved.error)throw saved.error;}

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
  const { data: doc,error:docError } = await ctx.db.from("cv_documents").select("id, questions, text_content, is_demo").eq("user_id", ctx.userId).eq("is_current", true).maybeSingle();
  if(docError)throw docError;
  if (!doc) throw new Error("Upload a CV first.");
  const qs = (doc.questions || []) as CvQuestion[];
  const clean: Record<string, string> = {};
  for (const q of qs) clean[q.id] = String(answers[q.id] || "").trim().slice(0, 1000);
  const answerFacts=qs.filter(q=>clean[q.id]).map(q=>({kind:"answer" as const,provenance:"answer" as const,verified:true,data:{questionId:q.id,question:q.question,answer:clean[q.id]}}));
  // Save the answers first: a slow or failed AI step below must never lose what the person typed.
  const saved=await ctx.db.rpc("save_cv_answers",{p_document:doc.id,p_answers:clean,p_facts:answerFacts,p_extraction:null});
  if(saved.error)throw saved.error;
  if(!doc.is_demo&&(clean.fresh_role||clean.fresh_new)){
    try{
      const profile=await loadProfile(ctx.db,ctx.userId);
      const source=String(doc.text_content||"")+"\nUser-confirmed updates (supersede older CV details):\n"+qs.filter(q=>clean[q.id]).map(q=>q.question+"\n"+clean[q.id]).join("\n");
      const result=await runAI(ctx.admin,ctx.userId,"cv_extract",p=>p.generateJSON({tier:"fast",system:SYSTEM_RULES,prompt:EXTRACT_PROMPT(source,cc(profile?.target_country))+"\nApply the user's explicit corrections to previous roles and include newly confirmed roles and qualifications. Never guess missing months or dates.",schema:ExtractionSchema}));
      const extraction:Extraction=cleanExtraction(result.data as Extraction);
      const facts:CareerFact[]=groundExtraction(extraction,source).map(f=>({...f,provenance:"answer" as const}));
      const again=await ctx.db.rpc("save_cv_answers",{p_document:doc.id,p_answers:clean,p_facts:[...facts,...answerFacts],p_extraction:extraction});
      if(again.error)throw again.error;
    }catch(e){
      // The answers are saved and still reach the CV writer; only the re-read of older roles is skipped.
      console.error("Re-reading the CV with the update answers failed", e);
    }
  }
}

const num = (v: unknown) => (v === "" || v == null || !Number.isFinite(Number(v)) ? null : Math.max(0, Number(v)));
export async function savePreferences(ctx: Ctx, prefs: Partial<Preferences>, personal: PersonalDetails | null, destination?: { country: string; revision: number; needsVisa?: boolean },readiness?:Partial<AnswerLibrary>, excludedCompanies?:string[]) {
  const p: Preferences = {
    roles: String(prefs.roles || "").slice(0, 500), locations: String(prefs.locations || "").slice(0, 300),
    salaryMin: num(prefs.salaryMin), salaryMax: num(prefs.salaryMax), notice: num(prefs.notice),
    mode: (["On-site", "Hybrid", "Remote", "Any"] as const).includes(prefs.mode as Preferences["mode"]) ? (prefs.mode as Preferences["mode"]) : "On-site",
  };
  const existing=await loadProfile(ctx.db,ctx.userId);
  if(!existing)throw new Error("Profile missing");
  const country=destination?.country||existing.target_country;
  const autoProfile=buildMatchProfile({name:existing.full_name||"",facts:await loadFacts(ctx.db,ctx.userId)||[],meta:{...DEFAULT_META,...existing.career_meta},prefs:null,country});
  p.roles=p.roles.trim()||autoProfile.targetRoles.join(", ");
  const answers=localSearchAnswers({...existing.answer_library,...readiness,expectedSalary:p.salaryMin,salaryNegotiable:false,salaryCountry:country,noticeDays:p.notice,birthDate:personal?.dob||readiness?.birthDate||existing.answer_library?.birthDate||existing.personal?.dob||null},country,existing.home_country);
  if(answers.birthDate&&!validBirthDate(answers.birthDate))throw new Error("Enter a valid date of birth.");
  const missing=setupRequirements({target_country:country,home_country:existing.home_country,preferences:p,personal,answer_library:answers});
  if(missing.length)throw new Error(`Complete required matching details: ${missing.join(", ")}.`);
  if(p.salaryMax!=null&&p.salaryMin!=null&&p.salaryMax<p.salaryMin)throw new Error("The upper expected salary must be at least your minimum.");
  const patch: Record<string, unknown> = { preferences: p,answer_library:answers };
  if(excludedCompanies!==undefined)patch.deal_breakers={...existing.deal_breakers,excludedCompanies:excludedCompanies.map(s=>s.trim().toLowerCase()).filter(Boolean).slice(0,50),excludedCompaniesSet:true};
  if (personal) {
    const { data, error } = await ctx.db.from("profiles").select("personal").eq("id", ctx.userId).maybeSingle();
    if (error) throw error;
    patch.personal = mergePersonal((data?.personal as PersonalDetails | null) ?? null, personal);
  }
  patch.needs_visa = answers.sponsorshipRequired===true;
  let query = ctx.db.from("profiles").update(patch).eq("id", ctx.userId);
  if (destination) query = query.eq("target_country", destination.country).eq("search_country_version", destination.revision);
  const { data, error } = await query.select("id").maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Your job-search country changed. Reload and complete setup for the current country.");
  await refreshCareerMatches(ctx.admin,ctx.userId);
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
    const f = vf.experiences.find((x) => (appearsIn(x.company, e.company) || appearsIn(e.company, x.company)) && (appearsIn(x.title, e.title) || appearsIn(e.title, x.title)));
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
  await refreshCareerMatches(ctx.admin,ctx.userId);
}

/** Generate the Master CV from verified facts only, then run the deterministic post-checks. */
export async function buildMasterCv(ctx: Ctx) {
  const profile = await loadProfile(ctx.db, ctx.userId);
  if (!profile) throw new Error("profile missing");
  const missing=setupRequirements(profile);
  if(missing.length)throw new Error(`Complete required matching details before building your CV: ${missing.join(", ")}.`);
  const country: CountryCode = cc(profile.target_country);
  const { data: docRow, error: docError } = await ctx.db.from("cv_documents").select("id, text_content, questions, answers, is_demo, extraction").eq("user_id", ctx.userId).eq("is_current", true).maybeSingle();
  if (docError) throw docError;
  const doc = docRow as (CvDocRow & { extraction: Extraction | null }) | null;
  if (!doc) throw new Error("Upload a CV first.");
  // Country changes reuse the already improved CV. Country-specific rendering needs no paid AI call.
  if ((profile.onboarding_step === "prefs" && profile.search_country_version > 0) || metaOf(profile).manual_cv) {
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
  await refreshCareerMatches(ctx.admin,ctx.userId);
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
  await refreshCareerMatches(ctx.admin,ctx.userId);
}
