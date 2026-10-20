"use client";
import { useEffect, useRef, useState } from "react";

/** "We do it all" as a flow: once the section scrolls into view, each job ticks itself off one after another. */
export function AutoFlow({ us, you }: { us: string[]; you: string[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [go, setGo] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") { setGo(true); return; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setGo(true); io.disconnect(); } }, { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={`lp-flow${go ? " go" : ""}`}>
      <div className="lp-us">
        <p className="lp-who">We do everything else, until you&apos;re hired</p>
        <ol className="lp-tl">
          {us.map((x, i) => (
            <li key={x} style={{ "--i": i } as React.CSSProperties}>
              <span className="lp-node" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg></span>
              <span>{x}</span>
            </li>
          ))}
        </ol>
      </div>
      <div className="lp-you">
        <p className="lp-who">Your part</p>
        <ol className="lp-mine">
          {you.map((x, i) => <li key={x}><b>{i + 1}</b><span>{x}</span></li>)}
        </ol>
        <p className="lp-thatsit">That&apos;s it.</p>
      </div>
    </div>
  );
}
