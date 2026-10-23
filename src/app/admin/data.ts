// Drill-down lists behind every number on the admin dashboard (/admin/list?k=...). Server only, service role.
// Each key below matches one dashboard figure, with the same rule as admin_stats() in the database.
import type { SupabaseClient } from "@supabase/supabase-js";

export interface AdminUser {
  id: string; email: string | null; full_name: string | null; target_country: string; home_country: string; onboarding_step: string; created_at: string;
  status: string | null; trial_ends_at: string | null; current_period_end: string | null; payments: number; applied: number; interviews: number; ai_month_micro: number;
}
export interface AdminApp { id: string; user_id: string; email: string | null; status: string; created_at: string; applied_at: string | null; interview_at: string | null; title: string; company: string; country: string; hasPack: boolean }
export interface AdminJob { id: string; title: string; company: string; country: string; location: string | null; source_label: string | null; source_kind: string | null; created_at: string; url: string | null }
export interface AdminSource { id: string; kind: string; name: string | null; country: string | null; active: boolean; last_status: string | null; last_error: string | null; last_run_at: string | null; jobs_found: number | null }

const SENT = ["applied", "interview", "offer", "closed"];
const DAY = 86400000;

/** Every user with their plan, payment count, application counts and AI spend this month. Fine for thousands of users. */
export async function loadUsers(admin: SupabaseClient): Promise<AdminUser[]> {
  const month = new Date(); month.setUTCDate(1); month.setUTCHours(0, 0, 0, 0);
  const [p, s, pay, a, ai] = await Promise.all([
    admin.from("profiles").select("id, email, full_name, target_country, home_country, onboarding_step, created_at").order("created_at", { ascending: false }),
    admin.from("subscriptions").select("user_id, status, trial_ends_at, current_period_end"),
    admin.from("payments").select("user_id").eq("status", "approved"),
    admin.from("applications").select("user_id, status"),
    admin.from("ai_usage").select("user_id, cost_micro_usd").gte("created_at", month.toISOString()),
  ]);
  for (const r of [p, s, pay, a, ai]) if (r.error) throw new Error(r.error.message);
  const sub = new Map((s.data || []).map((x) => [x.user_id as string, x]));
  const count = (rows: { user_id: string }[] | null, keep: (x: never) => boolean = () => true) => {
    const m = new Map<string, number>();
    for (const x of rows || []) if (keep(x as never)) m.set(x.user_id, (m.get(x.user_id) || 0) + 1);
    return m;
  };
  const pays = count(pay.data as { user_id: string }[]);
  const applied = count(a.data as { user_id: string }[], (x: { status: string }) => SENT.includes(x.status));
  const interviews = count(a.data as { user_id: string }[], (x: { status: string }) => x.status === "interview" || x.status === "offer");
  const spend = new Map<string, number>();
  for (const x of ai.data || []) spend.set(x.user_id as string, (spend.get(x.user_id as string) || 0) + Number(x.cost_micro_usd || 0));
  return (p.data || []).map((u) => {
    const x = sub.get(u.id as string);
    return { ...(u as Omit<AdminUser, "status" | "trial_ends_at" | "current_period_end" | "payments" | "applied" | "interviews" | "ai_month_micro">),
      status: x?.status ?? null, trial_ends_at: x?.trial_ends_at ?? null, current_period_end: x?.current_period_end ?? null,
      payments: pays.get(u.id as string) || 0, applied: applied.get(u.id as string) || 0, interviews: interviews.get(u.id as string) || 0, ai_month_micro: spend.get(u.id as string) || 0 };
  });
}

/** The user filters, one per dashboard tile. `now` is passed in so every list on one page uses the same moment. */
export function userFilter(k: string, now: number): ((u: AdminUser) => boolean) | null {
  const t = (s: string | null) => (s ? Date.parse(s) : NaN);
  const ended = (u: AdminUser) => t(u.trial_ends_at) <= now;
  const lapsed = (u: AdminUser) => u.payments > 0 && (["expired", "canceled", "past_due"].includes(u.status || "") || (u.status === "active" && t(u.current_period_end) <= now));
  const [kind, code] = k.split(":");
  if (kind === "target" && code) return (u) => u.target_country === code;
  if (kind === "home" && code) return (u) => u.home_country === code;
  const F: Record<string, (u: AdminUser) => boolean> = {
    users: () => true,
    onboarded: (u) => u.onboarding_step === "done",
    not_onboarded: (u) => u.onboarding_step !== "done",
    new7: (u) => t(u.created_at) > now - 7 * DAY,
    new30: (u) => t(u.created_at) > now - 30 * DAY,
    trial_active: (u) => u.status === "trialing" && t(u.trial_ends_at) > now,
    trial_ended: ended,
    trial_unpaid: (u) => ended(u) && u.payments === 0,
    paid: (u) => u.payments > 0,
    pro_active: (u) => u.status === "active" && (!u.current_period_end || t(u.current_period_end) > now),
    renewed: (u) => u.payments >= 2,
    lapsed,
    users_applied: (u) => u.applied > 0,
    users_interview: (u) => u.interviews > 0,
    ai: (u) => u.ai_month_micro > 0,
  };
  return F[kind] || null;
}

