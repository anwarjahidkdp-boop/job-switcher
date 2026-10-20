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
      <div className="lp-share" aria-label={`JobPao does ${us.length} jobs, you do ${you.length}`}>
        <div className="lp-share-us" style={{ flexGrow: us.length }}><b>JobPao</b> {us.length} jobs</div>
        <div className="lp-share-you" style={{ flexGrow: you.length }}><b>You</b> {you.length}</div>
      </div>
      <div className="lp-us">
        <div className="lp-count"><b>{us.length}</b><span>jobs JobPao does for you, until you&apos;re hired</span></div>
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
        <div className="lp-count lp-count-you"><b>{you.length}</b><span>jobs left for you</span></div>
        <ol className="lp-mine">
          {you.map((x, i) => <li key={x}><b>{i + 1}</b><span>{x}</span></li>)}
        </ol>
        <p className="lp-thatsit">That&apos;s it.</p>
      </div>
    </div>
  );
}
