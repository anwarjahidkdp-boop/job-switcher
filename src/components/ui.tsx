import { BAND } from "@/lib/matching";
import { daysUntil, fmtDate } from "@/lib/dates";
import type { Band } from "@/lib/types";

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="7" fill="var(--accent)" />
      <path d="M7 21h5c3 0 3.5-9 7-9h3" fill="none" stroke="var(--accent-ink)" strokeWidth="3" strokeLinecap="round" />
      <circle cx="24.5" cy="12" r="2.6" fill="var(--accent-ink)" />
    </svg>
  );
}

export function Ring({ score, band }: { score: number; band: Band }) {
  return (
    <div className={`ring ${BAND[band][2]}`} style={{ ["--p" as string]: score }} role="img" aria-label={`${score}% profile match`}>
      <b>{score}</b>
    </div>
  );
}

export function BandPill({ band }: { band: Band }) {
  return <span className={`pill ${BAND[band][1]}`}>{BAND[band][0]}</span>;
}

export function DeadlineChip({ deadline, today }: { deadline: string | null; today: string }) {
  const d = daysUntil(deadline, today);
  if (d == null) return <span className="pill p-neutral dl">No deadline given</span>;
  if (d < 0) return <span className="pill p-bad dl">Closed {fmtDate(deadline)}</span>;
  return (
    <span className={`pill ${d <= 3 ? "p-warn" : "p-neutral"} dl`}>
      Deadline {fmtDate(deadline)}
      {d <= 3 ? ` · ${d === 0 ? "today" : d + " day" + (d === 1 ? "" : "s")}` : ""}
    </span>
  );
}

export function Spinner() {
  return <span className="spin" aria-hidden="true" />;
}
