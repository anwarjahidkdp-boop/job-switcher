// How many AI-tailored applications (CV + cover letter) a person can have prepared. Owner decision 2026-10-21:
// up to 2 a day, and over a rolling week and month at most 10 and 40 (Bangladesh Pro). Outside Bangladesh Pro
// pays more, so the allowance is larger. When it is used up, the free template version is made instead.

export interface PackLimits { day: number; week: number; month: number }
export interface PackAllowance { left: number; limits: PackLimits; used: { day: number; week: number; month: number }; reason: "day" | "week" | "month" | null }

export function packLimits(plan: string | null | undefined, homeCountry: string | null | undefined): PackLimits {
  if (plan !== "pro") return { day: 2, week: 10, month: 10 }; // the 7-day trial: 10 in all
  return homeCountry === "BD" ? { day: 2, week: 10, month: 40 } : { day: 4, week: 30, month: 120 };
}

const DAY = 86_400_000;

/** `times` are when earlier AI packs were made (ISO strings); windows are rolling, so the week evens out day by day. */
export function packAllowance(times: string[], limits: PackLimits, now = Date.now()): PackAllowance {
  const t = times.map((x) => Date.parse(x)).filter((x) => Number.isFinite(x));
  const used = { day: t.filter((x) => now - x < DAY).length, week: t.filter((x) => now - x < 7 * DAY).length, month: t.filter((x) => now - x < 30 * DAY).length };
  const room = { day: limits.day - used.day, week: limits.week - used.week, month: limits.month - used.month };
  const left = Math.max(0, Math.min(room.day, room.week, room.month));
  const reason = left > 0 ? null : room.month <= 0 ? "month" : room.week <= 0 ? "week" : "day";
  return { left, limits, used, reason };
}

export function limitNotice(a: PackAllowance): string {
  if (a.reason === "month") return `You have used this month's ${a.limits.month} AI-tailored applications.`;
  if (a.reason === "week") return `You have used this week's ${a.limits.week} AI-tailored applications.`;
  return `You have used today's ${a.limits.day} AI-tailored applications. More are available tomorrow.`;
}
