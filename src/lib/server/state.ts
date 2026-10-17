// Loads everything a signed-in page needs, through a Supabase client (user-scoped with RLS, or admin for cron/inbound).
import type { SupabaseClient } from "@supabase/supabase-js";
import { cc, type CountryCode } from "../countries";
import { todayStr } from "../dates";
import { buildMatchProfile, type CareerFact, type CareerMeta } from "../facts";
import { rowToJob, type JobRow } from "../jobs";
import { scoreAll, type Scored } from "../matching";
import { rule } from "../countries";
import type { AppStatus, ApplicationPack, CvQuestion, CvStyle, MasterCV, MatchProfile, PersonalDetails, Preferences } from "../types";

export interface ProfileRow {
  id: string; email: string | null; full_name: string | null; phone: string | null; city: string | null;
  target_country: string; home_country: string; needs_visa: boolean; personal: PersonalDetails; preferences: Preferences | null;
  career_meta: Partial<CareerMeta>; cv_style: CvStyle; photo_path: string | null; onboarding_step: string;
  setup_steps: Record<string, boolean>; dismissed_job_ids: string[]; email_reminders: boolean; created_at: string;
}
export interface ApplicationRow {
  id: string; user_id: string; job_id: string; status: AppStatus; pack: ApplicationPack | null; pack_flags: string[]; pack_ai: boolean; pack_model: string | null;
  reminder_date: string | null; applied_at: string | null; created_at: string; updated_at: string;
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

export async function loadVisibleJobs(db: SupabaseClient, userId: string, country: string) {
  // Public jobs + this user's private jobs (paste / alert). RLS enforces the same for user clients;
  // the explicit owner filter makes admin-client calls equally safe.
  const { data } = await db.from("jobs").select("*").eq("country", country).eq("active", true).or(`owner_id.is.null,owner_id.eq.${userId}`).order("created_at", { ascending: false }).limit(1000);
  return ((data || []) as JobRow[]).map(rowToJob);
}

export async function loadState(db: SupabaseClient, userId: string): Promise<UserState | null> {
  const profile = await loadProfile(db, userId);
  if (!profile) return null;
  const country = cc(profile.target_country);
  const today = todayStr(rule(country).timeZone);
  const [facts, cvRes, masterRes, appsRes] = await Promise.all([
    loadFacts(db, userId),
    db.from("cv_documents").select("id, text_content, questions, answers, is_demo, file_name, storage_path, created_at").eq("user_id", userId).eq("is_current", true).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("master_cvs").select("id, content, flags, ai, model, created_at, version").eq("user_id", userId).eq("is_current", true).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("applications").select("*, application_events(event, status, actor, created_at)").eq("user_id", userId),
  ]);
  const master = (masterRes.data as MasterRow) || null;
  const P = profileFrom(profile, facts, master);
  const jobs = P ? await loadVisibleJobs(db, userId, country) : [];
  // Jobs referenced by applications may be in another country (after a country change); load them too.
  const apps: Record<string, ApplicationRow> = {};
  for (const a of (appsRes.data || []) as ApplicationRow[]) {
    a.application_events = (a.application_events || []).sort((x, y) => x.created_at.localeCompare(y.created_at));
    apps[a.job_id] = a;
  }
  const homeCountry = cc(profile.home_country);
  const scored = P ? scoreAll(jobs, P, { today, needVisa: profile.needs_visa, homeCountry }) : [];
  return { userId, profile, country, homeCountry, today, facts, cvDoc: (cvRes.data as CvDocRow) || null, master, P, scored, apps, dismissed: new Set(profile.dismissed_job_ids || []) };
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
    analysed: st.scored.length, relevant: rel.length, strong: rel.filter((x) => x.m.score >= 70 && !x.m.expired).length,
    prepared: apps.filter((a) => a.pack).length, applied: apps.filter((a) => ["applied", "interview", "offer", "closed"].includes(a.status)).length,
    reminders: apps.filter((a) => a.status === "reminder").length, interviews: apps.filter((a) => a.status === "interview").length, offers: apps.filter((a) => a.status === "offer").length,
  };
}
