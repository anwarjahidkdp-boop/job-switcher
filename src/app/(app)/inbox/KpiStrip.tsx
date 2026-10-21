"use client";
// The dashboard's headline numbers: each tile counts up once on first view and jumps to where that number lives.
import Link from "next/link";
import { useEffect, useRef } from "react";

export type Kpi = { label: string; n: number; href: string; tone: "gold" | "blue" | "green" | "navy" | "teal"; icon: string; hint?: string };

export function KpiStrip({ items }: { items: Kpi[] }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const els = [...(box.current?.querySelectorAll<HTMLElement>("[data-n]") || [])];
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / 900), e = 1 - Math.pow(1 - k, 3);
      els.forEach((el) => { el.textContent = String(Math.round(Number(el.dataset.n) * e)); });
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div className="kpis" ref={box}>
      {items.map((k) => (
        <Link key={k.label} href={k.href} className={`kpi kpi-${k.tone}`}>
          <span className="kpi-ic" aria-hidden="true" dangerouslySetInnerHTML={{ __html: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${k.icon}</svg>` }} />
          <b className="num" data-n={k.n}>{k.n}</b>
          <span className="kpi-l">{k.label}</span>
          {k.hint ? <span className="kpi-h">{k.hint}</span> : null}
        </Link>
      ))}
    </div>
  );
}
