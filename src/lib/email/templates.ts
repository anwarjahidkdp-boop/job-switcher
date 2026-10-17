import { esc } from "../cv/render";
import { fmtDate } from "../dates";

export function reminderEmail(p: { name: string; jobTitle: string; company: string; deadline: string | null; link: string; packReady: boolean }) {
  const first = (p.name || "").replace(/^(md\.?|mohammad|muhammad)\s+/i, "").split(" ")[0] || "there";
  const subject = `Reminder: apply to ${p.company} – ${p.jobTitle}`;
  const dl = p.deadline ? `Deadline: ${fmtDate(p.deadline)}.` : "No deadline was given.";
  const text = `Hi ${first},\n\nYou asked us to remind you today about the ${p.jobTitle} role at ${p.company}. ${dl}\n${p.packReady ? "Your tailored CV, cover letter and email are ready." : "Open the job to prepare your application."}\n\nOpen it here: ${p.link}\n\nJob Switcher never submits applications for you. When you have applied, tap "Yes, Applied" in the app.\n`;
  const html = `<div style="font-family:Inter,Arial,sans-serif;font-size:15px;color:#0F1B2D;max-width:520px">
<p>Hi ${esc(first)},</p><p>You asked us to remind you today about the <b>${esc(p.jobTitle)}</b> role at <b>${esc(p.company)}</b>. ${esc(dl)}</p>
<p>${p.packReady ? "Your tailored CV, cover letter and email are ready." : "Open the job to prepare your application."}</p>
<p><a href="${esc(p.link)}" style="display:inline-block;background:#0B7A6E;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600">Open my application</a></p>
<p style="color:#4A5568;font-size:13px">Job Switcher never submits applications for you. When you have applied, tap "Yes, Applied" in the app.</p></div>`;
  return { subject, text, html };
}
