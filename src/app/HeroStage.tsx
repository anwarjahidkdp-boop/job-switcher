"use client";
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { HeroPhone } from "./HeroPhone";

const RM = "(prefers-reduced-motion: reduce)";
const subscribe = (cb: () => void) => { const m = window.matchMedia?.(RM); m?.addEventListener("change", cb); return () => m?.removeEventListener("change", cb); };
const src = (id: string, w: number) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&h=${Math.round(w * 0.6)}&q=75&crop=faces,edges`;
const HOLD = 4600;

const Tick = () => <span className="hp-tick" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg></span>;

type Slide = { id: string; alt: string; by: string; page: string; pos?: string; over: ReactNode };

// Free Unsplash License photos, hotlinked with credit. Each slide says something different.
const SLIDES: Slide[] = [
  {
    id: "photo-1758599543129-bec77e427ac6", alt: "Smiling woman on a phone call, walking to an office", by: "Vitaly Gariev",
    page: "https://unsplash.com/photos/woman-talking-on-phone-holding-coffee-cup-outside-office-LU-hFAv_iOQ",
    over: <div className="hs-chip hs-call"><span className="hs-ic" aria-hidden="true">📞</span><div><b>Interview call!</b><span>Tuesday, 11:00 AM</span></div></div>,
  },
  {
    id: "photo-1758873267202-44c33e64f084", alt: "Man smiling at his laptop in an office", by: "Vitaly Gariev",
    page: "https://unsplash.com/photos/man-smiling-at-laptop-in-modern-office-ZMvGLiSDtGs",
    over: <>
      <div className="hs-chip hs-a"><span className="hp-ring">96</span><div><b>96% match</b><span>Senior Accountant</span></div></div>
      <div className="hs-chip hs-b"><Tick /><div><b>Application ready</b><span>CV, cover letter, email, documents</span></div></div>
    </>,
  },
  {
    id: "photo-1758518727888-ffa196002e59", alt: "Confident woman in a suit, smiling, in an office", by: "Vitaly Gariev",
    page: "https://unsplash.com/photos/a-professional-woman-in-a-suit-smiling-confidently-LlcpQWSWPUo",
    over: <div className="hs-chip hs-prep"><div><b>Walk in prepared</b>
      <ul><li><Tick />Tell me about yourself</li><li><Tick />Why this company?</li><li><Tick />Your biggest win</li></ul></div></div>,
  },
  {
    id: "photo-1758518730384-be3d205838e8", alt: "Manager shaking hands with a candidate after a job interview", by: "Vitaly Gariev",
    page: "https://unsplash.com/photos/two-professionals-shaking-hands-across-a-table-jEpZNyFSQwQ",
    over: <div className="hs-hired"><span className="hs-conf" aria-hidden="true">{Array.from({ length: 10 }, (_, i) => <i key={i} style={{ ["--k" as string]: i }} />)}</span><b>You got the job!</b><span>Offer received 🎉</span></div>,
  },
  {
    id: "photo-1752650735119-8929e5f7d1ec", alt: "Woman laughing while she works on her laptop", by: "Vitaly Gariev",
    page: "https://unsplash.com/photos/smiling-woman-works-on-her-laptop-eQryxYGXsu0",
    over: <div className="hs-chip hs-new"><span className="hs-num">5</span><div><b>new matches today</b><span>Found while you slept</span></div></div>,
  },
];

/** Home hero: happy job-seeker photos fill the whole block one after another (each rises in, then leaves upward), the left text sits on a navy shade, and each photo brings its own message cards beside the sample phone. */
export function HeroStage({ children }: { children: ReactNode }) {
  const [n, setN] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduced = useSyncExternalStore(subscribe, () => !!window.matchMedia?.(RM).matches, () => false);
  useEffect(() => {
    if (paused || reduced) return;
    const t = setTimeout(() => setN((x) => (x + 1) % SLIDES.length), HOLD);
    return () => clearTimeout(t);
  }, [n, paused, reduced]);
  const prev = (n + SLIDES.length - 1) % SLIDES.length;
  const cls = (i: number) => (i === n ? " on" : i === prev && !reduced ? " off" : "");
  const cur = SLIDES[n];
  return (
    <section className="lp-hero hs">
      <div className="hs-bg">
        {SLIDES.map((s, i) => (
          <figure key={s.id} className={`hs-slide${cls(i)}`} aria-hidden={i !== n}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src(s.id, 1600)} srcSet={`${src(s.id, 800)} 800w, ${src(s.id, 1600)} 1600w, ${src(s.id, 2200)} 2200w`} sizes="100vw" alt={i === n ? s.alt : ""} loading={i < 2 ? "eager" : "lazy"} decoding="async" style={s.pos ? { objectPosition: s.pos } : undefined} />
          </figure>
        ))}
        <div className="hs-shade" />
      </div>
      <div className="wrap lp-hero-in">
        <div>{children}</div>
        <div className="hs-right">
          <div className="hs-phone"><HeroPhone paused={paused} /></div>
          {SLIDES.map((s, i) => <div key={s.id} className={`hs-over${cls(i)}`} aria-hidden={i !== n}>{s.over}</div>)}
          <div className="hs-dots" aria-hidden="true">{SLIDES.map((s, i) => <i key={s.id} className={i === n ? "on" : ""} />)}</div>
        </div>
      </div>
      <p className="wrap hs-foot">
        {reduced ? null : <button type="button" onClick={() => setPaused((p) => !p)}>{paused ? "Play" : "Pause"}</button>}
        <span>Sample screens. Photo: <a href={cur.page} target="_blank" rel="noopener noreferrer">{cur.by} on Unsplash</a></span>
      </p>
    </section>
  );
}
