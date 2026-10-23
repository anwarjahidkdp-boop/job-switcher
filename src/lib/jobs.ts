// Job normalisation: DB row <-> Job, AI output -> Job, and a deterministic text normaliser
// used by ingestion (no AI cost) and as a fallback when AI is unavailable.
import { cc, rule, type CountryCode } from "./countries";
import { addDaysTo } from "./dates";
import { CATEGORIES, INDUSTRY_LIST, isEduLevel, isSeniority, normSkill, roleHead, SKILL_ALIAS, VOCAB, type EduLevel, type Seniority } from "./taxonomy";
import type { ApplyMethod, Job, JobCert } from "./types";
import type { SampleJobRaw } from "./demo";
import type { PastedJobOut } from "./ai/schemas";

export interface JobRow {
  id: string; owner_id: string | null; source_id?: string | null; source_kind: string; source_label: string; external_id?: string | null;
  country: string; title: string; company: string; industry: string | null; category: string | null; location: string | null;
  employment_type: string | null; salary_min: number | string | null; salary_max: number | string | null; min_years: number | string | null; max_years: number | string | null;
  seniority: string | null; education: { level?: string | null; field?: string } | null; required_skills: string[] | null; preferred_skills: string[] | null;
  certs: JobCert[] | null; visa_sponsorship: boolean | null; deadline: string | null; published_at: string | null;
  apply_method: string | null; apply_target: string | null; url: string | null; responsibilities: string[] | null; description?: string | null; is_sample?: boolean | null;
}

const num = (v: unknown): number | null => (v == null || v === "" || isNaN(Number(v)) ? null : Number(v));
const applyMethod = (m: unknown): ApplyMethod => (m === "email" || m === "portal" ? m : "unknown");

export function rowToJob(r: JobRow): Job {
  const edu = r.education && isEduLevel(r.education.level) ? { level: r.education.level, field: String(r.education.field || "").toLowerCase() } : null;
  return {
    id: r.id, country: cc(r.country), title: r.title, company: r.company, industry: r.industry, category: r.category, location: r.location,
    type: r.employment_type, salaryMin: num(r.salary_min), salaryMax: num(r.salary_max), minYears: num(r.min_years), maxYears: num(r.max_years),
    seniority: isSeniority(r.seniority) ? r.seniority : null, education: edu,
    required: (r.required_skills || []).map(normSkill), preferred: (r.preferred_skills || []).map(normSkill),
    certs: (r.certs || []).filter((c) => c && Array.isArray(c.names) && c.names.length),
    visa: r.visa_sponsorship, deadline: r.deadline, publishedAt: r.published_at,
    apply: { method: applyMethod(r.apply_method), target: r.apply_target }, url: r.url, source: r.source_label,
    resp: r.responsibilities || [], isSample: !!r.is_sample, ownerId: r.owner_id,
  };
}

export type JobInsert = Omit<JobRow, "id"> & { id?: string; raw?: unknown; description?: string | null };

export function jobToRow(j: Omit<Job, "id"> & { id?: string }, extra: { owner_id: string | null; source_kind: string; source_id?: string | null; external_id?: string | null; description?: string | null; raw?: unknown }): JobInsert {
  return {
    ...(j.id ? { id: j.id } : {}),
    owner_id: extra.owner_id, source_id: extra.source_id ?? null, source_kind: extra.source_kind, source_label: j.source, external_id: extra.external_id ?? null,
    country: j.country, title: j.title.slice(0, 300), company: (j.company || "Company not stated").slice(0, 300), industry: j.industry, category: j.category, location: j.location,
    employment_type: j.type, salary_min: j.salaryMin, salary_max: j.salaryMax, min_years: j.minYears, max_years: j.maxYears, seniority: j.seniority,
    education: j.education, required_skills: j.required, preferred_skills: j.preferred, certs: j.certs, visa_sponsorship: j.visa,
    deadline: j.deadline, published_at: j.publishedAt, apply_method: j.apply.method, apply_target: j.apply.target, url: j.url,
    responsibilities: j.resp.slice(0, 8), description: extra.description ?? null, is_sample: !!j.isSample, raw: extra.raw ?? null,
  };
}

const isoDate = (s: unknown): string | null => (typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null);

