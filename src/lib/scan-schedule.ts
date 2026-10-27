// When each market's fresh jobs land. ONE table: the ingest run (which markets to scan this hour), the Home chip
// ("Updated 3 pm · Next 10 pm") and its copy all read it. Times are local, at the moments people have a few free
// minutes with their phone (owner, 2026-10-26): before work, after lunch, before bed.
import { rule } from "./countries";

const H = 3_600_000;

/** Update hours, local time, per market. */
export const UPDATE_HOURS: Record<string, readonly number[]> = {
  BD: [8, 15, 22], // before office, after lunch, before sleep
  GB: [7, 12, 21], // before the commute, the 12-1 lunch hour, evening wind-down
};
/** Every other market. */
export const DEFAULT_UPDATE_HOURS: readonly number[] = [8, 13, 21];

/** The ingest workflow runs hourly at this minute (ingest.yml cron) and prepares the updates due SCAN_LEAD_HOURS later,
 *  so the jobs are found, matched and AI-checked before people look, even when GitHub starts the run late. */
export const SCAN_CRON = "10 * * * *";
export const SCAN_LEAD_HOURS = 2;

export const updateHours = (country: string): readonly number[] => UPDATE_HOURS[country] ?? DEFAULT_UPDATE_HOURS;

/** Hours from UTC to the market's local time at `at` (whole and half-hour zones alike). */
function offsetMs(timeZone: string, at: number): number {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(new Date(at)).map((x) => [x.type, x.value]));
  const wall = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute));
  return wall - Math.floor(at / 60_000) * 60_000;
}

/** The market's update times from the day before `at` to the day after, oldest first. */
function updatesAround(country: string, at: number): number[] {
  const off = offsetMs(rule(country).timeZone, at);
  const localMidnight = Math.floor((at + off) / (24 * H)) * 24 * H - off;
  const out: number[] = [];
  for (const d of [-1, 0, 1]) for (const h of updateHours(country)) out.push(localMidnight + d * 24 * H + h * H);
  return out.sort((a, b) => a - b);
}

/** The latest update at or before `now`. */
export const lastUpdate = (country: string, now: number): Date => new Date(updatesAround(country, now).filter((t) => t <= now).at(-1)!);
/** The next update after `now`. */
export const nextUpdate = (country: string, now: number): Date => new Date(updatesAround(country, now).find((t) => t > now)!);

/** Markets whose update this hourly run prepares: the update SCAN_LEAD_HOURS after the hour the run was scheduled for. */
export function dueMarkets(countries: Iterable<string>, now: number): string[] {
  const target = Math.floor((now - 10 * 60_000) / H) * H + SCAN_LEAD_HOURS * H;
  return [...new Set(countries)].filter((c) => updatesAround(c, target).includes(target));
}

/** "3 pm" in the market's local time. */
export function clock(t: Date, timeZone: string): string {
  return t.toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit", hour12: true, timeZone }).replace(":00", "").replace(/\s?([ap])m$/i, " $1m");
}

/** "8 am, 3 pm and 10 pm" for the market. */
export function updateTimes(country: string): string {
  const t = updateHours(country).map((h) => clock(new Date(Date.UTC(2026, 0, 1, h)), "UTC"));
  return `${t.slice(0, -1).join(", ")} and ${t.at(-1)}`;
}
