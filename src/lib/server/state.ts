// Loads everything a signed-in page needs, through a Supabase client (user-scoped with RLS, or admin for cron/inbound).
import type { SupabaseClient } from "@supabase/supabase-js";
import { cc, type CountryCode } from "../countries";
import { todayStr } from "../dates";
import { buildMatchProfile, type CareerFact, type CareerMeta } from "../facts";
import { rowToJob, type JobRow } from "../jobs";
import { scoreAll, type Scored } from "../matching";
import { rule } from "../countries";
import type { AppStatus, ApplicationPack, CvQuestion, InterviewPrep, CvStyle, MasterCV, MatchProfile, PersonalDetails, Preferences } from "../types";

export interface ProfileRow {
  id: string; email: string | null; full_name: string | null; phone: string | null; city: string | null;
  target_country: string; home_country: string; needs_visa: boolean; personal: PersonalDetails; preferences: Preferences | null;
  career_meta: Partial<CareerMeta>; cv_style: CvStyle; photo_path: string | null; onboarding_step: string;
  setup_steps: Record<string, boolean | string>; dismissed_job_ids: string[]; email_reminders: boolean; created_at: string;
}
export interface ApplicationRow {
  id: string; user_id: string; job_id: string; status: AppStatus; pack: ApplicationPack | null; pack_flags: string[]; pack_ai: boolean; pack_model: string | null;
  reminder_date: string | null; applied_at: string | null; created_at: string; updated_at: string;
  interview_at?: string | null; interview_mode?: "in_person" | "phone" | "video" | null; interview_where?: string | null; interview_notes?: string | null;
  interview_prep?: InterviewPrep | null; interview_prep_ai?: boolean;
  application_events?: { event: string; status: string | null; actor: string; created_at: string }[];
}
export interface CvDocRow { id: string; text_content: string; questions: CvQuestion[]; answers: Record<string, string>; is_demo: boolean; file_name: string | null; storage_path: string | null; created_at: string }
export interface MasterRow { id: string; content: MasterCV; flags: string[]; ai: boolean; model: string | null; created_at: string; version: number }

export interface UserState {
  userId: string;
  profile: ProfileRow;
  country: CountryCode;
  homeCountry: CountryCode;
  today: string;
  facts: CareerFact[];
  cvDoc: CvDocRow | null;
  master: MasterRow | null;
  P: MatchProfile | null;
  scored: Scored[];
  /** All open jobs in the target country, including ones outside the person's categories (not scored). */
  analysed: number;
  apps: Record<string, ApplicationRow>;
  dismissed: Set<string>;
}

export const DEFAULT_META: CareerMeta = { industries: [], categories: [], seniority: "mid", target_roles: [], location: null };

export async function loadProfile(db: SupabaseClient, userId: string): Promise<ProfileRow | null> {
  const { data } = await db.from("profiles").select("*").eq("id", userId).maybeSingle();
  return (data as ProfileRow) || null;
}

export async function loadFacts(db: SupabaseClient, userId: string): Promise<CareerFact[]> {
  const { data } = await db.from("career_facts").select("id, kind, data, provenance, verified, evidence").eq("user_id", userId).order("created_at");
  return (data || []) as CareerFact[];
}

export function profileFrom(profile: ProfileRow, facts: CareerFact[], master: MasterRow | null): MatchProfile | null {
  if (!master) return null;
  const meta = { ...DEFAULT_META, ...(profile.career_meta || {}) } as CareerMeta;
  return buildMatchProfile({ name: profile.full_name || master.content.name, facts, meta, prefs: profile.preferences, country: profile.target_country });
}

// Everything rowToJob reads; the long description and raw payload stay out of list loads (job pages fetch the full row).
const LIST_COLS = "id, owner_id, source_kind, source_label, country, title, company, industry, category, location, employment_type, salary_min, salary_max, min_years, max_years, seniority, education, required_skills, preferred_skills, certs, visa_sponsorship, deadline, published_at, apply_method, apply_target, url, responsibilities, is_sample";

