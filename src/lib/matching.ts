// Deterministic job matching, ported faithfully from the prototype's scoreJob().
// Weights: role 25, skills 25, exp 15, sen 10, ind 7, edu 6, cert 5, loc 4, sal 3.
// Bands: >=85 Excellent, >=70 Strong, >=55 Possible, else Low.
// A required certification not fully held, or no visa sponsorship when the user needs it, caps the score at 69.
import { money, HOME_COUNTRY, type CountryCode } from "./countries";
import { daysUntil } from "./dates";
import {
  cap1, divOf, EDU, famOf, IND_GROUP, LEVEL, LEVEL_NAME, RELATED, skillLabel, titleTokens,
} from "./taxonomy";
import type { Band, Gap, Job, MatchProfile, MatchResult } from "./types";

export const W = { role: 25, skills: 25, exp: 15, sen: 10, ind: 7, edu: 6, cert: 5, loc: 4, sal: 3 } as const;
type Factor = keyof typeof W;
export const FACTOR_REASON: Record<Factor, string> = { role: "Role fit", skills: "Missing skill", exp: "Experience requirement", sen: "Seniority mismatch", ind: "Industry mismatch", edu: "Education requirement", cert: "Certification requirement", loc: "Location mismatch", sal: "Salary mismatch" };
export const CAP_SCORE = 69;
export const BAND: Record<Band, [string, string, string]> = { ex: ["Excellent Match", "p-ex", "band-ex"], st: ["Strong Match", "p-st", "band-st"], po: ["Possible Match", "p-po", "band-po"], lo: ["Low Match", "p-lo", "band-lo"] };

export function bandOf(score: number): Band {
  return score >= 85 ? "ex" : score >= 70 ? "st" : score >= 55 ? "po" : "lo";
}

export const hasSkillSet = (P: MatchProfile) => new Set(P.skills.map((s) => s.name));

export function roleRel(job: Pick<Job, "title" | "category">, P: MatchProfile): number {
  const pt = new Set<string>();
  [...P.targetRoles, ...P.titles].forEach((t) => titleTokens(t).forEach((w) => pt.add(w)));
  const jt = titleTokens(job.title);
  let ts = 0;
  if (jt.some((w) => pt.has(w))) ts = 1;
  else if (jt.some((w) => { const f = famOf(w); return f >= 0 && [...pt].some((x) => famOf(x) === f); })) ts = 0.7;
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z ]/g, "");
  if (P.targetRoles.some((r) => norm(r) === norm(job.title))) ts = 1;
  const catMatch = !!job.category && P.categories.includes(job.category);
  return catMatch ? 0.6 + 0.4 * ts : 0.55 * ts;
}

export function skillHas(set: Set<string>, s: string): { v: number; via?: string } {
  if (set.has(s)) return { v: 1 };
  if (s === "excel" && set.has("advanced excel")) return { v: 1 };
  const via = (RELATED[s] || []).find((r) => set.has(r));
  return via ? { v: 0.5, via } : { v: 0 };
}

const certTokens = (name: string) => name.toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean);

export interface ScoreOptions {
  /** ISO date used for deadline checks. */
  today: string;
  /** Does the user need the employer to sponsor a work visa (only applies abroad)? Default true. */
  needVisa?: boolean;
  /** The user's home country; jobs elsewhere are "abroad". Default BD. */
  homeCountry?: CountryCode;
}

