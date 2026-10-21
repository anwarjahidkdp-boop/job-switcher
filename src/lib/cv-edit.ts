// "Ask AI to change your CV": turns the AI's proposed fact changes into safe, checked database changes.
// Pure functions so they can be tested. The instruction is the person's own statement, so new or changed
// values must come from it; anything else is refused rather than guessed.
import { appearsIn, skillGrounded, type CareerFact, type FactKind, type RemovedItem } from "./facts";
import { isEduLevel, normSkill } from "./taxonomy";
import type { MasterCV } from "./types";

export type { RemovedItem };

export const MAX_EDIT_CHARS = 1000;
/** How many past instructions we keep so a later Master CV rebuild follows them too. */
export const MAX_EDITS_KEPT = 20;

export type EditKind = Exclude<FactKind, "answer">;
export const EDIT_KINDS: EditKind[] = ["experience", "education", "certification", "skill", "language"];

/** Fields each kind may carry (the same shapes the CV reader stores). */
export const FIELDS: Record<EditKind, string[]> = {
  experience: ["title", "company", "start", "end", "location", "industry"],
  education: ["degree", "field", "institution", "year", "level", "result"],
  certification: ["name", "status", "detail"],
  skill: ["name"],
  language: ["name"],
};
const REQUIRED: Record<EditKind, string[]> = { experience: ["title", "company"], education: ["degree"], certification: ["name"], skill: ["name"], language: ["name"] };
const DATE_FIELDS = new Set(["start", "end"]);
const ENUM_FIELDS = new Set(["level", "status"]);
const STATUSES = ["qualified", "partly", "in_progress"];
const PRESENT = /\b(present|current|currently|still|now|ongoing|today)\b/i;

/** One change the AI proposes. `ref` names an existing fact (f1, f2...) for remove/update. */
export interface FactOp {
  op: "remove" | "update" | "add";
  ref: string | null;
  kind: EditKind;
  /** New values (null or missing = unchanged). */
  values: Record<string, string | null>;
  /** Fields to blank, e.g. "end" for a job the person still has. */
  clear: string[];
}

export interface FactPlan {
  remove: string[];
  update: { id: string; data: Record<string, unknown> }[];
  add: CareerFact[];
  removed: RemovedItem[];
  /** Removed items that the person has now added back. */
  restored: RemovedItem[];
}

export class EditRefused extends Error {}

/** Bangla (Bengali script) in the text? Such instructions are translated to English before they are applied. */
export const hasBangla = (s: string) => /[\u0980-\u09FF]/.test(s);
/** Bangla digits (০-৯) as 0-9, so dates, results and amounts the person states can be checked. */
export const bnDigits = (s: string) => s.replace(/[\u09E6-\u09EF]/g, (d) => String(d.charCodeAt(0) - 0x09e6));

/** Short refs for the prompt (f1, f2...) so the model never has to copy database ids. */
export function factRefs(facts: CareerFact[]): { ref: string; fact: CareerFact }[] {
  return facts.filter((f) => f.id && f.kind !== "answer").map((f, i) => ({ ref: `f${i + 1}`, fact: f }));
}

export function factLabel(kind: EditKind, d: Record<string, unknown>): string {
  if (kind === "experience") return String(d.company || "");
  if (kind === "education") return String(d.degree || d.institution || "");
  if (kind === "skill") return normSkill(d.name);
  return String(d.name || "");
}

