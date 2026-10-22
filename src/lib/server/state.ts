// Loads everything a signed-in page needs, through a Supabase client (user-scoped with RLS, or admin for cron/inbound).
import type { SupabaseClient } from "@supabase/supabase-js";
import { cc, type CountryCode } from "../countries";
import { todayStr } from "../dates";
import { buildMatchProfile, type CareerFact, type CareerMeta } from "../facts";
import { rowToJob, type JobRow } from "../jobs";
import { bandOf, CAP_SCORE, scoreAll, type Scored } from "../matching";
import { rule } from "../countries";
import type { AppStatus, ApplicationPack, CvQuestion, InterviewPrep, CvStyle, MasterCV, MatchProfile, PersonalDetails, Preferences } from "../types";

export type AiFit = "strong" | "partial" | "no";
export interface AiCheck { fit: AiFit; score: number | null; reason: string }

export interface ProfileRow {
  id: string; email: string | null; full_name: string | null; phone: string | null; city: string | null;
  target_country: string; home_country: string; needs_visa: boolean; personal: PersonalDetails; preferences: Preferences | null;
  career_meta: Partial<CareerMeta>; cv_style: CvStyle; photo_path: string | null; onboarding_step: string;
  setup_steps: Record<string, boolean | string>; dismissed_job_ids: string[]; email_reminders: boolean; deal_breakers: Record<string, unknown>; answer_library: Record<string, unknown>; created_at: string;
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
  /** AI check of the top matches (see match-check.ts), by job id. */
  aiCheck: Map<string, AiCheck>;
}

export const DEFAULT_META: CareerMeta = { industries: [], categories: [], seniority: "mid", target_roles: [], location: null };

export async function loadProfile(db: SupabaseClient, userId: string): Promise<ProfileRow | null> {
  const { data, error } = await db.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) throw error;
  return (data as ProfileRow) || null;
}

