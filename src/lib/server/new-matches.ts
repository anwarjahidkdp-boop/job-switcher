// After each job collection run: for every user, take the strong matches they have not been told about yet,
// ring the bell, and email one digest a day. Application documents are created only after an explicit Apply click.
// Preparing is not applying: nothing is ever sent to an employer without the user's own press (see applications.ts).
import type { SupabaseClient } from "@supabase/supabase-js";
import { emailProvider } from "../email/send";
import { newMatchesEmail } from "../email/templates";
import { deliverEmail } from "./email-outbox";
import { notify } from "./notify";

export const NOTIFY_MIN_SCORE = 70;
/** Retained for callers checking an AI assessment; queue selection also enforces current deterministic safety. */
export const aiVerified = (r: { ai_fit?: string | null; ai_score?: number | null }) => r.ai_fit === "strong" || (r.ai_score ?? 0) >= 70;
const DIGEST_MAX = 8;
const NOTIFY_PER_RUN = 5;

export interface NewMatchResult { users: number; notified: number; prepared: number; emailed: number; failed: number }

interface Row { job_id: string; score: number; ai_fit?: string | null; ai_score?: number | null; jobs: { title: string; company: string; location: string | null; active: boolean } }

export async function processNewMatches(admin: SupabaseClient, userIds: string[], opts: { appUrl: string; dryRun?: boolean; prepare?: boolean }): Promise<NewMatchResult> {
  const res: NewMatchResult = { users: 0, notified: 0, prepared: 0, emailed: 0, failed: 0 };
  const base = opts.appUrl.replace(/\/$/, "");
  for (const userId of userIds) {
    try {
      const { data, error } = await admin.from("matches").select("job_id, score, ai_fit, ai_score, jobs!inner(title, company, location, active)")
        .eq("user_id", userId).is("notified_at", null).eq("relevant", true).gte("score", NOTIFY_MIN_SCORE).eq("jobs.active", true).or("ai_fit.is.null,ai_fit.neq.no")
        .order("score", { ascending: false }).limit(50);
      if (error) throw error;
      const { data: prof } = await admin.from("profiles").select("email, full_name, email_reminders, dismissed_job_ids").eq("id", userId).maybeSingle();
      const dismissed = new Set<string>((prof?.dismissed_job_ids as string[] | null) || []);
      const { data: apps } = await admin.from("applications").select("job_id, status").eq("user_id", userId);
      const started = new Set((apps || []).map((a) => a.job_id as string));
      const fresh = ((data || []) as unknown as Row[]).filter((r) => !dismissed.has(r.job_id) && !started.has(r.job_id));
      res.users++;

      const ready = new Set<string>();
      // Ranking is automatic; document generation is an explicit Apply action only.

      if (!fresh.length) continue;
      if (!opts.dryRun) {
        // In the app: one notification per strong new match (best few), so the bell and the email say the same thing.
        await notify(admin, userId, fresh.slice(0, NOTIFY_PER_RUN).map((r) => ready.has(r.job_id)
          ? { kind: "ready" as const, title: `Application ready: ${r.jobs.title} at ${r.jobs.company}`, body: `${r.score}% match. We prepared your CV and cover letter. Review it and apply?`, link: `/jobs/${r.job_id}`, key: `match:${r.job_id}` }
          : { kind: "match" as const, title: `New ${r.score}% match: ${r.jobs.title}`, body: `${r.jobs.company}${r.jobs.location ? ` · ${r.jobs.location}` : ""}. Want us to prepare your application?`, link: `/jobs/${r.job_id}`, key: `match:${r.job_id}` })).catch((e) => console.error("  notify failed", userId, e));
        if (prof?.email && prof.email_reminders !== false && emailProvider()) {
          const msg = newMatchesEmail({ name: prof.full_name || "", link: `${base}/inbox`, jobs: fresh.slice(0, DIGEST_MAX).map((r) => ({ title: r.jobs.title, company: r.jobs.company, location: r.jobs.location, score: r.score, link: `${base}/jobs/${r.job_id}`, ready: ready.has(r.job_id) })), total: fresh.length });
          // The market is scanned three times a day; the email digest goes out once a day at most (the bell gets every scan).
          const delivery = await deliverEmail(admin, userId, `matches-day:${new Date().toISOString().slice(0, 10)}`, { to: prof.email, ...msg });
          if (delivery === "sent") res.emailed++; else res.failed++;
        }
        const now = new Date().toISOString();
        await admin.from("matches").update({ notified_at: now }).eq("user_id", userId).in("job_id", fresh.map((r) => r.job_id));
      }
      res.notified += fresh.length;
    } catch (e) {
      res.failed++;
      console.error("  new matches failed", userId, e);
    }
  }
  return res;
}
