// After each job collection run: for every user, take the strong matches they have not been told about yet,
// ring the bell, and email one digest a day. Application documents are created only after an explicit Apply click.
// Preparing is not applying: nothing is ever sent to an employer without the user's own press (see applications.ts).
import type { SupabaseClient } from "@supabase/supabase-js";
import { emailProvider } from "../email/send";
import { newMatchesEmail } from "../email/templates";
import { deliverEmail } from "./email-outbox";
import { notify } from "./notify";
import { aiConfigured } from "../ai";
import { fitCard, foundMs } from "./search-summary";
import { loadState } from "./state";
import { eligibleForMatchAlerts, matchPushRoom, MATCH_PUSH_PER_24H } from "../match-alert-policy";
import { inSendWindow } from "./reminders";

/** How long a new match waits for its AI reading before the bell rings on the rule score alone. */
const AI_WAIT_MS = 24 * 3_600_000;

export const NOTIFY_MIN_SCORE = 70;
/** Retained for callers checking an AI assessment; queue selection also enforces current deterministic safety. */
export const aiVerified = (r: { ai_fit?: string | null; ai_score?: number | null }) => r.ai_fit === "strong" || (r.ai_score ?? 0) >= 70;
const DIGEST_MAX = 8;
/** A match is "new" for the bell and email only if it was found for the person in the last three days. */
const NEW_FOR_MS = 3 * 86_400_000;
/** Same title at the same company: one job, even when the source lists it under two ids. */
export const sameJob = (r: { jobs: { title: string; company: string } }) => `${r.jobs.title}|${r.jobs.company}`.toLowerCase().replace(/\s+/g, " ").trim();
const NOTIFY_PER_RUN = MATCH_PUSH_PER_24H;

export interface NewMatchResult { users: number; notified: number; prepared: number; emailed: number; failed: number }

interface Row { job_id: string; score: number; ai_fit?: string | null; ai_score?: number | null; jobs: { title: string; company: string; location: string | null; active: boolean } }

