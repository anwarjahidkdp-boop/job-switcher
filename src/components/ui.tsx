import { BAND } from "@/lib/matching";
import { daysUntil, fmtDate } from "@/lib/dates";
import type { Band } from "@/lib/types";

export function Logo({ size = 28 }: { size?: number }) {
  // JobPao mark: a metallic gold briefcase with a navy tick, on navy with a thin gold rim.
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <radialGradient id="jp-bg" cx=".3" cy=".2" r="1"><stop offset="0" stopColor="#1F3A7A" /><stop offset=".55" stopColor="#14275A" /><stop offset="1" stopColor="#091430" /></radialGradient>
        <linearGradient id="jp-rim" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#F7DC94" /><stop offset=".5" stopColor="#B98A35" /><stop offset="1" stopColor="#F0CF7E" /></linearGradient>
        <linearGradient id="jp-gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FCE7A8" /><stop offset=".38" stopColor="#E9B954" /><stop offset=".72" stopColor="#C8922F" /><stop offset="1" stopColor="#A8741E" /></linearGradient>
        <linearGradient id="jp-handle" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#C8922F" /><stop offset=".5" stopColor="#F6D98C" /><stop offset="1" stopColor="#C8922F" /></linearGradient>
        <linearGradient id="jp-tick" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0B1838" /><stop offset="1" stopColor="#14275A" /></linearGradient>
        <filter id="jp-shadow" x="-20%" y="-20%" width="140%" height="160%"><feDropShadow dx="0" dy="1.6" stdDeviation="1.4" floodColor="#000" floodOpacity=".45" /></filter>
      </defs>
      <rect width="64" height="64" rx="14.5" fill="url(#jp-bg)" />
      <rect x="1.6" y="1.6" width="60.8" height="60.8" rx="13" fill="none" stroke="url(#jp-rim)" strokeOpacity=".55" strokeWidth=".9" />
      <g filter="url(#jp-shadow)">
        <path d="M24.6 21.5v-3.6a3.3 3.3 0 0 1 3.3-3.3h8.2a3.3 3.3 0 0 1 3.3 3.3v3.6" fill="none" stroke="url(#jp-handle)" strokeWidth="3.4" strokeLinecap="round" />
        <rect x="11" y="21" width="42" height="30" rx="7.2" fill="url(#jp-gold)" />
      </g>
      <path d="M14.5 23.6h35" stroke="#FFF6D8" strokeOpacity=".7" strokeWidth="1" strokeLinecap="round" />
      <path d="M11.4 31.2h11.2M41.4 31.2h11.2" stroke="#9C6A1A" strokeOpacity=".55" strokeWidth=".9" />
      <path d="M22 36.4l7.1 7.1L44 28.7" fill="none" stroke="url(#jp-tick)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
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
