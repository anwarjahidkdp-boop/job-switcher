// Pure helpers for bKash payments: input normalisation, period maths and env-driven configuration.

/** bKash transaction IDs are short upper-case alphanumeric codes (10 characters in the SMS, e.g. "9JK7ABC1XY"). */
export function normaliseTrxId(raw: string): string | null {
  const t = String(raw || "").toUpperCase().replace(/[\s-]/g, "").replace(/^TRXID[:#]?/, "");
  // TODO(bkash): bKash does not publish a TrxID format. Real IDs seen are 10 chars; accept 8-12 to be safe.
  return /^[A-Z0-9]{8,12}$/.test(t) ? t : null;
}

/** Bangladeshi mobile number -> 01XXXXXXXXX (operators 013-019). */
export function normaliseMsisdn(raw: string): string | null {
  const d = String(raw || "").replace(/[^\d]/g, "").replace(/^(?:00)?880/, "0");
  return /^01[3-9]\d{8}$/.test(d) ? d : null;
}

export const PERIOD_DAYS = 30;
const DAY_MS = 86_400_000;

/** New period end: extend an active period from its end, otherwise start from now. */
export function extendPeriod(currentEnd: string | null | undefined, status: string | null | undefined, now = Date.now(), days = PERIOD_DAYS): string {
  const end = currentEnd ? Date.parse(currentEnd) : NaN;
  const base = status === "active" && Number.isFinite(end) && end > now ? end : now;
  return new Date(base + days * DAY_MS).toISOString();
}

export const formatTaka = (minor: number) => `৳${(minor / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
/** bKash expects the amount as a decimal string. TODO(bkash): confirm "199" vs "199.00" against the merchant sandbox. */
export const bkashAmount = (minor: number) => (minor % 100 === 0 ? String(minor / 100) : (minor / 100).toFixed(2));

export interface BillingConfig {
  manual: null | { number: string; accountType: "personal" | "merchant" | "agent" };
  checkout: boolean;
}

/**
 * Which payment paths are on. PAYMENT_METHODS lists them (default: every method whose env is complete).
 * - manual   needs BKASH_MANUAL_NUMBER (+ BKASH_MANUAL_ACCOUNT_TYPE personal|merchant|agent, default personal)
 * - checkout needs BKASH_APP_KEY, BKASH_APP_SECRET, BKASH_USERNAME, BKASH_PASSWORD (and BKASH_BASE_URL for production)
 */
export function billingConfig(env: Record<string, string | undefined> = process.env): BillingConfig {
  const wanted = (env.PAYMENT_METHODS || "manual,checkout").toLowerCase().split(/[\s,]+/);
  const number = normaliseMsisdn(env.BKASH_MANUAL_NUMBER || "");
  const t = (env.BKASH_MANUAL_ACCOUNT_TYPE || "personal").toLowerCase();
  const accountType = t === "merchant" || t === "agent" ? t : "personal";
  const checkout = wanted.includes("checkout") && !!(env.BKASH_APP_KEY && env.BKASH_APP_SECRET && env.BKASH_USERNAME && env.BKASH_PASSWORD);
  return { manual: wanted.includes("manual") && number ? { number, accountType } : null, checkout };
}

/** Owner-only admin pages: the signed-in user's (verified) email must be in ADMIN_EMAILS. */
export function isAdminEmail(email: string | null | undefined, env: Record<string, string | undefined> = process.env): boolean {
  if (!email) return false;
  const list = (env.ADMIN_EMAILS || "").toLowerCase().split(/[\s,;]+/).filter(Boolean);
  return list.includes(email.toLowerCase().trim());
}
