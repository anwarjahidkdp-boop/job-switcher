"use client";
import { useEffect, useState, useSyncExternalStore } from "react";

const RM = "(prefers-reduced-motion: reduce)";
const subscribe = (cb: () => void) => { const m = window.matchMedia?.(RM); m?.addEventListener("change", cb); return () => m?.removeEventListener("change", cb); };

const STEPS = [
  { k: "match", title: "New best match", body: "Assistant Manager, Accounts", sub: "Shuvra Knit Composite · Dhaka", score: 96 },
  { k: "cv", title: "CV tailored for this job", body: "Leads with your factory reporting and VAT work." },
  { k: "letter", title: "Cover letter written", body: "From your real experience. Nothing invented." },
  { k: "approve", title: "Ready for you", body: "Review it and tap Approve." },
  { k: "interview", title: "Interview call", body: "Tuesday, 11:00 AM", sub: "Your interview prep is ready." },
] as const;

/** A sample JobPao day on a phone: each step arrives after the last, then it starts again. Pausable; static under reduced motion. */
export function HeroPhone() {
  const [n, setN] = useState(1);
  const [paused, setPaused] = useState(false);
  const reduced = useSyncExternalStore(subscribe, () => !!window.matchMedia?.(RM).matches, () => false);
  useEffect(() => {
    if (paused || reduced) return;
    const t = setTimeout(() => setN((x) => (x >= STEPS.length + 2 ? 1 : x + 1)), n >= STEPS.length ? 1800 : 1400);
    return () => clearTimeout(t);
  }, [n, paused, reduced]);
  const shown = reduced ? STEPS.length : Math.min(n, STEPS.length);
  return (
    <div className="hp-wrap">
      <div className="hp-phone" aria-label="Sample: what JobPao does for you">
        <div className="hp-notch" />
        <div className="hp-status"><span>9:41</span><span className="hp-sample">Sample</span></div>
        <div className="hp-app"><span className="hp-logo" /> JobPao <small>working for you</small></div>
        <div className="hp-feed">
          {STEPS.slice(0, shown).map((s, i) => (
            <div key={s.k} className={`hp-card hp-${s.k}${i === shown - 1 ? " hp-new" : ""}`}>
              {s.k === "match" ? <span className="hp-ring">{s.score}</span> : <span className="hp-tick" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg></span>}
              <div>
                <b>{s.title}</b>
                <span>{s.body}</span>
                {"sub" in s ? <em>{s.sub}</em> : null}
                {s.k === "approve" ? <span className={`hp-approve${shown > i + 1 ? " done" : ""}`}>{shown > i + 1 ? "Approved ✓" : "Approve"}</span> : null}
              </div>
            </div>
          ))}
        </div>
      </div>
      {reduced ? null : <button type="button" className="hp-pause" onClick={() => setPaused((p) => !p)}>{paused ? "Play demo" : "Pause demo"}</button>}
    </div>
  );
}
