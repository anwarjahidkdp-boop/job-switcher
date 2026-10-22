// After each job collection run: for every user, take the strong matches they have not been told about yet,
// prepare application packs for the best few (Pro and trial users, within their AI allowance) and email one digest.
// Preparing is not applying: nothing is ever sent to an employer without the user's own press (see applications.ts).
import type { SupabaseClient } from "@supabase/supabase-js";
import { aiConfigured, checkBudget, getBudget } from "../ai";
import { emailProvider, sendEmail } from "../email/send";
import { newMatchesEmail } from "../email/templates";
import { ApplicationSafetyError, preparePack } from "./applications";
import { notify } from "./notify";

export const NOTIFY_MIN_SCORE = 70;
export const PREPARE_MIN_SCORE = 80;
export const PREPARE_PER_RUN = 2;
/** AI-prepared packs cost money; with this many still waiting unsent, we stop preparing new ones until the person acts. */
export const PREPARED_WAITING_MAX = 3;
/** Only jobs our AI check read against the CV and rated a strong fit are prepared ahead; the rest are one tap away. */
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
      if (!fresh.length) continue;
      res.users++;

      const ready = new Set<string>();
      if (opts.prepare !== false && aiConfigured() && !opts.dryRun && (await canSpend(admin, userId))) {
        const waiting = (apps || []).filter((a) => a.status === "ready").length;
        const room = Math.max(0, Math.min(PREPARE_PER_RUN, PREPARED_WAITING_MAX - waiting));
        for (const r of fresh.filter((x) => x.score >= PREPARE_MIN_SCORE && aiVerified(x)).slice(0, room)) {
          try {
            const out = await preparePack({ db: admin, admin, userId }, r.job_id);
            if (out.ai) ready.add(r.job_id);
            res.prepared++;
            if (!out.ai) break; // out of allowance or AI unavailable: stop spending, the template pack is still saved
          } catch (e) { if (e instanceof ApplicationSafetyError) { console.info("  auto-prepare skipped by application safety", userId, r.job_id); continue; } console.error("  prepare failed", userId, r.job_id, e); break; }
        }
      }

      if (!opts.dryRun) {
        // In the app: one notification per strong new match (best few), so the bell and the email say the same thing.
        await notify(admin, userId, fresh.slice(0, NOTIFY_PER_RUN).map((r) => ready.has(r.job_id)
          ? { kind: "ready" as const, title: `Application ready: ${r.jobs.title} at ${r.jobs.company}`, body: `${r.score}% match. We prepared your CV and cover letter. Review it and apply?`, link: `/jobs/${r.job_id}`, key: `match:${r.job_id}` }
          : { kind: "match" as const, title: `New ${r.score}% match: ${r.jobs.title}`, body: `${r.jobs.company}${r.jobs.location ? ` · ${r.jobs.location}` : ""}. Want us to prepare your application?`, link: `/jobs/${r.job_id}`, key: `match:${r.job_id}` })).catch((e) => console.error("  notify failed", userId, e));
        if (prof?.email && prof.email_reminders !== false && emailProvider()) {
          const msg = newMatchesEmail({ name: prof.full_name || "", link: `${base}/inbox`, jobs: fresh.slice(0, DIGEST_MAX).map((r) => ({ title: r.jobs.title, company: r.jobs.company, location: r.jobs.location, score: r.score, link: `${base}/jobs/${r.job_id}`, ready: ready.has(r.job_id) })), total: fresh.length });
          await sendEmail({ to: prof.email, ...msg });
          res.emailed++;
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

async function canSpend(admin: SupabaseClient, userId: string) {
  try { checkBudget(await getBudget(admin, userId)); return true; } catch { return false; }
}
