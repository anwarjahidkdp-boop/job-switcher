// Hourly nudges (run with the reminders job): ask "any reply?" after applying, remind about interviews,
// warn before the trial ends and send a weekly career tip. Each one is an in-app notification (deduped), and the
// important ones are also emailed once. Nothing here contacts an employer.
import type { SupabaseClient } from "@supabase/supabase-js";
import { emailProvider, sendEmail } from "../email/send";
import { nudgeEmail } from "../email/templates";
import { notify, type NewNotification } from "./notify";

const DAY = 86_400_000;
export const REPLY_CHECK_DAYS = 5;
export const FOLLOWUP_DAYS = 7;

/** ISO week label like 2026-W43, used to send the career tip once a week. */
export function isoWeek(d: Date): string {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y = t.getUTCFullYear();
  const w = Math.ceil(((t.getTime() - Date.UTC(y, 0, 1)) / DAY + 1) / 7);
  return `${y}-W${String(w).padStart(2, "0")}`;
}

type Profile = { id: string; email: string | null; full_name: string | null; email_reminders: boolean | null };

export async function sendNudges(admin: SupabaseClient, opts: { appUrl: string; now?: Date; dryRun?: boolean }) {
  const now = opts.now || new Date();
  const base = opts.appUrl.replace(/\/$/, "");
  const res = { notified: 0, emailed: 0, failed: 0 };
  const queue = new Map<string, { n: NewNotification; email?: { subject: string; body: string; button: string } }[]>();
  const add = (userId: string, n: NewNotification, email?: { subject: string; body: string; button: string }) => {
    const l = queue.get(userId) || [];
    l.push({ n, email });
    queue.set(userId, l);
  };

  // 1. Applied 5+ days ago and we have not asked yet: "Any reply?"
  const { data: applied } = await admin.from("applications").select("id, user_id, job_id, applied_at, jobs!inner(title, company)")
    .eq("status", "applied").is("reply_checked_at", null).lte("applied_at", new Date(now.getTime() - REPLY_CHECK_DAYS * DAY).toISOString()).limit(500);
  for (const a of (applied || []) as unknown as { id: string; user_id: string; job_id: string; jobs: { title: string; company: string } }[]) {
    add(a.user_id, { kind: "reply", title: `Any reply from ${a.jobs.company}?`, body: `You applied for ${a.jobs.title}. Tell us if you got an interview call, and we will prepare you for it.`, link: `/jobs/${a.job_id}#reply`, key: `reply:${a.id}` },
      { subject: `Any reply from ${a.jobs.company}?`, body: `You applied for ${a.jobs.title} at ${a.jobs.company} a few days ago. Got an interview call? Tell us in one tap and we will prepare your interview answers. No reply yet? We have a short follow-up email ready for you to send.`, button: "Update my application" });
  }

  // 2. Interview in the next 24 hours.
  const { data: iv } = await admin.from("applications").select("id, user_id, job_id, interview_at, jobs!inner(title, company)")
    .eq("status", "interview").gte("interview_at", now.toISOString()).lte("interview_at", new Date(now.getTime() + DAY).toISOString()).limit(500);
  for (const a of (iv || []) as unknown as { id: string; user_id: string; job_id: string; interview_at: string; jobs: { title: string; company: string } }[]) {
    add(a.user_id, { kind: "interview", title: `Interview soon with ${a.jobs.company}`, body: "Practise your answers now: your interview prep is ready in the app.", link: `/jobs/${a.job_id}`, key: `interview:${a.id}:${a.interview_at.slice(0, 10)}` },
      { subject: `Your ${a.jobs.company} interview is coming up`, body: `Your interview for ${a.jobs.title} at ${a.jobs.company} is within the next day. Open JobPao to practise the likely questions and your answers.`, button: "Practise now" });
  }

  // 3. Trial ending in the next 36 hours, and trial just ended.
  const { data: trials } = await admin.from("subscriptions").select("user_id, trial_ends_at").eq("status", "trialing")
    .gte("trial_ends_at", new Date(now.getTime() - 3 * DAY).toISOString()).lte("trial_ends_at", new Date(now.getTime() + 1.5 * DAY).toISOString()).limit(1000);
  for (const t of (trials || []) as { user_id: string; trial_ends_at: string }[]) {
    if (Date.parse(t.trial_ends_at) > now.getTime()) {
      add(t.user_id, { kind: "trial", title: "Your free trial ends tomorrow", body: "See what JobPao did for you this week, and keep your assistant working.", link: "/inbox#trial", key: "trial:ending" },
        { subject: "Your JobPao trial ends tomorrow", body: "Your 7-day Pro trial ends tomorrow. Open JobPao to see the jobs we matched and the applications we prepared for you this week. Keep Pro to keep getting new matches and ready applications every day.", button: "See my week" });
    } else {
      add(t.user_id, { kind: "trial", title: "Your trial has ended", body: "Your matches are still here. Go Pro to keep new applications coming.", link: "/upgrade", key: "trial:ended" });
    }
  }

  // 4. Weekly career tip for onboarded users.
  const week = isoWeek(now);
  const { data: users } = await admin.from("profiles").select("id").eq("onboarding_step", "done").limit(5000);
  for (const u of (users || []) as { id: string }[]) add(u.id, { kind: "guide", title: "Your career tip this week", body: "See which skills and courses would raise your match scores the most.", link: "/insights", key: `guide:${week}` });

  if (opts.dryRun) { res.notified = [...queue.values()].reduce((s, l) => s + l.length, 0); return res; }
  const ids = [...queue.keys()];
  const profs = new Map<string, Profile>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await admin.from("profiles").select("id, email, full_name, email_reminders").in("id", ids.slice(i, i + 200));
    for (const p of (data || []) as Profile[]) profs.set(p.id, p);
  }
  const canEmail = !!emailProvider();
  for (const [userId, items] of queue) {
    for (const it of items) {
      try {
        const fresh = await notify(admin, userId, [it.n]);
        if (!fresh) continue;
        res.notified++;
        if (it.n.kind === "reply") await admin.from("applications").update({ reply_checked_at: now.toISOString() }).eq("id", it.n.key.slice(6));
        const p = profs.get(userId);
        if (it.email && canEmail && p?.email && p.email_reminders !== false) {
          await sendEmail({ to: p.email, ...nudgeEmail({ name: p.full_name || "", ...it.email, link: base + (it.n.link || "/inbox") }) });
          res.emailed++;
        }
      } catch (e) { res.failed++; console.error("  nudge failed", userId, it.n.key, e); }
    }
  }
  return res;
}