/** AI-structured job post -> Job (prototype pasteJob mapping). */
export function aiJobToJob(j: PastedJobOut & { url?: string | null }, ctx: { country: CountryCode; source: string; url?: string | null; today: string }): Omit<Job, "id"> {
  return {
    country: ctx.country, title: j.title, company: j.company, industry: j.industry && INDUSTRY_LIST.includes(j.industry.toLowerCase()) ? j.industry.toLowerCase() : j.industry,
    category: j.category && CATEGORIES.includes(j.category) ? j.category : j.category || "Other", location: j.location, type: j.type,
    salaryMin: num(j.salaryMin), salaryMax: num(j.salaryMax), minYears: num(j.minYears), maxYears: num(j.maxYears),
    seniority: isSeniority(j.seniority) ? j.seniority : null,
    education: j.education && isEduLevel(j.education.level) ? { level: j.education.level, field: (j.education.field || "").toLowerCase() } : null,
    required: (j.required || []).map(normSkill), preferred: (j.preferred || []).map(normSkill),
    certs: (j.certs || []).filter((c) => c && c.names && c.names.length).map((c) => ({ names: c.names.map((n) => n.toUpperCase()), required: !!c.required })),
    visa: j.visa ?? null, deadline: isoDate(j.deadline), publishedAt: ctx.today,
    apply: { method: applyMethod(j.apply?.method), target: j.apply?.target || null }, url: ctx.url ?? j.url ?? null, source: ctx.source, resp: (j.resp || []).slice(0, 5),
  };
}

export function sampleToJob(s: SampleJobRaw, today: string): Job {
  return {
    id: s.id, country: cc(s.country || "BD"), title: s.title, company: s.company, industry: s.industry, category: s.category, location: s.location, type: s.type,
    salaryMin: s.salaryMin, salaryMax: s.salaryMax, minYears: s.minYears, maxYears: s.maxYears ?? null, seniority: isSeniority(s.seniority) ? s.seniority : null,
    education: isEduLevel(s.education.level) ? { level: s.education.level, field: s.education.field } : null, required: s.required, preferred: s.preferred, certs: s.certs,
    visa: s.visa ?? null, deadline: addDaysTo(today, s.dl), publishedAt: addDaysTo(today, s.posted), apply: s.apply, url: null, source: s.source, resp: s.resp, isSample: true,
  };
}