const ymOk = (v: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(v);

/** Is a new value something the person actually said in the instruction? */
export function statedIn(field: string, kind: EditKind, value: string, instruction: string): boolean {
  if (DATE_FIELDS.has(field)) return instruction.includes(value.slice(0, 4));
  if (field === "year") return instruction.includes(value);
  if (ENUM_FIELDS.has(field)) return true; // a category for what the person stated, not a new claim
  if (kind === "skill") return skillGrounded(value, instruction);
  return appearsIn(value, instruction, "all");
}

function cleanValue(field: string, v: string): string {
  const s = String(v).trim().slice(0, 200);
  if (DATE_FIELDS.has(field) && !ymOk(s)) throw new EditRefused("Please give the month and year for that date, for example March 2024.");
  if (field === "level" && !isEduLevel(s)) throw new EditRefused("We could not tell which level of education that is. Name the degree, for example HSC or BSc.");
  if (field === "status" && !STATUSES.includes(s)) throw new EditRefused("Say whether you have passed it, passed some papers, or are still studying for it.");
  return field === "name" ? s.slice(0, 80) : s;
}

/**
 * Check the AI's proposed fact changes against the person's facts and their instruction, and turn them into
 * database changes. Throws EditRefused with a friendly message when a change is not allowed.
 */
export function planFactEdits(facts: CareerFact[], ops: FactOp[], instruction: string, removedBefore: RemovedItem[] = []): FactPlan {
  const refs = new Map(factRefs(facts).map((r) => [r.ref, r.fact]));
  const plan: FactPlan = { remove: [], update: [], add: [], removed: [], restored: [] };
  const touched = new Set<string>();
  for (const o of ops) {
    if (!EDIT_KINDS.includes(o.kind)) throw new EditRefused("That change is not something we can make to a CV.");
    const allowed = FIELDS[o.kind];
    if (o.op === "remove" || o.op === "update") {
      const f = o.ref ? refs.get(o.ref) : undefined;
      if (!f || !f.id) throw new EditRefused("We could not find that item in your CV. Name it the way it appears on your CV.");
      if (touched.has(f.id)) continue;
      touched.add(f.id);
      const kind = f.kind as EditKind;
      if (o.op === "remove") {
        plan.remove.push(f.id);
        const label = factLabel(kind, f.data);
        if (label) plan.removed.push({ kind, label });
        continue;
      }
      const data: Record<string, unknown> = { ...f.data };
      let changed = false;
      for (const [k, raw] of Object.entries(o.values || {})) {
        if (raw == null || raw === "" || !FIELDS[kind].includes(k)) continue;
        const v = cleanValue(k, raw);
        if (String(data[k] ?? "") === v) continue;
        if (!statedIn(k, kind, v, instruction)) throw new EditRefused("We can only add details you state yourself. Write the new value in full in your message.");
        data[k] = kind === "skill" && k === "name" ? normSkill(v) : v;
        changed = true;
      }
      for (const k of o.clear || []) {
        if (!FIELDS[kind].includes(k) || REQUIRED[kind].includes(k) || data[k] == null || data[k] === "") continue;
        // A blank end date reads as "Present", which is a claim: only when the person says so.
        if (k === "end" && !PRESENT.test(instruction)) throw new EditRefused("Do you still work there? Say \"I still work at …\" to show it as your current job.");
        data[k] = k === "year" ? "" : null;
        changed = true;
      }
      if (changed) plan.update.push({ id: f.id, data });
      continue;
    }
    // add
    const data: Record<string, unknown> = {};
    for (const k of allowed) {
      const raw = o.values?.[k];
      if (raw == null || raw === "") continue;
      const v = cleanValue(k, raw);
      if (!statedIn(k, o.kind, v, instruction)) throw new EditRefused("We can only add details you state yourself. Write what to add in full in your message.");
      data[k] = v;
    }
    if (REQUIRED[o.kind].some((k) => !data[k])) {
      throw new EditRefused(o.kind === "experience" ? "To add a job, give the job title and the employer, for example \"add Accounts Officer at ABC Ltd from Jan 2020 to Mar 2022\"." : "We could not tell exactly what to add. Write it in full, for example \"add that I passed ACCA F5\".");
    }
    if (o.kind === "skill") data.name = normSkill(data.name);
    if (o.kind === "experience") { data.start ??= null; data.end ??= null; data.location ??= null; data.industry ??= null; }
    if (o.kind === "education") { data.field ??= ""; data.institution ??= ""; data.year ??= ""; data.level ??= "bachelors"; data.result ??= null; }
    if (o.kind === "certification") { data.status ??= "qualified"; data.detail ??= null; }
    const label = factLabel(o.kind, data);
    const same = facts.find((f) => f.kind === o.kind && f.id && !plan.remove.includes(f.id) && sameLabel(o.kind, factLabel(o.kind, f.data), label));
    if (same && same.verified) continue; // already on the CV
    if (same?.id) { plan.update.push({ id: same.id, data: { ...same.data, ...data } }); touched.add(same.id); }
    else plan.add.push({ kind: o.kind, data, provenance: "user", verified: true, evidence: null });
    plan.restored.push(...removedBefore.filter((r) => r.kind === o.kind && sameLabel(o.kind, r.label, label)));
  }
  // Removing one of two roles at the same employer must not hide the other one later.
  const kept = facts.filter((f) => f.kind === "experience" && f.id && !plan.remove.includes(f.id)).map((f) => String(f.data.company || ""));
  plan.removed = plan.removed.filter((r) => r.kind !== "experience" || !kept.some((c) => sameLabel("experience", c, r.label)));
  return plan;
}

const sameLabel = (kind: EditKind, a: string, b: string) => (kind === "skill" ? normSkill(a) === normSkill(b) : !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase());

/** The removed list after this edit: new removals added, items the person added back dropped. */
export function nextRemoved(before: RemovedItem[], plan: Pick<FactPlan, "removed" | "restored">): RemovedItem[] {
  const out = before.filter((r) => !plan.restored.some((x) => x.kind === r.kind && x.label === r.label));
  for (const r of plan.removed) if (!out.some((x) => x.kind === r.kind && sameLabel(r.kind, x.label, r.label))) out.push(r);
  return out.slice(-100);
}

/** Take items the person removed out of a Master CV (a rebuild reads the original CV text, which still has them). */
export function dropRemoved(m: MasterCV, removed: RemovedItem[]): MasterCV {
  if (!removed.length) return m;
  const by = (k: EditKind) => removed.filter((r) => r.kind === k).map((r) => r.label).filter(Boolean);
  const skills = new Set(by("skill").map(normSkill));
  const hit = (labels: string[], text: string) => labels.some((l) => appearsIn(l, text));
  const comps = by("experience"), edu = by("education"), certs = by("certification"), langs = by("language");
  return {
    ...m,
    experience: (m.experience || []).filter((e) => !hit(comps, e.company)),
    education: (m.education || []).filter((e) => !hit(edu, e)),
    certifications: (m.certifications || []).filter((c) => !hit(certs, c)),
    skills_core: (m.skills_core || []).filter((s) => !skills.has(normSkill(s))),
    skills_tools: (m.skills_tools || []).filter((s) => !skills.has(normSkill(s))),
    languages: (m.languages || []).filter((l) => !hit(langs, l)),
  };
}
