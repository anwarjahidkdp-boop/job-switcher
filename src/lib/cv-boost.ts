// "Strengthen my CV": like a professional CV writer, ask the person for the results behind each recent role (how many,
// how much, how fast), then write their answers into that role's bullets. Numbers only ever come from the CV or the
// person's own answers. The questions and answers are kept on the CV document, so every later rebuild keeps them too.
import { isMeasurable } from "./cv/render";
import type { CvQuestion, MasterCV } from "./types";

export const BOOST_PREFIX = "ach_";
export const MAX_BOOST_QUESTIONS = 6;
/** Countries where the button is offered (the UK launch first). */
export const boostOffered = (country: string) => country === "GB";

/** Only the most recent roles are asked about (the ones a recruiter reads first). */
export const BOOST_ROLES = 4;
/** The role (index in the Master CV's experience) a stored question is about, from its id. */
export const boostRole = (id: string): number | null => { const m = id.match(/_r(\d+)$/); return m ? Number(m[1]) : null; };
export const isBoostQuestion = (q: Pick<CvQuestion, "id">) => q.id.startsWith(BOOST_PREFIX);

export interface BoostStatus { asked: CvQuestion[]; answered: number; results: number; roles: number }
/** Where the person is: open questions waiting for answers, how many were answered, and results already on the CV. */
export function boostStatus(questions: CvQuestion[] | null | undefined, answers: Record<string, string> | null | undefined, m: MasterCV): BoostStatus {
  const qs = (questions || []).filter(isBoostQuestion);
  const a = answers || {};
  return {
    asked: qs.filter((q) => !String(a[q.id] || "").trim()),
    answered: qs.filter((q) => String(a[q.id] || "").trim()).length,
    results: (m.experience || []).reduce((n, e) => n + (e.bullets || []).filter(isMeasurable).length, 0),
    roles: (m.experience || []).length,
  };
}

/** Model questions -> stored questions: known roles only, short, deduplicated, ids that never clash with earlier rounds. */
export function cleanBoostQuestions(raw: { role: number; question: string; placeholder: string; suggestions: string[] }[], m: MasterCV, stamp: string): (CvQuestion & { role: number })[] {
  const seen = new Set<string>();
  return (raw || [])
    .filter((q) => Number.isInteger(q.role) && q.role >= 0 && q.role < Math.min(BOOST_ROLES, (m.experience || []).length) && String(q.question || "").trim().length >= 10)
    .filter((q) => { const k = q.question.trim().toLowerCase(); return !seen.has(k) && !!seen.add(k); })
    .slice(0, MAX_BOOST_QUESTIONS)
    .map((q, i) => ({
      id: `${BOOST_PREFIX}${stamp}_${i + 1}_r${q.role}`, role: q.role, question: q.question.trim().slice(0, 300), placeholder: String(q.placeholder || "").trim().slice(0, 120),
      suggestions: (q.suggestions || []).map((x) => String(x).trim()).filter((x) => x && x.length <= 60).slice(0, 4),
    }));
}

/** Every number written in a text: "1,200", "35%", "£4.5m" -> "1200", "35", "4.5". */
export const numbersIn = (s: string) => (s.match(/\d[\d,]*(\.\d+)?/g) || []).map((n) => n.replace(/,/g, "")).map((n) => n.replace(/\.0+$/, ""));

/**
 * Writes the rewritten bullets into the Master CV. A bullet with a number that appears neither in the CV nor in the
 * person's answers is dropped (the model must never invent a figure); a role whose new bullets were all dropped keeps
 * its old ones. Returns the new CV and how many bullets now show a result.
 */
export function applyBoost(m: MasterCV, roles: { role: number; bullets: string[] }[], answersText: string): { master: MasterCV; changed: number; dropped: number } {
  const known = new Set([...numbersIn(JSON.stringify(m)), ...numbersIn(answersText)]);
  let changed = 0, dropped = 0;
  const experience = (m.experience || []).map((e, i) => {
    const r = roles.find((x) => x.role === i);
    if (!r) return e;
    const ok = (r.bullets || []).map((b) => String(b || "").trim()).filter(Boolean).filter((b) => {
      const good = numbersIn(b).every((n) => known.has(n));
      if (!good) dropped++;
      return good;
    }).slice(0, 10);
    if (!ok.length || ok.join("\n") === (e.bullets || []).join("\n")) return e;
    changed++;
    return { ...e, bullets: ok };
  });
  return { master: { ...m, experience }, changed, dropped };
}
