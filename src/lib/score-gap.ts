// "21% missing · why?": what keeps one job's match under 100%, and what the person can do about it.
// It explains the SAME score the card shows (the live score from loadState, AI reading included) and adds nothing
// to it: the rule check's factor points, any hard cap, and the AI's own reason when the AI score is final.
// No AI call: everything comes from the match already computed for the page.
import { W, type Scored } from "./matching";
import { skillLabel } from "./taxonomy";
import { courseLinks } from "./today";
import { gapAction, type GapAction } from "./gap-actions";
import type { Gap } from "./types";

type Factor = keyof typeof W;

export interface GapReason {
  key: Factor | "cap" | "ai";
  title: string;
  /** Percentage points this reason costs. All reasons add up to the missing percent. */
  pts: number;
  /** The concrete gaps from this post, in the words the job page uses. */
  gaps: Gap[];
  /** What to do about it. */
  advice: string;
  learn: { skill: string; label: string; links: { label: string; href: string }[] }[];
  action: GapAction | null;
}

export interface ScoreGap {
  score: number;
  missing: number;
  /** "rule": the requirement check's score is shown; "ai": the AI's reading of the full post is shown. */
  source: "rule" | "ai";
  /**
   * True when every point comes straight from the requirement check. When the AI's score is final, its missing
   * percent is shared among the same gaps by their weight in the check, so both cases read the same way.
   */
  exact: boolean;
  aiScore: number | null;
  aiReason: string | null;
  cap: { at: number; reason: string } | null;
  reasons: GapReason[];
}

const TITLE: Record<Factor, string> = {
  role: "Job title", skills: "Skills", exp: "Experience", sen: "Career level", ind: "Industry",
  edu: "Education", cert: "Certificates", loc: "Location", sal: "Pay",
};
const FACTOR_OF: Record<string, Factor> = { missing: "skills", related: "skills", exp: "exp", sen: "sen", edu: "edu", cert: "cert", loc: "loc", sal: "sal" };
/** Below this many points a factor is noise, not a reason (fit-gaps uses the same floor). */
const MIN_LOST = 1;

/** Split `total` into whole numbers in proportion to `parts`, so they still add up to `total` (largest remainder). */
export function splitWhole(parts: number[], total: number): number[] {
  const sum = parts.reduce((a, b) => a + b, 0);
  if (!sum || total <= 0) return parts.map(() => 0);
  const raw = parts.map((p) => (p * total) / sum);
  const out = raw.map(Math.floor);
  let left = total - out.reduce((a, b) => a + b, 0);
  for (const i of raw.map((r, i) => [r - Math.floor(r), i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]).map((x) => x[1])) {
    if (left <= 0) break;
    out[i]++; left--;
  }
  return out;
}

function advice(k: Factor, x: Scored, gaps: Gap[]): string {
  const { job } = x;
  switch (k) {
    case "role": return `The title "${job.title}" is related to your target roles but not the same. If you would take this job, add the title to your target roles so similar jobs score higher.`;
    case "skills": return !gaps.length ? "Show the skills this post asks for in your CV with a short example of where you used them."
      : gaps.some((g) => g.k === "missing")
        ? "Tap \"I have this\" for any skill you already use at work. If you do not have it yet, the course links below are a good start."
        : "Your profile shows a related skill, not the exact one. Tap \"I have this\" if you have used it at work, so we can show it in your applications.";
    case "exp": return "Years cannot be rushed. Make sure every relevant job is in your profile with the right dates. If you are within a year of the ask, apply anyway and lead with your results.";
    case "sen": return "This job sits at a different level from your career so far. Jobs at your level will score higher; if you want this one, show the responsibility you already carry.";
    case "ind": return "This job is in a different industry. Your CV summary should show the skills that carry across.";
    case "edu": return "If you hold the degree the post asks for, add it to your profile. Otherwise, jobs that accept your qualification will score higher.";
    case "cert": return "Add the certificate to your profile if you hold it. If not, the course links below are a start; many employers accept a certificate in progress.";
    case "loc": return "If you can work there, add this place to your preferred locations.";
    case "sal": return "The pay is below your expected salary. If you would accept it, update your expected salary.";
  }
}

