import { BAND } from "@/lib/matching";
import { daysUntil, fmtDate } from "@/lib/dates";
import type { Band } from "@/lib/types";

export function Logo({ size = 28 }: { size?: number }) {
  // JobPao mark: a person in a suit and tie carrying a briefcase.
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="16" fill="var(--accent)" />
      <g fill="var(--accent-ink)" stroke="var(--accent-ink)">
        <circle cx="29" cy="15" r="8" stroke="none" />
        <path d="M15 55V38c0-8 6-12 14-12s14 4 14 12v17z" stroke="none" />
        <path d="M24 26.6L29 35l5-8.4c-1.5-.4-3.2-.6-5-.6s-3.5.2-5 .6z" fill="var(--accent)" opacity=".18" stroke="none" />
        <path d="M27.6 28.5h2.8l.9 2.2-1.3 9.3-1 1.5-1-1.5-1.3-9.3z" fill="#F5B83D" stroke="none" />
        <path d="M40 33l9 8.5" fill="none" strokeWidth="5" strokeLinecap="round" />
        <rect x="44" y="42" width="15" height="12" rx="2.5" stroke="none" />
        <path d="M48.5 42v-2.2a1.8 1.8 0 011.8-1.8h2.4a1.8 1.8 0 011.8 1.8V42" fill="none" strokeWidth="2" />
      </g>
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
