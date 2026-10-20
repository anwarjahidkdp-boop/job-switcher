import { BAND } from "@/lib/matching";
import { daysUntil, fmtDate } from "@/lib/dates";
import type { Band } from "@/lib/types";

export function Logo({ size = 28 }: { size?: number }) {
  // JobPao mark: a gold briefcase on navy with a tick cut out of it.
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id="jp-navy" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#14275A" /><stop offset="1" stopColor="#0A1533" /></linearGradient>
        <linearGradient id="jp-gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#FFD36A" /><stop offset="1" stopColor="#F29A0B" /></linearGradient>
      </defs>
      <rect width="64" height="64" rx="14.5" fill="url(#jp-navy)" />
      <path d="M24.5 21v-3.4a3.4 3.4 0 013.4-3.4h8.2a3.4 3.4 0 013.4 3.4V21" fill="none" stroke="url(#jp-gold)" strokeWidth="3.6" />
      <rect x="11" y="21" width="42" height="30" rx="7" fill="url(#jp-gold)" />
      <path d="M13 25.5c0-1.9 1.4-2.8 3-2.8h32" stroke="#fff" strokeOpacity=".45" strokeWidth="1.2" fill="none" strokeLinecap="round" />
      <path d="M22 36.2l7.2 7.2L44 28.6" fill="none" stroke="#0D1B3E" strokeWidth="6.2" strokeLinecap="round" strokeLinejoin="round" />
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
