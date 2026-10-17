import type { CountryCode, CvTemplate } from "./countries";
import type { EduLevel, Seniority } from "./taxonomy";

export type Provenance = "cv" | "answer" | "user";

export interface JobCert { names: string[]; required: boolean }
export type ApplyMethod = "email" | "portal" | "unknown";

/** Normalised job as used by matching and the UI. Mirrors the `jobs` table. */
export interface Job {
  id: string;
  country: CountryCode;
  title: string;
  company: string;
  industry: string | null;
  category: string | null;
  location: string | null;
  type: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  minYears: number | null;
  maxYears: number | null;
  seniority: Seniority | null;
  education: { level: EduLevel; field: string } | null;
  required: string[];
  preferred: string[];
  certs: JobCert[];
  visa: boolean | null;
  deadline: string | null;
  publishedAt: string | null;
  apply: { method: ApplyMethod; target: string | null };
  url: string | null;
  source: string;
  resp: string[];
  isSample?: boolean;
  ownerId?: string | null;
}

export interface ProfileSkill { name: string; src: Provenance | "what-if" }
export interface ProfileEducation { degree: string; field: string; level: EduLevel | string; institution?: string; year?: string; result?: string | null }

/** Matching profile built only from verified career facts + preferences. */
export interface MatchProfile {
  name: string;
  titles: string[];
  currentTitle: string;
  currentCompany: string;
  years: number;
  seniority: Seniority;
  industries: string[];
  categories: string[];
  education: ProfileEducation[];
  certs: { name: string; status: string }[];
  skills: ProfileSkill[];
  targetRoles: string[];
  locations: string[];
  country: CountryCode;
  salaryMin: number | null;
  salaryMax: number | null;
  notice: number | null;
}

export interface Gap { k: string; skill?: string; o: number; t: string }
export type Band = "ex" | "st" | "po" | "lo";
export interface MatchResult {
  score: number;
  band: Band;
  f: Record<string, number | null>;
  matched: string[];
  gaps: Gap[];
  allGaps: Gap[];
  relevant: boolean;
  expired: boolean;
  capped: boolean;
  reason: string;
  reasonDetail: string;
}

// ---------- CV extraction ----------
export interface ExtractedExperience { title: string; company: string; start: string | null; end: string | null; industry?: string | null; location?: string | null }
export interface ExtractedEducation { degree: string; field: string; institution: string; year: string; level: EduLevel; result: string | null }
export interface ExtractedCert { name: string; status: "qualified" | "partly" | "in_progress"; detail: string | null }
export interface CvQuestion { id: string; question: string; placeholder: string }
export interface Extraction {
  name: string;
  email: string | null;
  phone: string | null;
  location: string | null;
  experiences: ExtractedExperience[];
  education: ExtractedEducation[];
  certifications: ExtractedCert[];
  skills: string[];
  languages: string[];
  industries: string[];
  categories: string[];
  seniority: Seniority;
  target_roles: string[];
  questions: CvQuestion[];
}

// ---------- Master CV ----------
export interface MasterExperience { title: string; company: string; location: string | null; start: string | null; end: string | null; bullets: string[] }
export interface MasterCV {
  name: string;
  headline: string;
  contact: string;
  summary: string;
  experience: MasterExperience[];
  education: string[];
  certifications: string[];
  skills_core: string[];
  skills_tools: string[];
  languages: string[];
  extra_skills?: string[];
  improvements?: { before: string; after: string }[];
}

export type InterviewTopic = "about_you" | "role" | "technical" | "behavioural" | "company" | "salary";
export interface InterviewPrep {
  questions: { topic: InterviewTopic; question: string; why: string; answer: string }[];
  ask_them: string[];
  checklist: string[];
}

export interface ApplicationPack {
  summary: string;
  top_bullets: string[];
  skills_order: string[];
  emphasis: string[];
  cover_letter: string;
  email_subject: string;
  email_body: string;
  checklist: string[];
}

export interface PersonalDetails { nationality?: string; dob?: string; visa?: string }
export interface CvStyle { tpl?: CvTemplate; accent?: string }

export interface Preferences {
  roles: string;
  locations: string;
  salaryMin: number | null;
  salaryMax: number | null;
  notice: number | null;
  mode: "On-site" | "Hybrid" | "Remote" | "Any";
}

export const APP_STATUSES = ["preparing", "ready", "reminder", "waiting", "applied", "interview", "offer", "closed", "withdrawn"] as const;
export type AppStatus = (typeof APP_STATUSES)[number];
export const STATUS_LABEL: Record<AppStatus, string> = { preparing: "Preparing", ready: "Application ready", reminder: "Reminder set", waiting: "Waiting for you", applied: "Applied", interview: "Interview", offer: "Offer", closed: "Rejected / Closed", withdrawn: "Withdrawn" };
