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
  const { data: applied } = await admin.from("applications").select("id, user_id, job_id, applied_at, jobs!inner(title, company, country)")
    .eq("status", "applied").is("reply_checked_at", null).lte("applied_at", new Date(now.getTime() - REPLY_CHECK_DAYS * DAY).toISOString()).limit(500);
  for (const a of (applied || []) as unknown as { id: string; user_id: string; job_id: string; jobs: { title: string; company: string; country: string } }[]) {
    const followUp = a.jobs.country !== "BD" ? " No reply yet? We have a short follow-up email ready for you to send." : "";
    add(a.user_id, { kind: "reply", title: `Any reply from ${a.jobs.company}?`, body: `You applied for ${a.jobs.title}. Tell us if you got an interview call, and we will prepare you for it.`, link: `/jobs/${a.job_id}#reply`, key: `reply:${a.id}` },
      { subject: `Any reply from ${a.jobs.company}?`, body: `You applied for ${a.jobs.title} at ${a.jobs.company} a few days ago. Got an interview call? Tell us in one tap and we will prepare your interview answers.${followUp}`, button: "Update my application" });
  }

  // 2. Interview in the next 24 hours.
  const { data: iv } = await admin.from("applications").select("id, user_id, job_id, interview_at, jobs!inner(title, company)")
    .eq("status", "interview").gte("interview_at", now.toISOString()).lte("interview_at", new Date(now.getTime() + DAY).toISOString()).limit(500);
  for (const a of (iv || []) as unknown as { id: string; user_id: string; job_id: string; interview_at: string; jobs: { title: string; company: string } }[]) {
    add(a.user_id, { kind: "interview", title: `Interview soon with ${a.jobs.company}`, body: "Practise your answers now: your interview prep is ready in the app.", link: `/jobs/${a.job_id}`, key: `interview:${a.id}:${a.interview_at.slice(0, 10)}` },
      { subject: `Your ${a.jobs.company} interview is coming up`, body: `Your interview for ${a.jobs.title} at ${a.jobs.company} is within the next day. Open JobPao to practise the likely questions and your answers.`, button: "Practise now" });
  }

  // 3. Trial value journey: one progress notification per trial day, with Day 5 as the formal value report.
  const { data: trials } = await admin.from("subscriptions").select("user_id, trial_started_at, trial_ends_at").eq("status", "trialing")
    .gte("trial_ends_at", new Date(now.getTime() - DAY).toISOString()).lte("trial_ends_at", new Date(now.getTime() + 6 * DAY).toISOString()).limit(1000);
  for (const t of (trials || []) as { user_id: string; trial_started_at: string | null; trial_ends_at: string }[]) {
    const startAt = t.trial_started_at ? Date.parse(t.trial_started_at) : Date.parse(t.trial_ends_at) - 5 * DAY;
    const day = Math.min(5, Math.max(1, Math.floor((now.getTime() - startAt) / DAY) + 1));
    const [{ data: prof }, { count: analysed }, { data: matches }, { data: apps }] = await Promise.all([
      admin.from("profiles").select("onboarding_step").eq("id", t.user_id).maybeSingle(),
      admin.from("jobs").select("id", { count: "exact", head: true }).eq("active", true),
      admin.from("matches").select("score, relevant").eq("user_id", t.user_id).eq("relevant", true),
      admin.from("applications").select("pack, status").eq("user_id", t.user_id),
    ]);
    if (prof?.onboarding_step !== "done") continue;
    const relevant = (matches || []).length, strong = (matches || []).filter((m) => Number(m.score) >= 70).length;
    const prepared = (apps || []).filter((a) => !!a.pack).length, appliedCount = (apps || []).filter((a) => ["applied","interview","offer","closed"].includes(a.status)).length;
    const copy = day === 1
      ? { title: "Day 1 · Your Career Agent is ready", body: "Your Master CV and verified career profile are ready. JobPao can now match opportunities against your real experience.", link: "/profile" }
      : day === 2
      ? { title: "Day 2 · We are searching for you", body: `We have analysed ${analysed || 0} current jobs and found ${relevant} relevant opportunities for your profile.`, link: "/inbox#matches" }
      : day === 3
      ? { title: "Day 3 · Your strongest opportunities", body: `${strong} strong match${strong === 1 ? "" : "es"} are currently on your radar. Open Why This Job to see the evidence and gaps.`, link: "/inbox#matches" }
      : day === 4
      ? { title: "Day 4 · Turn the best match into an application", body: `${prepared} tailored application${prepared === 1 ? "" : "s"} prepared so far. Review the CV, cover letter and safety checks before you submit.`, link: "/queue" }
      : { title: "Your First 5 Days with JobPao", body: `Jobs analysed: ${analysed || 0} · Relevant: ${relevant} · Strong matches: ${strong} · Applications prepared: ${prepared} · Applied (confirmed): ${appliedCount}. Your Career Agent doesn't have to stop here.`, link: "/inbox#trial" };
    add(t.user_id, { kind: "trial", ...copy, key: `trial:day:${day}` }, day === 5
      ? { subject: "Your First 5 Days with JobPao", body: copy.body, button: "See my 5-day results" }
      : undefined);
  }

  // 4. Paid Pro users get a real weekly career report. Trial users do not receive this.
  const week = isoWeek(now);
  const { data: paid } = await admin.from("subscriptions").select("user_id, current_period_end").eq("plan_code", "pro").eq("status", "active").limit(5000);
  for (const s of (paid || []) as { user_id: string; current_period_end: string | null }[]) {
    if (s.current_period_end && Date.parse(s.current_period_end) <= now.getTime()) continue;
    const [{ count: analysed }, { data: matches }, { data: apps }] = await Promise.all([
      admin.from("jobs").select("id", { count: "exact", head: true }).eq("active", true),
      admin.from("matches").select("score, relevant").eq("user_id", s.user_id).eq("relevant", true),
      admin.from("applications").select("pack, status").eq("user_id", s.user_id),
    ]);
    const relevant = (matches || []).length, strong = (matches || []).filter((m) => Number(m.score) >= 70).length;
    const prepared = (apps || []).filter((a) => !!a.pack).length, appliedCount = (apps || []).filter((a) => ["applied","interview","offer","closed"].includes(a.status)).length;
    add(s.user_id, { kind: "guide", title: "Your Weekly Career Report", body: `Jobs analysed: ${analysed || 0} · Relevant: ${relevant} · Strong: ${strong} · Prepared: ${prepared} · Applied: ${appliedCount}. See your skill gaps and next opportunities.`, link: "/insights", key: `career-report:${week}` });
  }

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
