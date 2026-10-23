import type { Scored } from "./matching";
import { skillLabel } from "./taxonomy";
export const STRONG_FIT_SCORE = 90;
/** Aggregate evidenced skill gaps across relevant, open vacancies. */
export function strongFitGuide(rows: Scored[]) {
  const open = rows.filter(x=>x.m.relevant && !x.m.expired);
  if(open.some(x=>x.m.score>=STRONG_FIT_SCORE))return null;
  const score = open.length ? Math.max(...open.map(x=>x.m.score)) : null;
  const counts=new Map<string,number>();
  for(const row of open)for(const skill of new Set(row.m.allGaps.filter(g=>g.skill).map(g=>g.skill!)))counts.set(skill,(counts.get(skill)||0)+1);
  const keys = [...counts].sort((a,b)=>b[1]-a[1] || a[0].localeCompare(b[0])).map(([skill])=>skill).slice(0,4);
  return { score, points:score==null ? null : Math.max(0,STRONG_FIT_SCORE-score),
    skills:keys.map(skill=>({skill,label:skillLabel(skill)})),
  };
}