// ---------------------------------------------------------------------------
// Deterministic normaliser (no AI)
// ---------------------------------------------------------------------------
export function stripHtml(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|li|div|h\d|tr)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "\n- ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&#(x[0-9a-f]+|\d+);/gi,(all,n:string)=>{const code=n[0].toLowerCase()==="x"?parseInt(n.slice(1),16):Number(n);return code>0&&code<=0x10ffff?String.fromCodePoint(code):all;})
    .replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export function skillsInText(text: string): string[] {
  const t = " " + text.toLowerCase().replace(/[^a-z0-9&.+#\s/-]/g, " ").replace(/\s+/g, " ") + " ";
  const found = new Set<string>();
  for (const v of VOCAB) if (new RegExp(`[^a-z]${esc(v)}[^a-z]`).test(t)) found.add(v);
  for (const [alias, target] of Object.entries(SKILL_ALIAS)) if (alias.length >= 3 && new RegExp(`[^a-z]${esc(alias)}[^a-z]`).test(t)) found.add(target);
  return [...found];
}

/** Spoken languages a job can ask for; skill names are lower case like the rest of the vocabulary. */
export const LANGUAGES = ["german", "french", "italian", "spanish", "dutch", "portuguese", "polish", "swedish", "danish", "norwegian", "finnish", "arabic", "japanese", "korean", "mandarin", "turkish", "czech", "greek", "hebrew"];
const NATIVE_NAME: Record<string, string> = { deutsch: "german", "français": "french", francais: "french", italiano: "italian", "español": "spanish", nederlands: "dutch" };
const LANG_RE = `(${[...LANGUAGES, ...Object.keys(NATIVE_NAME)].join("|")})`;
const LEVEL = "(fluent|fluency|native|proficient|proficiency|business[- ]level|business[- ]fluent|excellent|strong|very good|good|working knowledge|verhandlungssicher|fließend|c1|c2|b2)";
/** Languages a job requires: "fluent German", "Italian (C1) required", or an ad written in German itself. English is assumed. */
export function languagesRequired(text: string): string[] {
  const low = text.toLowerCase();
  const out = new Set<string>();
  const add = (w: string) => out.add(NATIVE_NAME[w] || w);
  for (const m of low.matchAll(new RegExp(`\\b${LEVEL}\\b[^.\\n]{0,40}?\\b${LANG_RE}\\b`, "g"))) add(m[2]);
  for (const m of low.matchAll(new RegExp(`\\b${LANG_RE}\\b[^.\\n]{0,30}?\\b(required|is a must|mandatory|essential|${LEVEL.slice(1, -1)}|speaking|skills)\\b`, "g"))) add(m[1]);
  // An ad written in German or Italian expects that language even when it does not say so.
  const words = low.split(/[^a-zäöüßàèéìòù]+/);
  const share = (list: string[]) => words.filter((w) => list.includes(w)).length / Math.max(words.length, 1);
  if (share(["und", "wir", "für", "mit", "sie", "die", "der", "das", "ihre", "bei"]) > 0.06) out.add("german");
  if (share(["e", "il", "di", "per", "con", "che", "la", "dei", "della", "nel"]) > 0.08) out.add("italian");
  return [...out];
}

export function seniorityFromTitle(title: string): Seniority | null {
  const t = title.toLowerCase();
  if (/\b(head|director|chief|vp|vice president|cfo|cto|gm|general manager)\b/.test(t)) return "head";
  if (/\bmanager\b/.test(t) && !/\b(assistant|asst\.?)\s+manager\b/.test(t)) return "manager";
  if (/\b(senior|sr\.?|lead|principal|assistant manager|asst\.? manager|supervisor|specialist)\b/.test(t)) return "senior";
  if (/\b(intern|trainee|junior|jr\.?|graduate|entry)\b/.test(t)) return "entry";
  if (/\b(executive|officer|associate|analyst|engineer|accountant|administrator|developer)\b/.test(t)) return "mid";
  return null;
}

const CERT_NAMES = ["ACCA", "CIMA", "CMA", "CPA", "CA", "CFA", "PMP", "SHRM", "CIPD"];

export function normaliseJobText(input: { title: string; company: string; text: string; country: CountryCode; location?: string | null; type?: string | null; url?: string | null; source: string; deadline?: string | null; publishedAt?: string | null; salaryMin?: number | null; salaryMax?: number | null; applyEmail?: string | null; today: string }): Omit<Job, "id"> {
  const text = input.text;
  const low = text.toLowerCase();
  // Recruitment pages often put an age limit before work experience. Age is never career tenure.
  const experienceText = low.replace(/\baged?\s*:?\s*(?:between\s+|from\s+|at least\s+|at most\s+|not more than\s+)?\d{1,2}(?:\s*(?:to|-|–|and)\s*\d{1,2})?\s*(?:years?|yrs?)(?:\s+old)?/g, " ");
  const yrs = experienceText.match(/\b(\d{1,2})\s*(?:\+|(?:-|–|to)\s*(\d{1,2}))?\s*(?:\+\s*)?years?/);
  const minYears = yrs ? Number(yrs[1]) : null;
  const maxYears = yrs && yrs[2] ? Number(yrs[2]) : null;
  const edu = /\b(phd|doctorate)\b/.test(low) ? "phd" : /\b(master'?s|mba|m\.?sc|m\.?com)\b/.test(low) ? "masters" : /\b(bachelor'?s|bba|b\.?sc|b\.?com|graduate degree|degree in)\b/.test(low) ? "bachelors" : /\bdiploma\b/.test(low) ? "diploma" : null;
  const fieldM = low.match(/(?:degree|bachelor'?s|master'?s|mba|bba)[^.\n]{0,30}?\b(accounting|finance|business|computer science|engineering|marketing|human resources|economics)\b/);
  const certs: JobCert[] = [];
  const certHits = CERT_NAMES.filter((c) => new RegExp(`\\b${c}\\b`).test(text));
  if (certHits.length) {
    const required = /\b(must|required|mandatory|essential)\b[^.\n]{0,60}\b(ACCA|CIMA|CMA|CPA|CA|CFA|PMP|SHRM|CIPD)\b|\b(ACCA|CIMA|CMA|CPA|CA|CFA|PMP|SHRM|CIPD)\b[^.\n]{0,30}\b(required|mandatory|is a must)\b/.test(text);
    certs.push({ names: certHits, required });
  }
  const visa = /no (visa )?sponsorship|not (able|in a position) to (offer|provide) (visa )?sponsorship|local candidates only|must have (the )?right to work|unable to sponsor/.test(low)
    ? false : /visa (sponsorship|will be provided|provided)|sponsorship (is )?available|we (will )?sponsor|relocation and visa/.test(low) ? true : null;
  const email = input.applyEmail ?? (text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || null);
  const preferredBlock = low.split(/preferred|nice to have|desirable|bonus|advantage/)[1] || "";
  const allSkills = skillsInText(text);
  const preferred = preferredBlock ? skillsInText(preferredBlock).filter((s) => !skillsInText(low.split(/preferred|nice to have|desirable|bonus|advantage/)[0]).includes(s)) : [];
  const required = [...allSkills.filter((s) => !preferred.includes(s)), ...languagesRequired(text).filter((l) => !allSkills.includes(l))];
  const resp = text.split(/\n/).map((l) => l.replace(/^[-•*\d.)\s]+/, "").trim()).filter((l) => l.length > 25 && l.length < 180).slice(0, 3);
  const industry = INDUSTRY_LIST.find((i) => low.includes(i)) || null;
  // A literal labelled date is source evidence, including common employer dates such as 31 Oct 2026.
  const humanDeadline=text.match(/(?:deadline|apply (?:by|before)|closing date)[:\s]*(\d{1,2})[\s-]+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)[\s,-]+(\d{4})\b/i);
  let labelledDate:string|null=null;
  if(humanDeadline){const day=Number(humanDeadline[1]),month=["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"].indexOf(humanDeadline[2].slice(0,3).toLowerCase()),year=Number(humanDeadline[3]);const d=new Date(Date.UTC(year,month,day));if(d.getUTCDate()===day&&d.getUTCMonth()===month)labelledDate=d.toISOString().slice(0,10);}
  const deadlineM = !input.deadline ? text.match(/(?:deadline|apply (?:by|before)|closing date)[:\s]*(\d{4}-\d{2}-\d{2})/i) : null;
  return {
    country: input.country, title: input.title, company: input.company, industry, category: guessCategory(input.title, allSkills),
    location: input.location ?? null, type: input.type ?? null, salaryMin: input.salaryMin ?? null, salaryMax: input.salaryMax ?? null,
    minYears, maxYears, seniority: seniorityFromTitle(input.title),
    education: edu ? { level: edu as EduLevel, field: fieldM ? fieldM[1] : "" } : null,
    required, preferred, certs, visa, deadline: input.deadline ?? (deadlineM ? deadlineM[1] : labelledDate), publishedAt: input.publishedAt ?? input.today,
    apply: email ? { method: "email", target: email } : { method: input.url ? "portal" : "unknown", target: null }, url: input.url ?? null, source: input.source, resp,
  };
}

