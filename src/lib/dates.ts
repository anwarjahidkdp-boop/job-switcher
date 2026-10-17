// Date helpers. All calendar dates are "YYYY-MM-DD" strings in the user's time zone.
export const DAY = 864e5;
export const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function ymd(d: Date): string {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

/** Today's date in a time zone (default Asia/Dhaka, the launch market). */
export function todayStr(timeZone = "Asia/Dhaka", now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  return parts; // en-CA formats as YYYY-MM-DD
}

export function addDaysTo(base: string, n: number): string {
  const d = new Date(base + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  const a = new Date(from + "T12:00:00Z").getTime();
  const b = new Date(to + "T12:00:00Z").getTime();
  return Math.round((b - a) / DAY);
}

/** Days from `today` until `s` (negative = past). null when no date. */
export function daysUntil(s: string | null | undefined, today: string): number | null {
  if (!s) return null;
  return daysBetween(today, s);
}

export function fmtDate(s: string | null | undefined): string {
  if (!s) return "Not stated";
  const [, m, d] = s.split("-").map(Number);
  return MON[m - 1] + " " + d;
}

export function fmtYM(s: string | null | undefined): string {
  if (!s) return "Present";
  const [y, m] = s.split("-").map(Number);
  return (m ? MON[m - 1] + " " : "") + y;
}