export function scoreJob(job: Job, P: MatchProfile, opts: ScoreOptions): MatchResult {
  const set = hasSkillSet(P);
  const f: Partial<Record<Factor, number | null>> = {};
  const matched: { t: string; w: number }[] = [];
  const gaps: Gap[] = [];
  let capAt = 100;
  let capReason = "";
  f.role = roleRel(job, P);

  let got = 0, tot = 0;
  const missingReq: string[] = [];
  for (const s of job.required || []) {
    tot += 2; const h = skillHas(set, s); got += 2 * h.v;
    if (h.v === 1) matched.push({ t: skillLabel(s), w: 2 });
    else if (h.v > 0) gaps.push({ k: "related", skill: s, o: 1, t: `${skillLabel(s)} not confirmed (your profile lists ${skillLabel(h.via!)})` });
    else { missingReq.push(s); gaps.push({ k: "missing", skill: s, o: 0, t: `${skillLabel(s)} requested but not in your profile` }); }
  }
  for (const s of job.preferred || []) {
    tot += 1; const h = skillHas(set, s); got += h.v;
    if (h.v === 1) matched.push({ t: skillLabel(s) + " (preferred)", w: 1 });
    else if (h.v > 0) gaps.push({ k: "related", skill: s, o: 3, t: `${skillLabel(s)} preferred; not confirmed (you list ${skillLabel(h.via!)})` });
    else gaps.push({ k: "missing", skill: s, o: 3, t: `${skillLabel(s)} preferred but not listed` });
  }
  f.skills = tot ? got / tot : null;

  if (job.minYears != null) {
    const d = P.years - job.minYears;
    const over = !!job.maxYears && P.years > job.maxYears + 5;
    f.exp = d >= 0 ? (over ? 0.8 : 1) : d >= -1 ? 0.7 : d >= -2 ? 0.4 : 0;
    if (d >= 0) matched.unshift({ t: `${Math.floor(P.years)} years of experience (${job.minYears}+ asked)`, w: 3 });
    else gaps.push({ k: "exp", o: 2, t: `Asks for ${job.minYears}+ years; your profile shows ${Math.floor(P.years)}` });
    if (over) gaps.push({ k: "exp", o: 4, t: `Pitched at ${job.minYears}–${job.maxYears} years, below your experience` });
  }

  if (job.seniority) {
    const dl = LEVEL[job.seniority] - LEVEL[P.seniority];
    f.sen = dl === 0 ? 1 : Math.abs(dl) === 1 ? 0.6 : 0;
    if (Math.abs(dl) >= 2) gaps.push({ k: "sen", o: 4, t: `Role is ${LEVEL_NAME[LEVEL[job.seniority]]}; you are at ${LEVEL_NAME[LEVEL[P.seniority]]}` });
  }

  if (job.industry) {
    const same = P.industries.includes(job.industry);
    const adj = !same && P.industries.some((i) => IND_GROUP[i] && IND_GROUP[i] === IND_GROUP[job.industry!]);
    f.ind = same ? 1 : adj ? 0.6 : 0.3;
    if (same) matched.push({ t: `${cap1(job.industry)} industry experience`, w: 1.5 });
  }

  if (job.education && job.education.level) {
    const lvOf = (l: string) => (l in EDU ? EDU[l as keyof typeof EDU] : -1);
    const lv = Math.max(-1, ...P.education.map((e) => lvOf(String(e.level))));
    const ok = lv >= EDU[job.education.level];
    const field = job.education.field;
    const fieldOk = !field || P.education.some((e) => String(e.field || "").toLowerCase().includes(field));
    f.edu = ok && fieldOk ? 1 : ok ? 0.7 : 0;
    const best = P.education.find((e) => lvOf(String(e.level)) === lv);
    if (ok && fieldOk && best) matched.push({ t: `${best.degree} in ${best.field}`, w: 1 });
    else if (!ok) gaps.push({ k: "edu", o: 2, t: `Asks for a ${job.education.level} degree` });
  }

  if (job.certs && job.certs.length) {
    let g = 0;
    for (const c of job.certs) {
      // Whole-word match (the prototype used substring matching, which let "ACCA" satisfy "CA").
      const held = P.certs.find((x) => c.names.some((n) => certTokens(x.name).includes(n.toUpperCase())));
      const v = held ? (held.status === "qualified" ? 1 : 0.5) : 0;
      g += v;
      const nm = c.names.join(" or ");
      if (v === 1) matched.push({ t: held!.name, w: 1 });
      else if (v === 0.5) gaps.push({ k: "cert", o: c.required ? 0 : 3, t: `${nm} ${c.required ? "required" : "preferred"}; yours is ${held!.name}, partly qualified` });
      else gaps.push({ k: "cert", o: c.required ? 0 : 3, t: `${nm} ${c.required ? "required" : "preferred"}; not in your profile` });
      if (c.required && v < 1) { capAt = Math.min(capAt, CAP_SCORE); capReason = capReason || "Certification requirement"; }
    }
    f.cert = g / job.certs.length;
  }

  if (job.location && P.locations.length) {
    const loc = job.location;
    const ok = P.locations.some((l) => loc.toLowerCase().includes(l.toLowerCase()));
    const sameDiv = !ok && P.locations.some((l) => divOf(l) === divOf(loc));
    f.loc = ok ? 1 : sameDiv ? 0.5 : 0;
    if (!ok && !sameDiv) gaps.push({ k: "loc", o: 2, t: `Based in ${loc}; you prefer ${P.locations.join(", ")}` });
  }

  if (P.salaryMin) {
    if (job.salaryMax) {
      f.sal = job.salaryMax < 0.9 * P.salaryMin ? 0 : 1;
      if (!f.sal) gaps.push({ k: "sal", o: 2, t: `Pays up to ${money(job.salaryMax, job.country)}; you expect ${money(P.salaryMin, job.country)}+` });
    } else f.sal = 0.7;
  }

  const home = opts.homeCountry || HOME_COUNTRY;
  if ((job.country || home) !== home && opts.needVisa !== false) {
    if (job.visa === true) matched.push({ t: "Visa sponsorship offered", w: 2.5 });
    else if (job.visa === false) {
      gaps.push({ k: "visa", o: 0, t: "No visa sponsorship offered; you would need your own right to work" });
      capAt = Math.min(capAt, CAP_SCORE); capReason = capReason || "Visa sponsorship";
    }
  }

  let s = 0, w = 0;
  for (const k of Object.keys(f) as Factor[]) { const v = f[k]; if (v != null) { s += W[k] * v; w += W[k]; } }
  let score = w ? Math.round((100 * s) / w) : 0;
  const capped = score > capAt;
  score = Math.min(score, capAt);
  const dl = daysUntil(job.deadline, opts.today);
  const expired = dl != null && dl < 0;
  const band = bandOf(score);

  let worst: Factor | null = null, wl = -1;
  for (const k of Object.keys(f) as Factor[]) { const v = f[k]; if (v != null && k !== "role") { const lost = W[k] * (1 - v); if (lost > wl) { wl = lost; worst = k; } } }
  let reason = capped ? capReason : worst ? FACTOR_REASON[worst] : "";
  const firstSkillGap = gaps.find((g) => g.skill);
  let reasonDetail = reason === "Missing skill" ? (missingReq.length ? skillLabel(missingReq[0]) : firstSkillGap?.skill ? skillLabel(firstSkillGap.skill) : "") : "";
  if (expired) { reason = "Expired vacancy"; reasonDetail = ""; }

  matched.sort((a, b) => b.w - a.w);
  gaps.sort((a, b) => a.o - b.o);
  return { score, band, f: f as Record<string, number | null>, matched: matched.slice(0, 5).map((m) => m.t), gaps: gaps.slice(0, 3), allGaps: gaps, relevant: (f.role ?? 0) >= 0.6, expired, capped, reason, reasonDetail };
}

