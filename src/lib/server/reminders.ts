// Sends due "apply later" reminder emails. Runs from GitHub Actions (scripts/reminders/run.ts) or the
// /api/cron/reminders endpoint. Uses the service role; never changes application status.
import type { SupabaseClient } from "@supabase/supabase-js";
import { cc, rule } from "../countries";
import { todayStr } from "../dates";
import { deliverEmail } from "./email-outbox";
import { reminderEmail } from "../email/templates";
import { notify } from "./notify";

const SEND_FROM_HOUR = 8;
export function localHour(timeZone: string, now: Date): number {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", hourCycle: "h23" }).format(now));
}

export interface ReminderRunResult { checked: number; sent: number; skipped: number; failed: number }

export async function sendDueReminders(admin: SupabaseClient, opts: { appUrl: string; now?: Date; limit?: number; dryRun?: boolean }): Promise<ReminderRunResult> {
  const now = opts.now || new Date();
  // The latest "today" anywhere on Earth; each user is then checked in their own country's time zone.
  const maxToday = todayStr("Pacific/Kiritimati", now);
  const { data, error } = await admin
    .from("reminders")
    .select("id, user_id, due_date, job_id, application_id, applications!inner(status, pack), jobs!inner(title, company, deadline)")
    .is("sent_at", null)
    .lte("due_date", maxToday)
    .order("due_date")
    .limit(opts.limit ?? 200);
  if (error) throw error;
  type Row = { id: string; user_id: string; due_date: string; job_id: string; application_id: string; applications: { status: string; pack: unknown }; jobs: { title: string; company: string; deadline: string | null }; profiles: { email: string | null; full_name: string | null; target_country: string; email_reminders: boolean } | null };
  // reminders.user_id references auth.users, so profiles are fetched separately (no PostgREST embed).
  const ids = [...new Set((data || []).map((r) => r.user_id as string))];
  const profs = new Map<string, Row["profiles"]>();
  if (ids.length) {
    const { data: pr, error: pe } = await admin.from("profiles").select("id, email, full_name, target_country, email_reminders").in("id", ids);
    if (pe) throw pe;
    for (const x of pr || []) profs.set(x.id as string, x as unknown as NonNullable<Row["profiles"]>);
  }
  const res: ReminderRunResult = { checked: 0, sent: 0, skipped: 0, failed: 0 };
  for (const r of (data || []) as unknown as Row[]) {
    res.checked++;
    const p = profs.get(r.user_id) || null;
    const tz = rule(cc(p?.target_country)).timeZone;
    const today = todayStr(tz, now);
    // Due today or earlier in the user's time zone, and not before 08:00 local time.
    if (r.due_date > today || (r.due_date === today && localHour(tz, now) < SEND_FROM_HOUR)) { res.skipped++; continue; }
    if (r.applications.status !== "reminder" || !p?.email || p.email_reminders === false) {
      if (!opts.dryRun) await admin.from("reminders").update({ sent_at: now.toISOString(), send_error: "skipped" }).eq("id", r.id);
      res.skipped++;
      continue;
    }
    const msg = reminderEmail({ name: p.full_name || "", jobTitle: r.jobs.title, company: r.jobs.company, deadline: r.jobs.deadline, link: `${opts.appUrl.replace(/\/$/, "")}/jobs/${r.job_id}`, packReady: !!r.applications.pack });
    if (opts.dryRun) { res.sent++; continue; }
    try {
      const delivery = await deliverEmail(admin, r.user_id, `reminder:${r.id}:${r.due_date}`, { to: p.email, ...msg, applicationId: r.application_id, dueDate: r.due_date });
      if (delivery !== "sent") { res.failed++; continue; }
      // The email went out: if this record fails, say so loudly, because the next run would send it again.
      const { error: ue } = await admin.from("reminders").update({ sent_at: now.toISOString(), send_error: null }).eq("id", r.id);
      if (ue) console.error("reminder sent but not recorded", r.id, ue);
      await notify(admin, r.user_id, [{ kind: "reminder", title: `Reminder: apply to ${r.jobs.company}`, body: `${r.jobs.title}. ${r.applications.pack ? "Your application is ready." : "Open it to prepare your application."}`, link: `/jobs/${r.job_id}`, key: `reminder:${r.id}` }]).catch(() => 0);
      res.sent++;
    } catch (e) {
      await admin.from("reminders").update({ send_error: String(e).slice(0, 300) }).eq("id", r.id);
      res.failed++;
    }
  }
  return res;
}
