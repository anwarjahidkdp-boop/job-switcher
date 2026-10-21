// Deterministic post-checks on everything an AI model writes. Runs server-side on every
// generated Master CV and application pack. Ported from the prototype numbersCheck(), extended
// with employer and skill checks so generators cannot introduce facts the user never gave us.
import { appearsIn, skillGrounded } from "./facts";
import type { ApplicationPack, MasterCV } from "./types";

const UNIT: Record<string, number> = { k: 1e3, thousand: 1e3, lac: 1e5, lacs: 1e5, lakh: 1e5, lakhs: 1e5, m: 1e6, mn: 1e6, million: 1e6, crore: 1e7, crores: 1e7, cr: 1e7 };

/** "2 lacs" -> "200000 200,000": shorthand amounts written out, so a professional rewrite of them is not flagged. */
export function expandAmounts(text: string): string {
  const out: string[] = [];
  for (const m of text.matchAll(/(\d+(?:\.\d+)?)\s*(k|thousand|lacs?|lakhs?|mn|m|million|crores?|cr)\b/gi)) {
    const v = Math.round(Number(m[1]) * UNIT[m[2].toLowerCase()]);
    if (Number.isFinite(v)) out.push(String(v), v.toLocaleString("en-US"), v.toLocaleString("en-IN"));
  }
  return out.join(" ");
}

/** Numbers that appear in `texts` but nowhere in `sources`. */
export function unknownNumbers(texts: (string | null | undefined)[], sources: string): string[] {
  sources = sources + " " + expandAmounts(sources);
  const txt = texts.filter(Boolean).join(" ");
  const nums = [...new Set((txt.match(/\d[\d,.]*/g) || []).map((n) => n.replace(/[.,]+$/, "")))].filter(Boolean);
  return nums.filter((n) => !sources.includes(n) && !sources.includes(n.replace(/,/g, "")));
}

export function numbersFlag(bad: string[]): string[] {
  return bad.length ? [`the number${bad.length > 1 ? "s" : ""} ${bad.join(", ")} ${bad.length > 1 ? "do" : "does"} not appear in your profile`] : [];
}

/** Prototype-equivalent pack check: numbers in the pack must come from the master CV, the job, the preferences or today's date. */
export function packNumbersCheck(pack: Pick<ApplicationPack, "summary" | "top_bullets" | "cover_letter" | "email_body">, src: { master: unknown; job: unknown; prefs: unknown; today: string }): string[] {
  const sources = JSON.stringify(src.master) + JSON.stringify(src.job || {}) + JSON.stringify(src.prefs || {}) + src.today;
  return numbersFlag(unknownNumbers([pack.summary, ...(pack.top_bullets || []), pack.cover_letter, pack.email_body], sources));
}

const lc = (s: string) => s.toLowerCase().trim();

/**
 * Enforce the "verified facts only" rule on a generated pack:
 * - skills_order may only contain Master CV skills (anything else is dropped and flagged)
 * - numbers must exist in the sources (flagged for the user before sending)
 */
export function checkPack(pack: ApplicationPack, master: MasterCV, src: { job: unknown; prefs: unknown; today: string }): { pack: ApplicationPack; flags: string[] } {
  const flags: string[] = [];
  const masterSkills = [...(master.skills_core || []), ...(master.skills_tools || [])];
  const known = new Map(masterSkills.map((s) => [lc(s), s]));
  const ordered: string[] = [];
  const dropped: string[] = [];
  for (const s of pack.skills_order || []) {
    const hit = known.get(lc(s));
    if (hit && !ordered.includes(hit)) ordered.push(hit);
    else if (!hit) dropped.push(s);
  }
  for (const s of masterSkills) if (!ordered.includes(s)) ordered.push(s);
  if (dropped.length) flags.push(`removed skills not in your verified profile: ${dropped.join(", ")}`);
  const clean: ApplicationPack = { ...pack, skills_order: ordered };
  flags.push(...packNumbersCheck(clean, { master, ...src }));
  return { pack: clean, flags };
}

/**
 * Check a generated Master CV against the source material (CV text + the person's answers + verified fact data):
 * - every employer must be one of the verified experience facts
 * - every listed skill must be grounded in the sources
 * - every number must appear in the sources
 */
export function checkMasterCv(m: MasterCV, sources: { cvText: string; answersText: string; verifiedCompanies: string[]; verifiedSkills: string[]; extra?: string }): { master: MasterCV; flags: string[] } {
  const flags: string[] = [];
  const srcText = sources.cvText + "\n" + sources.answersText + "\n" + (sources.extra || "");
  const experience = (m.experience || []).filter((e) => {
    const ok = sources.verifiedCompanies.some((c) => appearsIn(c, e.company) || appearsIn(e.company, c));
    if (!ok) flags.push(`removed an employer that is not in your verified profile: ${e.company}`);
    return ok;
  });
  const verifiedSkillSet = new Set(sources.verifiedSkills.map(lc));
  const keepSkill = (s: string) => verifiedSkillSet.has(lc(s)) || skillGrounded(s, srcText);
  const core = (m.skills_core || []).filter(keepSkill);
  const tools = (m.skills_tools || []).filter(keepSkill);
  const droppedSkills = [...(m.skills_core || []), ...(m.skills_tools || [])].filter((s) => !keepSkill(s));
  if (droppedSkills.length) flags.push(`removed skills not found in your CV or answers: ${droppedSkills.join(", ")}`);
  const certifications = (m.certifications || []).filter((c) => {
    const ok = appearsIn(c, srcText, "any");
    if (!ok) flags.push(`removed a qualification not found in your CV: ${c}`);
    return ok;
  });
  const master: MasterCV = { ...m, experience, skills_core: core, skills_tools: tools, certifications };
  const texts = [master.summary, master.headline, ...master.experience.flatMap((e) => e.bullets || []), ...(master.education || []), ...certifications];
  flags.push(...numbersFlag(unknownNumbers(texts, srcText)));
  return { master, flags };
}
