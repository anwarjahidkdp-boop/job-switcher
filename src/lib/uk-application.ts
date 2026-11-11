import type { AnswerLibrary } from './career-safety';

export type UKApplicationRoute = { kind: 'portal' | 'email' | 'review'; label: string; href: string | null; recipient: string | null };
const webUrl = (v: string | null | undefined) => {
  try { const u = new URL(v || ''); return u.protocol === 'https:' && !u.username && !u.password ? u.href : null; } catch { return null; }
};
/** A contact email in an advert is not evidence that it accepts applications. */
export function ukApplicationRoute(input: { method: string; target: string | null; url: string | null; description: string }): UKApplicationRoute {
  const href = webUrl(input.method === 'portal' ? input.target : null) || webUrl(input.url);
  const recipient = (input.target || '').trim();
  const email = /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(recipient);
  const text = input.description.replace(/\s+/g, ' ').toLowerCase();
  const escaped = recipient.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const explicit = email && new RegExp(`(?:email|e-mail|send|submit|forward)[^.!?]{0,160}(?:cv|résumé|resume|application|cover(?:ing)? letter)[^.!?]{0,100}${escaped}|(?:apply|applications?)[^.!?]{0,100}(?:email|e-mail|to)[^!?]{0,80}${escaped}`, 'i').test(text);
  if (input.method === 'email') return explicit
    ? { kind: 'email', label: 'Apply by email', href, recipient }
    : { kind: 'review', label: 'Check application instructions', href, recipient: null };
  if (!href) return { kind: 'review', label: 'Check application instructions', href: null, recipient: null };
  const host = new URL(href).hostname.toLowerCase();
  const on = (domain: string) => host === domain || host.endsWith('.' + domain);
  const site = on('linkedin.com') ? 'LinkedIn' : on('indeed.com') || on('indeed.co.uk') ? 'Indeed' : on('reed.co.uk') ? 'Reed' : null;
  return { kind: 'portal', label: site ? `Continue on ${site}` : 'Continue to employer website', href, recipient: null };
}

export interface UKApplicationAnswer { label: string; value: string | null; note?: string }
/** Saved, explicit answers only: residency defaults must not become immigration declarations. */
export function ukApplicationAnswers(a: AnswerLibrary, prefs: { salaryMin?: number | null; notice?: number | null } | null): UKApplicationAnswer[] {
  const salary = (!a.salaryCountry || a.salaryCountry === 'GB') && a.expectedSalary && a.expectedSalary > 0 ? a.expectedSalary : prefs?.salaryMin;
  const notice = a.noticeDays ?? prefs?.notice;
  return [
    { label: 'Right to work in the UK', value: a.workAuthorizationSource !== 'home_country_default' && a.workAuthorization && a.workAuthorization !== 'unknown' ? a.workAuthorization === 'yes' ? 'Yes' : 'No' : null, note: 'Review the wording on the employer’s form.' },
    { label: 'Visa sponsorship required', value: a.sponsorshipSource !== 'home_country_default' && typeof a.sponsorshipRequired === 'boolean' ? a.sponsorshipRequired ? 'Yes' : 'No' : null },
    { label: 'Expected annual salary', value: salary && salary > 0 ? `£${salary.toLocaleString('en-GB')} per year` : null },
    { label: 'Notice period', value: typeof notice === 'number' && notice >= 0 ? notice === 0 ? 'Available immediately' : `${notice} days` : null },
  ];
}

/**
 * UK employers that shortlist on a supporting statement against a person specification: the NHS, the Civil Service,
 * councils, schools, colleges, universities, police and fire services, housing associations, or any advert that says so.
 */
const STATEMENT_WORDS = /supporting statement|personal statement|statement (?:of|in) support|person specification|essential criteria|desirable criteria|shortlisting criteria/i;
const PUBLIC_EMPLOYER = /\bNHS\b|NHS Foundation Trust|\bHealth Board\b|\bCivil Service\b|\bHM\s|\bHis Majesty|\bMinistry of\b|\bDepartment for\b|\bCouncil\b|\bBorough\b|\bCounty\b|\bCombined Authority\b|\bPolice\b|Fire and Rescue|\bAcademy\b|\bSchool\b|\bCollege\b|\bUniversity\b|\bHousing Association\b|\bHousing Trust\b/i;
export function ukStatementLikely(job: { company: string; title: string }, description: string): boolean {
  return STATEMENT_WORDS.test(description) || PUBLIC_EMPLOYER.test(job.company || "");
}

export const MAX_FORM_ANSWERS = 8;
/** The employer's question as the person pasted it: whitespace tidied, at most 1,200 characters. */
export function cleanFormQuestion(v: unknown): string {
  return String(v ?? "").replace(/\s+/g, " ").trim().slice(0, 1200);
}
/** The word limit the person typed, or one stated in the question ("max 250 words"); null when none. */
export function formWordLimit(v: unknown, question = ""): number | null {
  const typed = Math.round(Number(v));
  if (Number.isFinite(typed) && typed >= 30 && typed <= 2000) return typed;
  const m = question.match(/(\d{2,4})\s*words?/i);
  const stated = m ? Number(m[1]) : NaN;
  return stated >= 30 && stated <= 2000 ? stated : null;
}
