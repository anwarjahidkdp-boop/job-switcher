// "Why no Strong Fit yet?" on the Home career guide: what keeps the person's near matches (70–89%) under 90%,
// in plain words. It reads the match factors the score is built from, so the reasons always agree with the scores.
import { W, type Scored } from "./matching";
import { skillLabel } from "./taxonomy";

type Factor = keyof typeof W;
export interface FitGap { factor: Factor; jobs: number; text: string }

/** A factor counts against a job when it costs it at least this many points. */
const MIN_LOST = 2;

export function strongFitGaps(rows: Scored[], topSkills: string[] = []): { near: number; gaps: FitGap[] } {
  const near = rows.filter((x) => x.m.relevant && !x.m.expired && x.m.score >= 70 && x.m.score < 90);
  const lost = new Map<Factor, { pts: number; jobs: number }>();
  for (const x of near) {
    for (const k of Object.keys(W) as Factor[]) {
      const v = x.m.f?.[k];
      if (v == null) continue;
      const pts = W[k] * (1 - v);
      if (pts < MIN_LOST) continue;
      const e = lost.get(k) || { pts: 0, jobs: 0 };
      lost.set(k, { pts: e.pts + pts, jobs: e.jobs + 1 });
    }
  }
  const of = (n: number) => `${n} of ${near.length}`;
  const skills = topSkills.slice(0, 2).map(skillLabel);
  const TEXT: Record<Factor, (n: number) => string> = {
    skills: (n) => `Skills: ${of(n)} jobs ask for skills your profile does not show yet${skills.length ? `, mostly ${skills.join(" and ")}` : ""}. Learn one, or add it if you already have it.`,
    exp: (n) => `Experience: ${of(n)} jobs want more years than you have. If you are within a year, apply anyway and lead with your results.`,
    role: (n) => `Job title: ${of(n)} jobs are close to your target role but not the same. Add the titles you would also take to your target roles.`,
    sen: (n) => `Level: ${of(n)} jobs are a step above or below your current level.`,
    ind: (n) => `Industry: ${of(n)} jobs are in a different industry from yours. Show the skills that carry across.`,
    edu: (n) => `Education: ${of(n)} jobs ask for a different degree or subject.`,
    cert: (n) => `Certificates: ${of(n)} jobs ask for a certificate you have not listed. Add any you hold.`,
    loc: (n) => `Location: ${of(n)} jobs are outside the places you chose. Add more locations if you can travel.`,
    sal: (n) => `Pay: ${of(n)} jobs pay less than your minimum salary.`,
  };
  const gaps = [...lost].sort((a, b) => b[1].pts - a[1].pts).slice(0, 3).map(([factor, e]) => ({ factor, jobs: e.jobs, text: TEXT[factor](e.jobs) }));
  return { near: near.length, gaps };
}