export const USER_TITLES: Record<string, string> = {
  users: "All users", onboarded: "Finished onboarding", not_onboarded: "Did not finish onboarding", new7: "New in 7 days", new30: "New in 30 days",
  trial_active: "Trials running", trial_ended: "Trials ended", trial_unpaid: "Trial ended, did not pay", paid: "Paying users (ever)", pro_active: "Pro active now",
  renewed: "Renewed (2+ payments)", lapsed: "Pro lapsed, not renewed", users_applied: "Users who applied", users_interview: "Users with an interview", ai: "AI spend this month, by user",
};

/** Application lists: prepared packs, sent, interviews, offers, closed; optionally for one user. */
export const APP_TITLES: Record<string, string> = { prepared: "Applications prepared", sent: "Applications sent", interviews: "Interviews", offers: "Offers", closed: "Rejected / closed" };
export async function loadApps(admin: SupabaseClient, k: string, userId?: string): Promise<AdminApp[]> {
  let q = admin.from("applications").select("id, user_id, status, created_at, applied_at, interview_at, pack, jobs(title, company, country)").order("created_at", { ascending: false }).limit(500);
  if (userId) q = q.eq("user_id", userId);
  if (k === "prepared") q = q.not("pack", "is", null);
  else if (k === "sent") q = q.in("status", SENT);
  else if (k === "interviews") q = q.in("status", ["interview", "offer"]);
  else if (k === "offers") q = q.eq("status", "offer");
  else if (k === "closed") q = q.eq("status", "closed");
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  // applications.user_id points at auth.users, so emails come from profiles in a second query.
  const ids = [...new Set((data || []).map((r) => r.user_id as string))];
  const { data: ps } = ids.length ? await admin.from("profiles").select("id, email").in("id", ids) : { data: [] };
  const email = new Map((ps || []).map((p) => [p.id as string, p.email as string | null]));
  type R = { id: string; user_id: string; status: string; created_at: string; applied_at: string | null; interview_at: string | null; pack: unknown; jobs: { title: string; company: string; country: string } | null };
  return ((data || []) as unknown as R[]).map((r) => ({ id: r.id, user_id: r.user_id, email: email.get(r.user_id) ?? null, status: r.status, created_at: r.created_at, applied_at: r.applied_at, interview_at: r.interview_at,
    title: r.jobs?.title || "Job removed", company: r.jobs?.company || "", country: r.jobs?.country || "", hasPack: r.pack != null }));
}

/** Job lists: all active, new in 24 hours, or active in one country (newest 300). */
export async function loadJobs(admin: SupabaseClient, k: string): Promise<{ rows: AdminJob[]; total: number }> {
  let q = admin.from("jobs").select("id, title, company, country, location, source_label, source_kind, created_at, url", { count: "exact" }).order("created_at", { ascending: false }).limit(300);
  const [kind, code] = k.split(":");
  if (kind === "jobs_new") q = q.gt("created_at", new Date(Date.now() - DAY).toISOString());
  else q = q.eq("active", true);
  if (kind === "jobs" && code) q = q.eq("country", code);
  const { data, error, count } = await q;
  if (error) throw new Error(error.message);
  return { rows: (data || []) as AdminJob[], total: count || 0 };
}

export async function loadSources(admin: SupabaseClient, onlyFailing: boolean): Promise<AdminSource[]> {
  let q = admin.from("ingestion_sources").select("id, kind, name, country, active, last_status, last_error, last_run_at, jobs_found").or("active.eq.true,last_status.eq.access_required").order("last_status").order("jobs_found", { ascending: false, nullsFirst: false });
  if (onlyFailing) q = q.eq("last_status", "error");
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data || []) as AdminSource[];
}