export async function loadFacts(db: SupabaseClient, userId: string): Promise<CareerFact[]> {
  const { data, error } = await db.from("career_facts").select("id, kind, data, provenance, verified, evidence").eq("user_id", userId).order("created_at");
  if (error) throw error;
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
 *
 * Page views score at most ~300 jobs (the free Worker plan allows 10 ms of CPU): the newest ones plus the best
 * matches the daily refresh stored in `matches`. The daily refresh itself (all: true) scores every job, so a
 * strong match is never missed; a person with no stored matches yet also gets the full list.
 */
export const PAGE_NEWEST = 150, PAGE_BEST = 150, ALL_LIMIT = 1000;
export async function loadVisibleJobs(db: SupabaseClient, userId: string, country: string, categories: string[], opts: { all?: boolean } = {}) {
  const cats = categories.filter(Boolean).map(pgQuote).join(",");
  const visible = cats ? `and(owner_id.is.null,category.in.(${cats})),owner_id.eq.${userId}` : `owner_id.eq.${userId}`;
  const base = () => db.from("jobs").select(LIST_COLS).eq("country", country).eq("active", true).or(visible);
  const rows = (r: { data: unknown; error: unknown }) => { if (r.error) throw r.error; return (r.data || []) as JobRow[]; };
  if (!opts.all) {
    const best = await db.from("matches").select("job_id").eq("user_id", userId).eq("relevant", true).order("score", { ascending: false }).limit(PAGE_BEST);
    const ids = ((best.data || []) as { job_id: string }[]).map((r) => r.job_id);
    if (!best.error && ids.length) {
      const [newest, own, top] = await Promise.all([
        base().order("created_at", { ascending: false }).limit(PAGE_NEWEST),
        db.from("jobs").select(LIST_COLS).eq("owner_id", userId).eq("country", country).eq("active", true).order("created_at", { ascending: false }).limit(200),
        base().in("id", ids),
      ]);
      const seen = new Map<string, JobRow>();
      for (const j of [...rows(newest), ...rows(own), ...rows(top)]) seen.set(j.id, j);
      return [...seen.values()].map(rowToJob);
    }
  }
  if (opts.all) {
    const all: JobRow[] = [];
    for (let from = 0; ; from += ALL_LIMIT) {
      const page = rows(await base().order("id").range(from, from + ALL_LIMIT - 1));
      all.push(...page);
      if (page.length < ALL_LIMIT) break;
    }
    return all.map(rowToJob);
  }
  return rows(await base().order("created_at", { ascending: false }).limit(ALL_LIMIT)).map(rowToJob);
}

/** How many open jobs we checked in this country (the dashboard's "Jobs analysed"). */
async function countVisibleJobs(db: SupabaseClient, userId: string, country: string): Promise<number> {
  const { count, error } = await db.from("jobs").select("id", { count: "exact", head: true }).eq("country", country).eq("active", true).or(`owner_id.is.null,owner_id.eq.${userId}`);
  if (error) throw error;
  return count || 0;
}

export async function loadState(db: SupabaseClient, userId: string, profileP?: Promise<ProfileRow | null>, opts: { allJobs?: boolean } = {}): Promise<UserState | null> {
  // The profile and the person's own rows load together; only the job list waits for the profile (country, categories).
  const [profile, facts, cvRes, masterRes, appsRes, checkRes] = await Promise.all([
    profileP || loadProfile(db, userId),
    loadFacts(db, userId),
    db.from("cv_documents").select("id, text_content, questions, answers, is_demo, file_name, storage_path, created_at").eq("user_id", userId).eq("is_current", true).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("master_cvs").select("id, content, flags, ai, model, created_at, version").eq("user_id", userId).eq("is_current", true).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("applications").select("*, application_events(event, status, actor, created_at)").eq("user_id", userId),
    db.from("matches").select("job_id, ai_fit, ai_score, ai_reason").eq("user_id", userId).not("ai_fit", "is", null),
  ]);
  if (!profile) return null;
  // A failed read must show the error page, never look like "no CV" (which sends people back to onboarding) or "no jobs".
  for (const r of [cvRes, masterRes, appsRes, checkRes]) if (r.error) throw r.error;
  const country = cc(profile.target_country);
  const today = todayStr(rule(country).timeZone);
  const master = (masterRes.data as MasterRow) || null;
  const P = profileFrom(profile, facts, master);
  const [jobs, analysed] = P ? await Promise.all([loadVisibleJobs(db, userId, country, P.categories, { all: opts.allJobs }), countVisibleJobs(db, userId, country)]) : [[], 0];
  // Jobs referenced by applications may be in another country (after a country change); load them too.
  const apps: Record<string, ApplicationRow> = {};
  for (const a of (appsRes.data || []) as ApplicationRow[]) {
    a.application_events = (a.application_events || []).sort((x, y) => x.created_at.localeCompare(y.created_at));
    apps[a.job_id] = a;
  }
  const homeCountry = cc(profile.home_country);
  // The AI check read the full post next to the CV: "no" means a different profession or clearly unqualified, so it is hidden like a dismissed job.
  const aiCheck = new Map(((checkRes.data || []) as { job_id: string; ai_fit: AiFit; ai_score: number | null; ai_reason: string | null }[]).map((r) => [r.job_id, { fit: r.ai_fit, score: r.ai_score, reason: r.ai_reason || "" }]));
  const dismissed = new Set([...(profile.dismissed_job_ids || []), ...[...aiCheck].filter(([, c]) => c.fit === "no").map(([id]) => id)]);
  const scored = P ? withAiScores(scoreAll(jobs, P, { today, needVisa: profile.needs_visa, homeCountry }), aiCheck) : [];
  return { userId, profile, country, homeCountry, today, facts, cvDoc: (cvRes.data as CvDocRow) || null, master, P, scored, analysed, apps, dismissed, aiCheck };
}

/**
 * Where the AI read the full post next to the CV (profession, must-haves, experience, industry, level, duties),
 * its score replaces the rule-based one; the rule score stays as the first pass for jobs not yet checked.
 */
export function withAiScores(scored: Scored[], aiCheck: Map<string, AiCheck>): Scored[] {
  return scored.map((x) => {
    const c = aiCheck.get(x.job.id);
    if (!c || c.score == null) return x;
    const score = x.m.capped ? Math.min(c.score, CAP_SCORE) : c.score;
    return { job: x.job, m: { ...x.m, score, band: bandOf(score), relevant: x.m.relevant && c.fit !== "no" } };
  });
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
