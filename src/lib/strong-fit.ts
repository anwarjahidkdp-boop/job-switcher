import type { Scored } from "./matching";
import { skillLabel } from "./taxonomy";
export const STRONG_FIT_SCORE = 90;
/** Evidence from current relevant vacancies only; never invent missing skills or promise a score increase. */
export function strongFitGuide(rows: Scored[]) {
  const open = rows.filter(x=>x.m.relevant && !x.m.expired).sort((a,b)=>b.m.score-a.m.score);
  if(open.some(x=>x.m.score>=STRONG_FIT_SCORE))return null;
  const closest = open[0] || null;
  const direct = closest?.m.allGaps.filter(g=>g.skill).map(g=>g.skill!) || [];
  const counts=new Map<string,number>();
  for(const row of open)for(const skill of new Set(row.m.allGaps.filter(g=>g.skill).map(g=>g.skill!)))counts.set(skill,(counts.get(skill)||0)+1);
  const keys = [...new Set([...direct,...[...counts].sort((a,b)=>b[1]-a[1]).map(([s])=>s)])].slice(0,4);
  return { closest, points:closest ? Math.max(0,STRONG_FIT_SCORE-closest.m.score):null,
    skills:keys.map(skill=>({skill,label:skillLabel(skill),closest:direct.includes(skill),jobs:counts.get(skill)||0})),
    other:closest?.m.allGaps.filter(g=>!g.skill).slice(0,3).map(g=>g.t)||[],
  };
}