export async function processNewMatches(admin: SupabaseClient, userIds: string[], opts: { appUrl: string; dryRun?: boolean; prepare?: boolean; now?: Date }): Promise<NewMatchResult> {
  const res: NewMatchResult = { users: 0, notified: 0, prepared: 0, emailed: 0, failed: 0 };
  const base = opts.appUrl.replace(/\/$/, "");
  const now = opts.now ?? new Date();
  for (const userId of userIds) {
    try {
      const { data, error } = await admin.from("matches").select("job_id, score, ai_fit, ai_score, jobs!inner(title, company, location, active)")
        .eq("user_id", userId).is("notified_at", null).eq("relevant", true).eq("jobs.active", true).or("ai_fit.is.null,ai_fit.neq.no")
        .order("score", { ascending: false }).limit(200);
      if (error) throw error;
      const [{ data: prof }, { data: subscription }] = await Promise.all([
        admin.from("profiles").select("email, full_name, target_country, email_reminders, dismissed_job_ids").eq("id", userId).maybeSingle(),
        admin.from("subscriptions").select("plan_code, status, trial_ends_at, current_period_end").eq("user_id", userId).maybeSingle(),
      ]);
      // Keep job discovery briefly after trial expiration, without restoring AI application access.
      // Never send a phone alert overnight in the users search country.
      if (!eligibleForMatchAlerts(subscription, now) || !inSendWindow(prof?.target_country, now)) continue;
      const dismissed = new Set<string>((prof?.dismissed_job_ids as string[] | null) || []);
      const { data: apps } = await admin.from("applications").select("job_id, status").eq("user_id", userId);
      const started = new Set((apps || []).map((a) => a.job_id as string));
      const candidates = ((data || []) as unknown as Row[]).filter((r) => !dismissed.has(r.job_id) && !started.has(r.job_id));
      res.users++;
      if (!candidates.length) continue;
      // The bell and the email speak the score the person sees on Home and in the lists: the live score from loadState,
      // which includes the AI's reading of the full post. The stored rule score is only the first pass.
      const st = await loadState(admin, userId, undefined, { skipApplications: true });
      const live = new Map((st?.scored || []).map((x) => [x.job.id, x]));
      const settled: string[] = [];
      const fresh: Row[] = [];
      for (const r of candidates) {
        const x = live.get(r.job_id);
        // Not yet read by the AI: wait for a later scan (hourly), so the bell never promises a score the page then lowers.
        // After a day it goes out on the rule score (the AI budget may be spent).
        if (x && aiConfigured() && !st?.aiCheck.has(r.job_id) && Date.now() - Date.parse(x.job.foundAt ?? x.job.addedAt ?? "") < AI_WAIT_MS) continue;
        settled.push(r.job_id);
        // The stored score is only the first pass, so a job is picked by its live score: 70%+ on the page, found recently.
        // Below 70% (or outside the field, or closed) it is not a Top match there either, so no bell.
        if (x && fitCard(x) !== "rest" && Date.now() - foundMs(x) <= NEW_FOR_MS) fresh.push({ ...r, score: x.m.score });
      }
      fresh.sort((a, b) => b.score - a.score);
      // The same post listed twice by a source (two ids) is one job to the person: mention it once.
      const seen = new Set<string>();
      const once = fresh.filter((r) => !seen.has(sameJob(r)) && !!seen.add(sameJob(r)));
      fresh.splice(0, fresh.length, ...once);

      // Notify only the best new jobs, not every low-fit match. No AI packs are generated here.
      let room = NOTIFY_PER_RUN;
      if (!opts.dryRun && fresh.length) {
        const cutoff = new Date(now.getTime() - 86_400_000).toISOString();
        const { count, error: capError } = await admin.from("notifications").select("id", { count: "exact", head: true })
          .eq("user_id", userId).eq("kind", "match").gte("created_at", cutoff);
        if (capError) throw capError;
        room = Math.min(NOTIFY_PER_RUN, matchPushRoom(count ?? 0));
      }
      const selected = fresh.slice(0, room);
      if (opts.dryRun) { res.notified += selected.length; continue; }
      const pending = new Set(fresh.slice(room).map((r) => r.job_id));
      const completed = settled.filter((id) => !pending.has(id));
      const sent: Row[] = [];
      for (const r of selected) {
        try {
          // Each job gets its own device alert and tap-through link, in descending fit order.
          await notify(admin, userId, [{ kind: "match", title: "New " + r.score + "% match: " + r.jobs.title,
            body: r.jobs.company + (r.jobs.location ? " · " + r.jobs.location : "") + ". See why it fits your profile.",
            link: "/jobs/" + r.job_id, key: "match:" + r.job_id }]);
          sent.push(r);
        } catch (e) {
          res.failed++;
          console.error("match alert failed", userId, r.job_id, e);
          const i = completed.indexOf(r.job_id);
          if (i >= 0) completed.splice(i, 1);
        }
      }
      if (prof?.email && prof.email_reminders !== false && emailProvider() && sent.length) {
        const msg = newMatchesEmail({ name: prof.full_name || "", link: base + "/inbox",
          jobs: sent.slice(0, DIGEST_MAX).map((r) => ({ title: r.jobs.title, company: r.jobs.company,
            location: r.jobs.location, score: r.score, link: base + "/jobs/" + r.job_id, ready: false })), total: sent.length });
        const delivery = await deliverEmail(admin, userId, "matches-day:" + now.toISOString().slice(0, 10), { to: prof.email, ...msg });
        if (delivery === "sent") res.emailed++; else res.failed++;
      }
      if (completed.length) {
        const { error: updateError } = await admin.from("matches").update({ notified_at: now.toISOString() }).eq("user_id", userId).in("job_id", completed);
        if (updateError) throw updateError;
      }
      res.notified += sent.length;
    } catch (e) {
      res.failed++;
      console.error("  new matches failed", userId, e);
    }
  }
  return res;
}