const pgQuote = (v: string) => `"${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

/**
 * Public jobs in the person's categories + all of their private jobs (paste / alert). RLS enforces the
 * owner rule for user clients; the explicit filter makes admin-client calls equally safe.
 * Only a job in one of the person's categories can be relevant (roleRel scores below 0.6 otherwise), so
 * scoring the rest on every page view only burns Worker CPU.
 */
export async function loadVisibleJobs(db: SupabaseClient, userId: string, country: string, categories: string[]) {
  const cats = categories.filter(Boolean).map(pgQuote).join(",");
  const visible = cats ? `and(owner_id.is.null,category.in.(${cats})),owner_id.eq.${userId}` : `owner_id.eq.${userId}`;
  const { data } = await db.from("jobs").select(LIST_COLS).eq("country", country).eq("active", true).or(visible).order("created_at", { ascending: false }).limit(1000);
  return ((data || []) as JobRow[]).map(rowToJob);
}

/** How many open jobs we checked in this country (the dashboard's "Jobs analysed"). */
async function countVisibleJobs(db: SupabaseClient, userId: string, country: string): Promise<number> {
  const { count } = await db.from("jobs").select("id", { count: "exact", head: true }).eq("country", country).eq("active", true).or(`owner_id.is.null,owner_id.eq.${userId}`);
  return count || 0;
}

export async function loadState(db: SupabaseClient, userId: string, profileP?: Promise<ProfileRow | null>): Promise<UserState | null> {
  // The profile and the person's own rows load together; only the job list waits for the profile (country, categories).
  const [profile, facts, cvRes, masterRes, appsRes] = await Promise.all([
    profileP || loadProfile(db, userId),
    loadFacts(db, userId),
    db.from("cv_documents").select("id, text_content, questions, answers, is_demo, file_name, storage_path, created_at").eq("user_id", userId).eq("is_current", true).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("master_cvs").select("id, content, flags, ai, model, created_at, version").eq("user_id", userId).eq("is_current", true).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("applications").select("*, application_events(event, status, actor, created_at)").eq("user_id", userId),
  ]);
  if (!profile) return null;
  const country = cc(profile.target_country);
  const today = todayStr(rule(country).timeZone);
  const master = (masterRes.data as MasterRow) || null;
  const P = profileFrom(profile, facts, master);
  const [jobs, analysed] = P ? await Promise.all([loadVisibleJobs(db, userId, country, P.categories), countVisibleJobs(db, userId, country)]) : [[], 0];
  // Jobs referenced by applications may be in another country (after a country change); load them too.
  const apps: Record<string, ApplicationRow> = {};
  for (const a of (appsRes.data || []) as ApplicationRow[]) {
    a.application_events = (a.application_events || []).sort((x, y) => x.created_at.localeCompare(y.created_at));
    apps[a.job_id] = a;
  }
  const homeCountry = cc(profile.home_country);
  const scored = P ? scoreAll(jobs, P, { today, needVisa: profile.needs_visa, homeCountry }) : [];
  return { userId, profile, country, homeCountry, today, facts, cvDoc: (cvRes.data as CvDocRow) || null, master, P, scored, analysed, apps, dismissed: new Set(profile.dismissed_job_ids || []) };
}

export async function loadJob(db: SupabaseClient, jobId: string) {
  const { data } = await db.from("jobs").select("*").eq("id", jobId).maybeSingle();
  return data ? rowToJob(data as JobRow) : null;
}

/** Stats for the inbox side panel and applications page (prototype stats()). */
export function stats(st: UserState) {
  const rel = st.scored.filter((x) => x.m.relevant);
  const apps = Object.values(st.apps);
  return {
    analysed: Math.max(st.analysed, st.scored.length), relevant: rel.length, strong: rel.filter((x) => x.m.score >= 70 && !x.m.expired).length,
    prepared: apps.filter((a) => a.pack).length, applied: apps.filter((a) => ["applied", "interview", "offer", "closed"].includes(a.status)).length,
    reminders: apps.filter((a) => a.status === "reminder").length, interviews: apps.filter((a) => a.status === "interview").length, offers: apps.filter((a) => a.status === "offer").length,
  };
}
