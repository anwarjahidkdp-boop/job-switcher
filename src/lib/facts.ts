// Career facts with provenance. Every fact the generators may use lives here.
// Rule: generators and matching only ever see facts where verified === true.
import { closeEarlierRoles, newestExperienceFirst } from "./cv/experience";
import { yearsFrom } from "./matching";
import { cc, type CountryCode } from "./countries";
import { isEduLevel, isSeniority, normSkill, SKILL_ALIAS, type Seniority } from "./taxonomy";
import { LANGUAGES } from "./jobs";
import type { Extraction, ExtractedCert, ExtractedEducation, ExtractedExperience, MatchProfile, Preferences, Provenance } from "./types";

export type FactKind = "experience" | "education" | "certification" | "skill" | "language" | "answer";

export interface CareerFact<D = Record<string, unknown>> {
  id?: string;
  kind: FactKind;
  data: D;
  provenance: Provenance;
  verified: boolean;
  /** Short text from the source that supports the fact (for the user to review). */
  evidence?: string | null;
}

export interface CareerMeta {
  industries: string[];
  categories: string[];
  seniority: Seniority;
  target_roles: string[];
  location: string | null;
  /** Instructions from "Ask AI to change your CV", so a Master CV rebuild follows them too. Reset by a new CV. */
  edits?: string[];
  /** Manual edits are authoritative and can be reused without another AI rebuild. */
  manual_cv?: boolean;
  /** Items the person removed that way; the original CV text still has them. */
  removed?: RemovedItem[];
}

/** Something the person removed from their CV, by kind and a short label (employer, degree, name). */
export interface RemovedItem { kind: Exclude<FactKind, "answer">; label: string }

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9&+.#\s]/g, " ").replace(/\.(?![a-z0-9])/g, " ").replace(/\s+/g, " ").trim();
const STOP = new Set(["ltd", "limited", "plc", "inc", "llc", "the", "and", "of", "co", "company", "group", "bd", "pvt", "sdn", "bhd"]);
const sigWords = (s: string) => norm(s).split(" ").filter((w) => w.length >= 3 && !STOP.has(w));

/** Does `needle` (a short phrase) plausibly appear in `hay`? Lenient on word stems, strict on presence. */
export function appearsIn(needle: string, hay: string, mode: "all" | "any" = "all"): boolean {
  const h = " " + norm(hay) + " ";
  const n = norm(needle);
  if (!n) return false;
  if (h.includes(" " + n + " ") || h.includes(n)) return true;
  const words = sigWords(needle);
  if (!words.length) return false;
  const hit = (w: string) => h.includes(w.length > 5 ? w.slice(0, 5) : w);
  return mode === "all" ? words.every(hit) : words.some(hit);
}

const yearPresent = (ym: string | null | undefined, text: string) => !!ym && text.includes(ym.slice(0, 4));

export function skillGrounded(skill: string, text: string): boolean {
  const s = normSkill(skill);
  if (appearsIn(s, text, "any")) return true;
  return Object.entries(SKILL_ALIAS).some(([alias, target]) => target === s && appearsIn(alias, text, "all"));
}

/**
 * Turn an AI extraction into provenance-tagged facts, checking each against the CV text.
 * Facts we cannot find in the CV are kept but unverified (the user must confirm them),
 * and dates whose year is not in the CV are dropped rather than guessed.
 */
/** The reader sometimes writes "not specified in CV" or "N/A" instead of leaving a value empty: those are blanks, not values. */
export const PLACEHOLDER = /^\s*(not\s+(specified|stated|given|mentioned|available|provided|known)|unknown|n\/?a|none|null|-+)\b/i;
export const real = (v: unknown): string => (v == null || PLACEHOLDER.test(String(v)) ? "" : String(v).trim());

