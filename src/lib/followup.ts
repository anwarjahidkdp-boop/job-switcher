// A polite follow-up email the user can send when an employer has not replied. Built only from facts we hold
// (the job, the application date, the user's name and contact); the user reviews and sends it themselves.
import { fmtDate } from "./dates";

export function followUpDraft(p: { jobTitle: string; company: string; appliedOn: string | null; name: string; currentTitle?: string | null; email?: string | null; phone?: string | null }) {
  const on = p.appliedOn ? ` on ${fmtDate(p.appliedOn.slice(0, 10))}` : "";
  const exp = p.currentTitle ? ` and would welcome the chance to discuss how my experience as ${p.currentTitle} could help your team` : " and would welcome the chance to discuss how I could help your team";
  const contact = [p.email, p.phone].filter(Boolean).join(" · ");
  const subject = `Following up: ${p.jobTitle} application`;
  const body = `Dear Hiring Team,\n\nI applied for the ${p.jobTitle} role at ${p.company}${on} and wanted to follow up. I remain very interested in the position${exp}.\n\nPlease let me know if you need anything further from me.\n\nKind regards,\n${p.name}${contact ? "\n" + contact : ""}`;
  return { subject, body };
}
