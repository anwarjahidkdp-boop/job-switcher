import { esc } from "../cv/render";
import { fmtDate } from "../dates";

export function reminderEmail(p: { name: string; jobTitle: string; company: string; deadline: string | null; link: string; packReady: boolean }) {
  const first = (p.name || "").replace(/^(md\.?|mohammad|muhammad)\s+/i, "").split(" ")[0] || "there";
  const subject = `Reminder: apply to ${p.company} – ${p.jobTitle}`;
  const dl = p.deadline ? `Deadline: ${fmtDate(p.deadline)}.` : "No deadline was given.";
  const text = `Hi ${first},\n\nYou asked us to remind you today about the ${p.jobTitle} role at ${p.company}. ${dl}\n${p.packReady ? "Your tailored CV, cover letter and email are ready." : "Open the job to prepare your application."}\n\nOpen it here: ${p.link}\n\nJobPao never submits applications for you. When you have applied, tap "Yes, Applied" in the app.\n`;
  const html = `<div style="font-family:Inter,Arial,sans-serif;font-size:15px;color:#0F1B2D;max-width:520px">
<p>Hi ${esc(first)},</p><p>You asked us to remind you today about the <b>${esc(p.jobTitle)}</b> role at <b>${esc(p.company)}</b>. ${esc(dl)}</p>
<p>${p.packReady ? "Your tailored CV, cover letter and email are ready." : "Open the job to prepare your application."}</p>
<p><a href="${esc(p.link)}" style="display:inline-block;background:#14275A;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600">Open my application</a></p>
<p style="color:#4A5568;font-size:13px">JobPao never submits applications for you. When you have applied, tap "Yes, Applied" in the app.</p></div>`;
  return { subject, text, html };
}

export function paymentEmail(p: { kind: "approved" | "rejected"; name: string; amount: string; trx: string | null; periodEnd: string | null; note: string | null; link: string }) {
  const first = (p.name || "").replace(/^(md\.?|mohammad|muhammad)\s+/i, "").split(" ")[0] || "there";
  const until = p.periodEnd ? fmtDate(p.periodEnd.slice(0, 10)) : "";
  const ref = p.trx ? ` (TrxID ${p.trx})` : "";
  const subject = p.kind === "approved" ? "Your JobPao Pro payment is confirmed" : "We could not confirm your bKash payment";
  const body = p.kind === "approved"
    ? `We received your ${p.amount} bKash payment${ref}. JobPao Pro is active until ${until}.`
    : `We could not find your ${p.amount} bKash payment${ref} in our bKash statement, so Pro was not activated.${p.note ? " Note from our team: " + p.note : ""} If you did pay, reply to this email with a screenshot of the bKash confirmation.`;
  const text = `Hi ${first},\n\n${body}\n\nOpen JobPao: ${p.link}\n`;
  const html = `<div style="font-family:Inter,Arial,sans-serif;font-size:15px;color:#0F1B2D;max-width:520px">
<p>Hi ${esc(first)},</p><p>${esc(body)}</p>
<p><a href="${esc(p.link)}" style="display:inline-block;background:#14275A;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600">Open JobPao</a></p></div>`;
  return { subject, text, html };
}

/** Daily digest of new strong matches, sent after job collection (src/lib/server/new-matches.ts). */
export function newMatchesEmail(p: { name: string; link: string; total: number; jobs: { title: string; company: string; location: string | null; score: number; link: string; ready: boolean }[] }) {
  const first = (p.name || "").replace(/^(md\.?|mohammad|muhammad)\s+/i, "").split(" ")[0] || "there";
  const readyN = p.jobs.filter((j) => j.ready).length;
  const subject = `${p.total} new job${p.total === 1 ? "" : "s"} match${p.total === 1 ? "es" : ""} your profile${readyN ? `, ${readyN} ready to apply` : ""}`;
  const lines = p.jobs.map((j) => `- ${j.title}, ${j.company}${j.location ? ` (${j.location})` : ""}: ${j.score}% match${j.ready ? ", application ready" : ""}\n  ${j.link}`).join("\n");
  const text = `Hi ${first},\n\nWe found ${p.total} new job${p.total === 1 ? "" : "s"} that fit you.${readyN ? ` We prepared a tailored CV and cover letter for the best ${readyN}; review and apply when you are happy.` : ""}\n\n${lines}\n\nSee them all: ${p.link}\n\nJobPao never applies for you without your press.\n`;
  const rows = p.jobs.map((j) => `<tr><td style="padding:10px 0;border-bottom:1px solid #E6EAF2"><a href="${esc(j.link)}" style="color:#14275A;font-weight:700;text-decoration:none">${esc(j.title)}</a><br><span style="color:#4A5568;font-size:13px">${esc(j.company)}${j.location ? ` · ${esc(j.location)}` : ""}</span>${j.ready ? `<br><span style="color:#1B7F4B;font-size:13px;font-weight:600">✓ Application ready to review</span>` : ""}</td><td style="padding:10px 0 10px 12px;border-bottom:1px solid #E6EAF2;text-align:right;font-weight:800;color:#C99640;white-space:nowrap">${j.score}%</td></tr>`).join("");
  const html = `<div style="font-family:Inter,Arial,sans-serif;font-size:15px;color:#0F1B2D;max-width:560px">
<p>Hi ${esc(first)},</p><p>We found <b>${p.total} new job${p.total === 1 ? "" : "s"}</b> that fit you.${readyN ? ` We prepared a tailored CV and cover letter for the best ${readyN}. Review and apply when you are happy.` : ""}</p>
<table style="width:100%;border-collapse:collapse">${rows}</table>
<p style="margin-top:18px"><a href="${esc(p.link)}" style="display:inline-block;background:#14275A;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600">See all my matches</a></p>
<p style="color:#4A5568;font-size:13px">JobPao never applies for you without your press. You can turn these emails off in your profile.</p></div>`;
  return { subject, text, html };
}

/** A short nudge email that mirrors an in-app notification (reply check, trial ending, interview tomorrow). */
export function nudgeEmail(p: { name: string; subject: string; body: string; button: string; link: string }) {
  const first = (p.name || "").replace(/^(md\.?|mohammad|muhammad)\s+/i, "").split(" ")[0] || "there";
  const text = `Hi ${first},\n\n${p.body}\n\n${p.button}: ${p.link}\n`;
  const html = `<div style="font-family:Inter,Arial,sans-serif;font-size:15px;color:#0F1B2D;max-width:520px">
<p>Hi ${esc(first)},</p><p>${esc(p.body)}</p>
<p><a href="${esc(p.link)}" style="display:inline-block;background:#14275A;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600">${esc(p.button)}</a></p></div>`;
  return { subject: p.subject, text, html };
}