// Read from the role part of the title first (see roleHead), in this order: "Customer Experience Representative,
// Trump Accounts" is customer service and "Account Executive" is sales, not finance.
const TITLE_HINTS: [string, RegExp][] = [
  ["IT", /\b(software|developer|engineer|engineering|programmer|devops|sre|architect|data scientist|data engineer|machine learning|frontend|backend|full[- ]?stack|qa|tester|it support|sysadmin|web designer)\b/],
  ["Customer Service", /customer (service|support|experience|success|care)|support (specialist|agent|associate)|call cent|help ?desk/],
  ["Sales", /\b(sales|account (manager|executive|director|representative|lead)|business development|bdr|sdr|representative|partnerships?|partner (manager|development)|territory|seller)\b/],
  ["Finance & Accounting", /\b(accountant|accounting|accounts|finance|financial|audit|auditor|tax|treasury|treasurer|fp&a|controller|comptroller|bookkeep\w*|ledger|payable|receivable|billing|cfo|credit analyst)\b/],
  ["HR", /\b(hr|human resources|talent|recruit\w*|payroll|people (partner|operations)|compensation)\b/],
  ["Marketing", /marketing|brand|seo|content|communications|digital/],
  ["Supply Chain", /supply chain|procurement|logistics|merchandis|sourcing|inventory|warehouse/],
  ["Education", /\b(teacher|lecturer|tutor|instructor|professor|teaching)\b/],
  ["Administration", /\b(admin|administrator|administrative|facilities|office manager|receptionist)\b/],
];
const SKILL_HINTS: [string, RegExp][] = [
  ["Finance & Accounting", /account|finance|financial|audit|tax|treasury|fp&a|controller|ledger|payable|receivable/],
  ["HR", /\bhr\b|human resources|talent|recruit|payroll|people|compensation/],
  ["Marketing", /marketing|brand|seo|content|communications|digital/],
  ["Supply Chain", /supply chain|procurement|logistics|merchandis|sourcing|inventory|warehouse/],
  ["IT", /software|developer|engineer|backend|frontend|devops|data|it\b|sql|node\.js/],
];
const hint = (rules: [string, RegExp][], s: string) => rules.find(([, re]) => re.test(s.toLowerCase()))?.[0];

/** Job category from its title (role part first, then the whole title), falling back to the skills it lists. */
export function guessCategory(title: string, skills: string[] = []): string {
  return hint(TITLE_HINTS, roleHead(title)) || hint(TITLE_HINTS, title) || (skills.length ? hint(SKILL_HINTS, skills.join(" ")) : undefined) || "Other";
}

export const currencyLabel = (c: CountryCode) => rule(c).sym.trim() || "local currency";
