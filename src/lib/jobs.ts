// Job normalisation: DB row <-> Job, AI output -> Job, and a deterministic text normaliser
// used by ingestion (no AI cost) and as a fallback when AI is unavailable.
import { cc, rule, type CountryCode } from "./countries";
import { addDaysTo } from "./dates";
import { CATEGORIES, INDUSTRY_LIST, isEduLevel, isSeniority, normSkill, SKILL_ALIAS, VOCAB, type EduLevel, type Seniority } from "./taxonomy";
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
  const yrs = low.match(/(\d{1,2})\s*(?:\+|-\s*(\d{1,2}))?\s*(?:\+\s*)?years?/);
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
  const required = allSkills.filter((s) => !preferred.includes(s));
  const resp = text.split(/\n/).map((l) => l.replace(/^[-•*\d.)\s]+/, "").trim()).filter((l) => l.length > 25 && l.length < 180).slice(0, 3);
  const industry = INDUSTRY_LIST.find((i) => low.includes(i)) || null;
  const deadlineM = !input.deadline ? text.match(/(?:deadline|apply (?:by|before)|closing date)[:\s]*(\d{4}-\d{2}-\d{2})/i) : null;
  return {
    country: input.country, title: input.title, company: input.company, industry, category: guessCategory(input.title + " " + allSkills.join(" ")),
    location: input.location ?? null, type: input.type ?? null, salaryMin: input.salaryMin ?? null, salaryMax: input.salaryMax ?? null,
    minYears, maxYears, seniority: seniorityFromTitle(input.title),
    education: edu ? { level: edu as EduLevel, field: fieldM ? fieldM[1] : "" } : null,
    required, preferred, certs, visa, deadline: input.deadline ?? (deadlineM ? deadlineM[1] : null), publishedAt: input.publishedAt ?? input.today,
    apply: email ? { method: "email", target: email } : { method: input.url ? "portal" : "unknown", target: null }, url: input.url ?? null, source: input.source, resp,
  };
}

const CATEGORY_HINTS: [string, RegExp][] = [
  ["Finance & Accounting", /account|finance|financial|audit|tax|treasury|fp&a|controller|ledger|payable|receivable/],
  ["HR", /\bhr\b|human resources|talent|recruit|payroll|people|compensation/],
  ["Marketing", /marketing|brand|seo|content|communications|digital/],
  ["Sales", /sales|business development|account manager|territory/],
  ["Supply Chain", /supply chain|procurement|logistics|merchandis|sourcing|inventory|warehouse/],
  ["IT", /software|developer|engineer|backend|frontend|devops|data|it\b|sql|node\.js/],
  ["Administration", /admin|facilities|office manager/],
  ["Customer Service", /customer service|support|call cent/],
];
export function guessCategory(s: string): string {
  const t = s.toLowerCase();
  return CATEGORY_HINTS.find(([, re]) => re.test(t))?.[0] || "Other";
}

export const currencyLabel = (c: CountryCode) => rule(c).sym.trim() || "local currency";
