// Nudges (run with the reminders job a few times a day; each user only between 08:00 and 21:00 local time): ask "any reply?" after applying, remind about interviews,
// warn before the trial ends and send a weekly career tip. Each one is an in-app notification (deduped), and the
// important ones are also emailed once. Nothing here contacts an employer.
import type { SupabaseClient } from "@supabase/supabase-js";
import { emailProvider } from "../email/send";
import { nudgeEmail } from "../email/templates";
import { reportBody, reportWeek } from "./career-reports";
import { liveCareerMetrics, saveLiveCareerReport } from "./report-metrics";
import { deliverEmail } from "./email-outbox";
import { notify, type NewNotification } from "./notify";
import { inSendWindow } from "./reminders";

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

type Profile = { id: string; email: string | null; full_name: string | null; email_reminders: boolean | null; target_country: string | null };

export async function sendNudges(admin: SupabaseClient, opts: { appUrl: string; now?: Date; dryRun?: boolean }) {
  const now = opts.now || new Date();
  const base = opts.appUrl.replace(/\/$/, "");
  const res = { notified: 0, emailed: 0, failed: 0, deferred: 0 };
  const queue = new Map<string, { n: NewNotification; email?: { subject: string; body: string; button: string } }[]>();
  const add = (userId: string, n: NewNotification, email?: { subject: string; body: string; button: string }) => {
    const l = queue.get(userId) || [];
    l.push({ n, email });
    queue.set(userId, l);
  };

  // 1. Applied 5+ days ago and we have not asked yet: "Any reply?"
  const { data: applied } = await admin.from("applications").select("id, user_id, job_id, applied_at, reply_checked_at, jobs!inner(title, company, country)")
    .eq("status", "applied").lte("applied_at", new Date(now.getTime() - REPLY_CHECK_DAYS * DAY).toISOString()).limit(500);
  for (const a of (applied || []) as unknown as { id: string; user_id: string; job_id: string; reply_checked_at?:string|null; jobs: { title: string; company: string; country: string } }[]) {
    if(a.reply_checked_at&&Date.parse(a.reply_checked_at)>now.getTime()-FOLLOWUP_DAYS*DAY)continue;
    const followUp = a.jobs.country !== "BD" ? " No reply yet? We have a short follow-up email ready for you to send." : "";
    add(a.user_id, { kind: "reply", title: `Any reply from ${a.jobs.company}?`, body: `You applied for ${a.jobs.title}. Tell us if you got an interview call, and we will prepare you for it.`, link: `/jobs/${a.job_id}#interview`, key: `reply:${a.id}:${a.reply_checked_at||"first"}` },
      { subject: `Any reply from ${a.jobs.company}?`, body: `You applied for ${a.jobs.title} at ${a.jobs.company} a few days ago. Got an interview call? Tell us in one tap and we will prepare your interview answers.${followUp}`, button: "Update my application" });
  }

  // 2. Interview in the next 24 hours.
  const { data: iv } = await admin.from("applications").select("id, user_id, job_id, interview_at, interview_prep, jobs!inner(title, company)")
    .eq("status", "interview").gte("interview_at", now.toISOString()).lte("interview_at", new Date(now.getTime() + DAY).toISOString()).limit(500);
  for (const a of (iv || []) as unknown as { id: string; user_id: string; job_id: string; interview_at: string; interview_prep: unknown; jobs: { title: string; company: string } }[]) {
    // Say the prep is ready only when it has been made; otherwise invite them to make it.
    add(a.user_id, { kind: "interview", title: `Interview soon with ${a.jobs.company}`, body: a.interview_prep ? "Practise your answers now: your interview prep is ready in the app." : "Open the job to get the likely questions and answers from your CV.", link: `/jobs/${a.job_id}#interview`, key: `interview:${a.id}:${a.interview_at.slice(0, 10)}` },
      { subject: `Your ${a.jobs.company} interview is coming up`, body: `Your interview for ${a.jobs.title} at ${a.jobs.company} is within the next day. ${a.interview_prep ? "Open JobPao to practise the likely questions and your answers." : "Open JobPao to get the likely questions and answers built from your CV."}`, button: a.interview_prep ? "Practise now" : "Prepare now" });
  }

  // 3. Trial value journey: one progress notification per trial day, with Day 5 as the formal value report.
  const { data: trials } = await admin.from("subscriptions").select("user_id, trial_started_at, trial_ends_at").eq("status", "trialing")
    .gte("trial_ends_at", new Date(now.getTime() - DAY).toISOString()).lte("trial_ends_at", new Date(now.getTime() + 6 * DAY).toISOString()).limit(1000);
  for (const t of (trials || []) as { user_id: string; trial_started_at: string | null; trial_ends_at: string }[]) {
    const startAt = t.trial_started_at ? Date.parse(t.trial_started_at) : Date.parse(t.trial_ends_at) - 5 * DAY;
    const day = Math.min(5, Math.max(1, Math.floor((now.getTime() - startAt) / DAY) + 1));
    const { data: prof, error: profileError } = await admin.from("profiles").select("onboarding_step").eq("id", t.user_id).maybeSingle();
    if (profileError) throw profileError;
    if (prof?.onboarding_step !== "done") continue;
    const periodEnd = new Date(Math.min(now.getTime(), Date.parse(t.trial_ends_at)));
    const start = new Date(startAt);
    if (periodEnd <= start) continue;
    // The same counts Home shows for this period (jobTotals / appliedFor), never the stored first-pass scores.
    const metrics = day === 5
      ? (opts.dryRun ? await liveCareerMetrics(admin,t.user_id,start,periodEnd,now.getTime()) : (await saveLiveCareerReport(admin,t.user_id,"trial",start,periodEnd))?.metrics)
      : await liveCareerMetrics(admin,t.user_id,start,periodEnd,now.getTime());
    if (!metrics) continue;
    const { jobs_analysed: analysed, relevant, strong, prepared } = metrics;
    const copy = day === 1
      ? { title: "Day 1 · Your Career Agent is ready", body: "Your Master CV and verified career profile are ready. JobPao can now match opportunities against your real experience.", link: "/profile" }
      : day === 2
      ? { title: "Day 2 · We are searching for you", body: `We have found ${analysed || 0} jobs for you so far, and ${relevant} of them ${relevant === 1 ? "is a Top match" : "are Top matches"} (70% or more).`, link: "/inbox#matches" }
      : day === 3
      ? { title: "Day 3 · Your strongest opportunities", body: `${strong} Strong Fit opportunit${strong === 1 ? "y is" : "ies are"} (90% or more) on your radar. Open Why This Job to see the evidence and gaps.`, link: "/inbox#matches" }
      : day === 4
      ? { title: "Day 4 · Turn the best match into an application", body: `${prepared} tailored application${prepared === 1 ? "" : "s"} prepared so far. Review the CV, cover letter and safety checks before you submit.`, link: "/queue" }
      : { title: "Your First 5 Days with JobPao", body: `${reportBody(metrics)} Your Career Agent doesn't have to stop here.`, link: "/inbox#trial" };
    add(t.user_id, { kind: "trial", ...copy, key: `trial:day:${day}` }, day === 5
      ? { subject: "Your First 5 Days with JobPao", body: copy.body, button: "See my 5-day results" }
      : undefined);
  }

  // 4. Paid Pro users get a real weekly career report. Trial users do not receive this.
  const window = reportWeek(now);
  const { data: paid, error: paidError } = await admin.from("subscriptions").select("user_id, current_period_end, created_at").eq("status", "active").eq("plan_code", "pro").limit(5000);
  if (paidError) throw paidError;
  for (const s of (paid || []) as { user_id: string; current_period_end: string | null; created_at?: string }[]) {
    if (s.current_period_end && Date.parse(s.current_period_end) <= now.getTime()) continue;
    if (s.created_at && Date.parse(s.created_at) >= window.end.getTime()) continue;
    const r = opts.dryRun ? {period_start:window.start.toISOString(),period_end:window.end.toISOString(),metrics:await liveCareerMetrics(admin,s.user_id,window.start,window.end,now.getTime())} : await saveLiveCareerReport(admin,s.user_id,"weekly",window.start,window.end);
    if (!r?.metrics) continue;
    const body = reportBody(r.metrics);
    const period = `${r.period_start.slice(0,10)} to ${r.period_end.slice(0,10)} (UTC, end exclusive)`;
    add(s.user_id, { kind: "guide", title: "Your Weekly Career Report", body: `${period} · ${body}`, link: "/insights#career-reports", key: `career-report:${isoWeek(window.start)}` },
      {subject:"Your Weekly Career Report",body:`${period} · ${body}`,button:"Read my career report"});
  }

  if (opts.dryRun) { res.notified = [...queue.values()].reduce((s, l) => s + l.length, 0); return res; }
  const ids = [...queue.keys()];
  const profs = new Map<string, Profile>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await admin.from("profiles").select("id, email, full_name, email_reminders, target_country").in("id", ids.slice(i, i + 200));
    for (const p of (data || []) as Profile[]) profs.set(p.id, p);
  }
  const canEmail = !!emailProvider();
  for (const [userId, items] of queue) {
    // Outside the user's daytime nothing is sent or marked; a later run that day picks the same items up again.
    if (!inSendWindow(profs.get(userId)?.target_country, now)) { res.deferred += items.length; continue; }
    for (const it of items) {
      try {
        const fresh = await notify(admin, userId, [it.n]);
        if (fresh) res.notified++;
        if (it.n.kind === "reply") await admin.from("applications").update({ reply_checked_at: now.toISOString() }).eq("id", it.n.key.split(":")[1]);
        const p = profs.get(userId);
        if (it.email && canEmail && p?.email && p.email_reminders !== false) {
          const delivery = await deliverEmail(admin, userId, it.n.key, { to: p.email, ...nudgeEmail({ name: p.full_name || "", ...it.email, link: base + (it.n.link || "/inbox") }) });
          if (delivery === "sent" && fresh) res.emailed++;
          else if (delivery !== "sent") res.failed++;
        }
      } catch (e) { res.failed++; console.error("  nudge failed", userId, it.n.key, e); }
    }
  }
  return res;
}