export interface Scored { job: Job; m: MatchResult }

export function scoreAll(jobs: Job[], P: MatchProfile, opts: ScoreOptions): Scored[] {
  return jobs.filter((j) => j.country === P.country).map((job) => ({ job, m: scoreJob(job, P, opts) }));
}

/** Opportunity inbox list: relevant, open, not dismissed, at least Possible, best first. */
export function inboxList(scored: Scored[], dismissed: Set<string>): Scored[] {
  return scored.filter((x) => x.m.relevant && !x.m.expired && !dismissed.has(x.job.id) && x.m.score >= 55).sort((a, b) => b.m.score - a.m.score);
}

export function skillDemand(scored: Scored[], P: MatchProfile) {
  const rel = scored.filter((x) => x.m.relevant);
  const set = hasSkillSet(P);
  const cnt: Record<string, number> = {};
  for (const { job } of rel) for (const s of [...(job.required || []), ...(job.preferred || [])]) cnt[s] = (cnt[s] || 0) + 1;
  return { rel, rows: Object.entries(cnt).map(([s, n]) => ({ s, n, h: skillHas(set, s) })).sort((a, b) => b.n - a.n) };
}

/** "What if I had this skill" impact, as on the prototype Insights view. */
export function skillImpact(scored: Scored[], P: MatchProfile, skill: string, opts: ScoreOptions) {
  const rel = scored.filter((x) => x.m.relevant && !x.m.expired);
  const P2: MatchProfile = { ...P, skills: [...P.skills, { name: skill, src: "what-if" }] };
  const before = rel.filter((x) => x.m.score >= 70).length;
  const after = rel.filter((x) => scoreJob(x.job, P2, opts).score >= 70).length;
  const where = rel.filter((x) => [...(x.job.required || []), ...(x.job.preferred || [])].includes(skill)).map((x) => x.job.title + " · " + x.job.company);
  return { before, after, where };
}

/** Merged experience years across overlapping intervals (prototype yearsFrom). */
export function yearsFrom(exps: { start: string | null; end: string | null }[], now: number = Date.now()): number {
  const DAYMS = 864e5;
  const iv = (exps || []).filter((e) => e.start).map((e) => {
    const s = new Date(e.start + "-01").getTime();
    const en = e.end ? new Date(e.end + "-28").getTime() : now;
    return [s, Math.max(s, en)] as [number, number];
  }).sort((a, b) => a[0] - b[0]);
  let tot = 0, cs: number | null = null, ce = 0;
  for (const [s, e] of iv) {
    if (cs === null) { cs = s; ce = e; } else if (s <= ce) { ce = Math.max(ce, e); } else { tot += ce - cs; cs = s; ce = e; }
  }
  if (cs !== null) tot += ce - cs;
  return Math.round((tot / (365.25 * DAYMS)) * 10) / 10;
}
