// The email and phone on a CV come from the account (owner rule 2026-11-01): the phone given at signup (or edited on
// Profile) and the login email, unless the person chose a different email for their CV. Everything else in the CV's
// contact line (city, LinkedIn, ...) stays as it was.
import type { PersonalDetails } from "../types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
const EMAIL_IN = /[^\s@]+@[^\s@]+\.[a-z]{2,}/i;
const PHONE_PART = /^\+?[\d\s().\-/]{7,}$/;

export const validEmail = (s: string) => EMAIL_RE.test(s.trim()) && s.trim().length <= 120;

/** A phone number as the person typed it, tidied; null when it is not a plausible number (7 to 15 digits). */
export function normalisePhone(s: string | null | undefined): string | null {
  const t = String(s || "").trim().replace(/\s+/g, " ");
  const digits = t.replace(/\D/g, "");
  return /^\+?[\d\s().\-/]+$/.test(t) && digits.length >= 7 && digits.length <= 15 ? t : null;
}

/** The email shown on the CV: the one chosen for the CV, else the login email. */
export const cvEmailOf = (loginEmail: string | null | undefined, personal: PersonalDetails | null | undefined) =>
  (personal?.cvEmail || "").trim() || (loginEmail || "").trim() || null;

/** Puts the account's email and phone first in a CV contact line, replacing any email or phone the CV had. */
export function cvContact(contact: string | null | undefined, account: { email?: string | null; phone?: string | null }): string {
  const email = (account.email || "").trim(), phone = normalisePhone(account.phone);
  const parts = String(contact || "").split(/\s*[·|]\s*/).map((s) => s.trim()).filter(Boolean);
  const rest = parts.filter((p) => !(email && EMAIL_IN.test(p)) && !(phone && PHONE_PART.test(p)));
  return [email, phone, ...rest].filter(Boolean).join(" · ");
}
