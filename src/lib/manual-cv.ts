import { z } from "zod";
import { careerHeadline, closeEarlierRoles, newestExperienceFirst } from "./cv/experience";
import { normSkill } from "./taxonomy";
import type { CareerFact } from "./facts";
import type { MasterCV } from "./types";

const text = z.string().trim().max(500);
const date = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Use a month and year.").nullable();
const education = z.object({ degree: text.min(1), field: text, institution: text, year: text, level: z.enum(["hsc", "diploma", "bachelors", "masters", "phd"]), result: text.nullable() });
const certification = z.object({ name: text.min(1), status: z.enum(["qualified", "partly", "in_progress"]), detail: text.nullable() });
export const ManualCvSchema = z.object({
  name: text.min(1), headline: text, contact: z.string().max(1500), summary: z.string().max(6000),
  experience: z.array(z.object({ title: text.min(1), department: text.nullable().optional(), company: text.min(1), location: text.nullable(), start: date, end: date, autoEnd: z.boolean().optional(), concurrent: z.boolean().optional(), bullets: z.array(z.string().max(2000)).max(50) }).refine(e => !e.start || !e.end || e.start <= e.end, { message: "End date must be after the start date." })).max(40),
  education: z.array(education).max(30), certifications: z.array(certification).max(50),
  skills_core: z.array(text.min(1)).max(100), skills_tools: z.array(text.min(1)).max(100), languages: z.array(text.min(1)).max(50),
});
export type ManualCv = z.infer<typeof ManualCvSchema>;
export const ManualSaveSchema = z.object({ baseId: z.uuid(), country: z.string().length(2), revision: z.number().int().nonnegative(), cv: ManualCvSchema });

/** Structured fields keep the matching profile in sync with the edited CV, without an AI call. */
export function manualDraft(master: MasterCV, facts: CareerFact[]): ManualCv {
  const edus = facts.filter(f => f.verified && f.kind === "education").map(f => f.data);
  const certs = facts.filter(f => f.verified && f.kind === "certification").map(f => f.data);
  return {
    name: master.name, headline: careerHeadline(master.experience,master.headline), contact: master.contact, summary: master.summary,
    experience: newestExperienceFirst(closeEarlierRoles(structuredClone(master.experience))),
    education: edus.length ? edus.map(d => ({ degree: String(d.degree || ""), field: String(d.field || ""), institution: String(d.institution || ""), year: String(d.year || ""), level: education.shape.level.safeParse(d.level).data || "bachelors", result: d.result == null ? null : String(d.result) })) : master.education.map(degree => ({ degree, field: "", institution: "", year: "", level: "bachelors", result: null })),
    certifications: certs.length ? certs.map(d => ({ name: String(d.name || ""), status: certification.shape.status.safeParse(d.status).data || "qualified", detail: d.detail == null ? null : String(d.detail) })) : master.certifications.map(name => ({ name, status: "qualified", detail: null })),
    skills_core: [...master.skills_core], skills_tools: [...master.skills_tools], languages: [...master.languages],
  };
}

export function manualContent(input: ManualCv, before: MasterCV, facts: CareerFact[]) {
  const original = manualDraft(before, facts);
  const experience = newestExperienceFirst(closeEarlierRoles(input.experience));
  const master: MasterCV = {
    ...input, experience, headline:careerHeadline(experience,before.experience.length ? "" : input.headline),
    education: JSON.stringify(input.education) === JSON.stringify(original.education) ? before.education : input.education.map(e => [e.degree + (e.field ? ` in ${e.field}` : ""), e.institution, e.year, e.result ? `(${e.result})` : ""].filter(Boolean).join(", ")),
    certifications: JSON.stringify(input.certifications) === JSON.stringify(original.certifications) ? before.certifications : input.certifications.map(c => `${c.name}${c.status === "partly" ? " (partly qualified)" : c.status === "in_progress" ? " (in progress)" : ""}${c.detail ? ` — ${c.detail}` : ""}`),
    suggestions: [], improvements: before.improvements, extra_skills: [],
  };
  const rows: Pick<CareerFact, "kind" | "data">[] = [
    ...experience.map(e => { const old = facts.find(f => f.kind === "experience" && f.data.company === e.company && f.data.title === e.title); return { kind: "experience" as const, data: { title: e.title, department:e.department?.trim()||null, company: e.company, start: e.start, end: e.end, autoEnd: e.autoEnd ?? false, concurrent: e.concurrent ?? false, location: e.location, industry: old?.data.industry ?? null } }; }),
    ...input.education.map(e => ({ kind: "education" as const, data: e })),
    ...input.certifications.map(c => ({ kind: "certification" as const, data: c })),
    ...Array.from(new Set([...input.skills_core, ...input.skills_tools].map(normSkill))).map(name => ({ kind: "skill" as const, data: { name } })),
    ...Array.from(new Set(input.languages)).map(name => ({ kind: "language" as const, data: { name } })),
  ];
  return { master, facts: rows };
}
