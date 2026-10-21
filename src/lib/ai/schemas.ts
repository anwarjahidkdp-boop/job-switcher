// Zod schemas for every structured AI output. Used for the provider's JSON output mode
// and validated again on our side before anything is stored.
import { z } from "zod";

const Seniority = z.enum(["entry", "mid", "senior", "manager", "head"]);
const EduLevel = z.enum(["hsc", "diploma", "bachelors", "masters", "phd"]);
const YM = z.string().nullable();

export const ExtractionSchema = z.object({
  name: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  location: z.string().nullable(),
  experiences: z.array(z.object({ title: z.string(), company: z.string(), start: YM, end: YM, industry: z.string().nullable() })),
  education: z.array(z.object({ degree: z.string(), field: z.string(), institution: z.string(), year: z.string(), level: EduLevel, result: z.string().nullable() })),
  certifications: z.array(z.object({ name: z.string(), status: z.enum(["qualified", "partly", "in_progress"]), detail: z.string().nullable() })),
  skills: z.array(z.string()),
  languages: z.array(z.string()),
  industries: z.array(z.string()),
  categories: z.array(z.string()),
  seniority: Seniority,
  target_roles: z.array(z.string()),
  questions: z.array(z.object({ id: z.string(), question: z.string(), placeholder: z.string() })),
});

export const MasterCvSchema = z.object({
  name: z.string(),
  headline: z.string(),
  contact: z.string(),
  summary: z.string(),
  experience: z.array(z.object({ title: z.string(), company: z.string(), location: z.string().nullable(), start: YM, end: YM, bullets: z.array(z.string()) })),
  education: z.array(z.string()),
  certifications: z.array(z.string()),
  skills_core: z.array(z.string()),
  skills_tools: z.array(z.string()),
  languages: z.array(z.string()),
  extra_skills: z.array(z.string()),
  improvements: z.array(z.object({ before: z.string(), after: z.string() })),
});

/** The build step also returns changes it recommends but must not make itself (the person confirms each one). */
export const MasterBuildSchema = MasterCvSchema.extend({
  suggestions: z.array(z.object({ section: z.string(), current: z.string(), options: z.array(z.string()), reason: z.string() })),
});

const EditField = z.enum(["title", "company", "start", "end", "location", "degree", "field", "institution", "year", "level", "result", "name", "status", "detail"]);
/**
 * "Ask AI to change your CV": fact changes plus the whole Master CV after the change.
 * Field values are a list of pairs rather than nullable fields: structured output limits how many nullable (union) fields a schema may have.
 */
export const CvEditSchema = z.object({
  ok: z.boolean(),
  message: z.string(),
  ops: z.array(z.object({
    op: z.enum(["remove", "update", "add"]),
    ref: z.string(),
    kind: z.enum(["experience", "education", "certification", "skill", "language"]),
    values: z.array(z.object({ field: EditField, value: z.string() })),
    clear: z.array(EditField),
  })),
  master: MasterCvSchema.nullable(),
});

export const PackSchema = z.object({
  summary: z.string(),
  top_bullets: z.array(z.string()),
  skills_order: z.array(z.string()),
  emphasis: z.array(z.string()),
  cover_letter: z.string(),
  email_subject: z.string(),
  email_body: z.string(),
  checklist: z.array(z.string()),
  asks: z.array(z.string()),
  instructions: z.string().nullable(),
});

export const PackTailorSchema = PackSchema.pick({ summary: true, top_bullets: true, skills_order: true, emphasis: true, checklist: true, asks: true, instructions: true });
export const PackLetterSchema = PackSchema.pick({ cover_letter: true, email_subject: true, email_body: true });

const JobFields = {
  title: z.string(),
  company: z.string(),
  industry: z.string().nullable(),
  category: z.string().nullable(),
  location: z.string().nullable(),
  type: z.string().nullable(),
  salaryMin: z.number().nullable(),
  salaryMax: z.number().nullable(),
  visa: z.boolean().nullable(),
  minYears: z.number().nullable(),
  maxYears: z.number().nullable(),
  seniority: Seniority.nullable(),
  education: z.object({ level: EduLevel.nullable(), field: z.string() }).nullable(),
  required: z.array(z.string()),
  preferred: z.array(z.string()),
  certs: z.array(z.object({ names: z.array(z.string()), required: z.boolean() })),
  deadline: z.string().nullable(),
  apply: z.object({ method: z.enum(["email", "portal", "unknown"]), target: z.string().nullable() }),
  resp: z.array(z.string()),
};
export const PastedJobSchema = z.object(JobFields);
export const AlertJobsSchema = z.object({ jobs: z.array(z.object({ ...JobFields, url: z.string().nullable() })) });

/** Fills only the gaps the deterministic alert parser left (one call per email). */
export const AlertFillSchema = z.object({
  jobs: z.array(z.object({ index: z.number(), title: z.string().nullable(), company: z.string().nullable(), location: z.string().nullable(), deadline: z.string().nullable() })),
});
export type AlertFillOut = z.infer<typeof AlertFillSchema>;

/** AI check of one match: does this job really fit this person, reading the full description and the CV? */
export const MatchCheckSchema = z.object({
  fit: z.enum(["strong", "partial", "no"]),
  score: z.number().int(),
  chance: z.enum(["high", "medium", "low"]),
  reason: z.string(),
});
export type MatchCheckOut = z.infer<typeof MatchCheckSchema>;

export const TranslateSchema = z.object({ english: z.string() });

export type ExtractionOut = z.infer<typeof ExtractionSchema>;
export type CvEditOut = z.infer<typeof CvEditSchema>;
export type MasterCvOut = z.infer<typeof MasterCvSchema>;
export type PackOut = z.infer<typeof PackSchema>;
export type PastedJobOut = z.infer<typeof PastedJobSchema>;
export type AlertJobsOut = z.infer<typeof AlertJobsSchema>;

export const InterviewPrepSchema = z.object({
  questions: z.array(z.object({
    topic: z.enum(["about_you", "role", "technical", "behavioural", "company", "salary"]),
    question: z.string(),
    why: z.string(),
    answer: z.string(),
  })),
  ask_them: z.array(z.string()),
  checklist: z.array(z.string()),
});