function learnFor(k: Factor | "cap", x: Scored, gaps: Gap[]) {
  if (k === "skills" || k === "cap") {
    const skills = [...new Set(gaps.filter((g) => g.skill && g.k === "missing").map((g) => g.skill!))].slice(0, 3);
    return skills.map((s) => ({ skill: s, label: skillLabel(s), links: courseLinks(skillLabel(s)) }));
  }
  if (k === "cert") return (x.job.certs || []).slice(0, 2).map((c) => { const n = c.names[0]; return { skill: n, label: n, links: courseLinks(n) }; });
  return [];
}

/**
 * Why `x` (a row of the live st.scored, or the job page's single row) is short of 100%.
 * `ai` is the AI reading for this job (st.aiCheck.get(id)); it is final only when it carries a score.
 */
export function scoreGap(x: Scored, ai?: { score: number | null; reason: string } | null): ScoreGap {
  const { m } = x;
  const f = m.f as Partial<Record<Factor, number | null>>;
  let s = 0, w = 0;
  for (const k of Object.keys(W) as Factor[]) { const v = f[k]; if (v != null) { s += W[k] * v; w += W[k]; } }
  const raw = w ? Math.round((100 * s) / w) : 0;
  const aiFinal = ai?.score != null;
  const missing = Math.max(0, 100 - m.score);
  const ceiling = m.scoreCap ?? 100;
  // The cap explains every point between the score before it and the score shown.
  const before = aiFinal ? ai!.score! : raw;
  const capped = before > m.score && ceiling < 100 && ceiling === m.score;
  const cap = capped ? { at: ceiling, reason: m.capReason || m.reason || "A requirement is not confirmed" } : null;

  const lost = (Object.keys(W) as Factor[])
    .map((k) => ({ k, pts: f[k] == null || !w ? 0 : (100 * W[k] * (1 - (f[k] as number))) / w }))
    .filter((e) => e.pts >= MIN_LOST)
    .sort((a, b) => b.pts - a.pts);
  // When the rule score is shown, its lost points are exactly the gap (with any cap on top). When the AI's score is shown,
  // the same gaps share the AI's missing percent by their weight in the check, so the points always add up to the card.
  const exact = !aiFinal && Math.min(raw, ceiling) === m.score;
  const capPts = cap ? before - m.score : 0;
  const rest = Math.max(0, missing - capPts);
  const whole = splitWhole(lost.map((e) => e.pts), rest);
  const all = m.allGaps || m.gaps || [];
  const reasons: GapReason[] = [];
  if (cap) {
    const blocking = all.filter((g) => g.o === 0);
    reasons.push({
      key: "cap", title: `Held at ${cap.at}%: ${cap.reason}`, pts: capPts, gaps: blocking,
      advice: "The post asks for something your profile does not show yet, so the score cannot go above this until it is confirmed. If you have it, add it to your profile.",
      learn: learnFor("cap", x, blocking), action: blocking.map((g) => gapAction(g.k)).find(Boolean) ?? null,
    });
  }
  lost.forEach((e, i) => {
    const gaps = all.filter((g) => FACTOR_OF[g.k] === e.k && !(cap && g.o === 0));
    const pts = whole[i];
    if (pts === 0) return;
    reasons.push({ key: e.k, title: TITLE[e.k], pts, gaps, advice: advice(e.k, x, gaps), learn: learnFor(e.k, x, gaps), action: gapAction(e.k) });
  });
  // The AI found a gap the requirement check did not: its own reason is the explanation.
  if (rest > 0 && !lost.length) reasons.push({
    key: "ai", title: "From the AI's reading of the full post", pts: rest, gaps: [],
    advice: ai?.reason?.trim() || "The full post asks for more than your CV shows. Read it and add anything you have that matches.", learn: [], action: null,
  });
  return { score: m.score, missing, source: aiFinal ? "ai" : "rule", exact, aiScore: aiFinal ? ai!.score : null, aiReason: ai?.reason?.trim() || null, cap, reasons };
}

/** The card's short line: "21% missing · why?" Only for open jobs in the person's field that are under 100%. */
export function gapLabel(x: Scored): string | null {
  const { m } = x;
  if (!m.relevant || m.expired || m.score >= 100) return null;
  return `${100 - m.score}% missing · why?`;
}