export function groundExtraction(x: Extraction, cvText: string): CareerFact[] {
  const out: CareerFact[] = [];
  for (const e of x.experiences || []) {
    if (!real(e.title) && !real(e.company)) continue;
    const data: ExtractedExperience = {
      title: real(e.title), company: real(e.company), industry: real(e.industry) ? real(e.industry).toLowerCase() : null,
      location: e.location ?? null,
      start: yearPresent(e.start, cvText) ? e.start : null,
      end: e.end && yearPresent(e.end, cvText) ? e.end : null,
    };
    // A date the CV does not contain is never kept; if one was dropped the role needs the user's confirmation
    // (otherwise a dropped end date would silently read as "Present").
    const datesOk = !(e.start && !data.start) && !(e.end && !data.end);
    const verified = datesOk && appearsIn(data.company, cvText) && appearsIn(data.title, cvText, "any");
    out.push({ kind: "experience", data: data as unknown as Record<string, unknown>, provenance: "cv", verified, evidence: verified ? data.company : null });
  }
  for (const ed of x.education || []) {
    const data: ExtractedEducation = { degree: real(ed.degree), field: real(ed.field), institution: real(ed.institution), year: ed.year && cvText.includes(String(ed.year)) ? String(ed.year) : "", level: isEduLevel(ed.level) ? ed.level : "bachelors", result: ed.result && appearsIn(ed.result, cvText) ? ed.result : null };
    const verified = appearsIn(data.degree, cvText, "any") || (!!data.institution && appearsIn(data.institution, cvText));
    out.push({ kind: "education", data: data as unknown as Record<string, unknown>, provenance: "cv", verified, evidence: verified ? data.degree : null });
  }
  for (const c of x.certifications || []) {
    const data: ExtractedCert = { name: String(c.name || ""), status: c.status === "partly" || c.status === "in_progress" ? c.status : "qualified", detail: c.detail && appearsIn(c.detail, cvText, "any") ? c.detail : null };
    const verified = appearsIn(data.name, cvText);
    out.push({ kind: "certification", data: data as unknown as Record<string, unknown>, provenance: "cv", verified, evidence: verified ? data.name : null });
  }
  for (const s of [...new Set((x.skills || []).map(normSkill))].filter(Boolean)) {
    const verified = skillGrounded(s, cvText);
    out.push({ kind: "skill", data: { name: s }, provenance: "cv", verified });
  }
  for (const l of x.languages || []) {
    const verified = appearsIn(l, cvText);
    out.push({ kind: "language", data: { name: String(l) }, provenance: "cv", verified });
  }
  return out;
}

export const verifiedOnly = <T extends CareerFact>(facts: T[]) => facts.filter((f) => f.verified);

/** Skills newly confirmed by the person's own answers (the Master CV step may suggest them; we keep only grounded ones). */
export function answerSkillFacts(extraSkills: string[], answersText: string, existing: Set<string>): CareerFact[] {
  return [...new Set(extraSkills.map(normSkill))]
    .filter((s) => s && !existing.has(s) && skillGrounded(s, answersText))
    .map((s) => ({ kind: "skill" as const, data: { name: s }, provenance: "answer" as const, verified: true }));
}

/** Build the matching profile from verified facts + preferences (prototype buildProfile). */
export function buildMatchProfile(input: { name: string; facts: CareerFact[]; meta: CareerMeta; prefs: Preferences | null; country: CountryCode | string }): MatchProfile {
  const v = verifiedOnly(input.facts);
  const exps = newestExperienceFirst(closeEarlierRoles(v.filter((f) => f.kind === "experience").map((f) => f.data as unknown as ExtractedExperience)));
  const edu = v.filter((f) => f.kind === "education").map((f) => f.data as unknown as ExtractedEducation);
  const certs = v.filter((f) => f.kind === "certification").map((f) => f.data as unknown as ExtractedCert);
  const skills: MatchProfile["skills"] = [];
  for (const f of v.filter((x) => x.kind === "skill")) {
    const name = normSkill((f.data as { name: string }).name);
    if (!skills.find((s) => s.name === name)) skills.push({ name, src: f.provenance });
  }
  // Languages count as skills so a job asking for "fluent German" can match ("German (B2)" -> "german").
  for (const f of v.filter((x) => x.kind === "language")) {
    const name = LANGUAGES.find((l) => String((f.data as { name: string }).name).toLowerCase().includes(l));
    if (name && !skills.find((s) => s.name === name)) skills.push({ name, src: f.provenance });
  }
  const p = input.prefs;
  const split = (s: string | undefined) => String(s || "").split(",").map((x) => x.trim()).filter(Boolean);
  const roles = split(p?.roles);
  const locs = split(p?.locations);
  const country = cc(input.country);
  return {
    name: input.name,
    titles: exps.map((e) => e.title),
    currentTitle: exps[0]?.title || "",
    currentCompany: exps[0]?.company || "",
    years: yearsFrom(exps),
    seniority: isSeniority(input.meta.seniority) ? input.meta.seniority : "mid",
    industries: (input.meta.industries || []).map((s) => String(s).toLowerCase()),
    categories: input.meta.categories || [],
    education: edu.map((e) => ({ degree: e.degree, field: e.field, level: e.level, institution: e.institution, year: e.year, result: e.result })),
    certs: certs.map((c) => ({ name: String(c.name), status: c.status || "qualified" })),
    skills,
    targetRoles: roles.length ? roles : input.meta.target_roles || [],
    locations: locs.length ? locs : country === "BD" ? [input.meta.location || "Dhaka"] : [],
    country,
    salaryMin: Number(p?.salaryMin) || null,
    salaryMax: Number(p?.salaryMax) || null,
    notice: p?.notice ? Number(p.notice) : null,
  };
}

/** Profile completeness meter (prototype completeness()). */
export function completeness(P: MatchProfile, answeredCount: number): number {
  let c = 40;
  if (P.skills.length >= 6) c += 15;
  if (P.salaryMin) c += 10;
  if (P.notice) c += 5;
  if (P.targetRoles.length) c += 10;
  c += Math.min(20, answeredCount * 5);
  return Math.min(100, c);
}
