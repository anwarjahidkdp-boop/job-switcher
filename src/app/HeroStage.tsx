"use client";
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { HeroPhone } from "./HeroPhone";

const RM = "(prefers-reduced-motion: reduce)";
const subscribe = (cb: () => void) => { const m = window.matchMedia?.(RM); m?.addEventListener("change", cb); return () => m?.removeEventListener("change", cb); };
const src = (id: string, w: number, wide?: boolean) => wide
  // Two-person scenes: keep the whole frame so both people stay in view.
  ? `https://images.unsplash.com/${id}?auto=format&fit=max&w=${w}&q=85`
  : `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&h=${Math.round(w * 0.92)}&q=85&crop=faces,edges`;
const HOLD = 4600;

const Tick = () => <span className="hp-tick" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg></span>;

type Slide = { id: string; step: string; alt: string; by: string; page: string; pos?: string; wide?: boolean; over: ReactNode };

// One job-seeker story, told in six free Unsplash License photos the owner picked (hotlinked, credited).
const SLIDES: Slide[] = [
  {
    id: "photo-1758873267202-44c33e64f084", step: "The match", alt: "Man smiling at his laptop as a great job match arrives", by: "Vitaly Gariev",
    page: "https://unsplash.com/photos/man-smiling-at-laptop-in-modern-office-ZMvGLiSDtGs",
    over: <>
      <div className="hs-chip hs-a"><span className="hp-ring">96</span><div><b>96% match</b><span>Senior Accountant</span></div></div>
      <div className="hs-chip hs-b"><Tick /><div><b>Application ready</b><span>CV, cover letter, email, documents</span></div></div>
    </>,
  },
  {
    id: "photo-1698047681432-006d2449c631", step: "Your CV", alt: "Recruiter reading a CV across the table from the candidate", by: "Unsplash", wide: true, pos: "50% 40%",
    page: "https://unsplash.com/photos/a-woman-is-reading-a-resume-at-a-table-9si2noVCVH8",
    over: <div className="hs-chip hs-b"><Tick /><div><b>Your CV stands out</b><span>Tailored to this job</span></div></div>,
  },
  {
    id: "photo-1758611972271-fce956444233", step: "The call", alt: "Man at his office desk smiling at good news on his phone", by: "Vitaly Gariev",
    page: "https://unsplash.com/photos/man-smiling-while-looking-at-his-phone-at-desk-61xM5EIiG5w",
    over: <div className="hs-chip hs-call"><span className="hs-ic" aria-hidden="true">📞</span><div><b>Interview call!</b><span>Tuesday, 11:00 AM</span></div></div>,
  },
  {
    id: "photo-1758518730162-09a142505bfd", step: "The interview", alt: "Interviewer and candidate talking across a table", by: "Vitaly Gariev", wide: true, pos: "50% 40%",
    page: "https://unsplash.com/photos/woman-in-suit-interviews-man-across-table-Hl1HIQ0fmQk",
    over: <div className="hs-chip hs-prep"><div><b>Walk in prepared</b>
      <ul><li><Tick />Tell me about yourself</li><li><Tick />Why this company?</li><li><Tick />Your biggest win</li></ul></div></div>,
  },
  {
    id: "photo-1758518730384-be3d205838e8", step: "The handshake", alt: "Manager shaking hands with a candidate after a good interview", by: "Vitaly Gariev", wide: true, pos: "50% 40%",
    page: "https://unsplash.com/photos/two-professionals-shaking-hands-across-a-table-jEpZNyFSQwQ",
    over: <div className="hs-chip hs-b"><Tick /><div><b>Interview done</b><span>Ready for every question</span></div></div>,
  },
  {
    id: "photo-1758873268783-967d13f0c163", step: "The offer", alt: "Woman at her office desk delighted by the job offer", by: "Vitaly Gariev",
    page: "https://unsplash.com/photos/woman-celebrating-success-at-her-office-desk-n9NCev29YvI",
    over: <div className="hs-hired"><span className="hs-conf" aria-hidden="true">{Array.from({ length: 10 }, (_, i) => <i key={i} style={{ ["--k" as string]: i }} />)}</span><b>You got the job!</b><span>Offer received 🎉</span></div>,
  },
];

/** Home hero: the text stays clean on navy; on the right, happy job-seeker photos glide in from alternating sides and come into focus on the right of the hero, fading and blurring into the navy towards the text and the phone, each with its own message cards beside the sample phone. */
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
      <div className="hs-bg" aria-hidden="true">
        {SLIDES.map((s, i) => (
          <figure key={s.id} className={`hs-slide${s.wide ? " hs-wide" : ""}${cls(i)}`} style={{ ["--from" as string]: i % 2 ? "-8%" : "8%" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="hs-soft" src={src(s.id, 480, s.wide)} alt="" loading={i < 2 ? "eager" : "lazy"} decoding="async" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="hs-sharp" src={src(s.id, 1600, s.wide)} srcSet={`${src(s.id, 900, s.wide)} 900w, ${src(s.id, 1300, s.wide)} 1300w, ${src(s.id, 1800, s.wide)} 1800w, ${src(s.id, 2400, s.wide)} 2400w`} sizes="(max-width: 900px) 100vw, 62vw" alt="" loading={i < 2 ? "eager" : "lazy"} decoding="async" style={s.pos ? { objectPosition: s.pos } : undefined} />
          </figure>
        ))}
      </div>
      <div className="wrap lp-hero-in">
        <div className="hs-copy">{children}</div>
        <div className="hs-right">
          <p className="hs-step" key={n}><i>{String(n + 1).padStart(2, "0")}</i>{cur.step}</p>
          <div className="hs-phone"><HeroPhone paused={paused} /></div>
          {SLIDES.map((s, i) => <div key={s.id} className={`hs-over${cls(i)}`} aria-hidden={i !== n}>{s.over}</div>)}
          <div className="hs-dots" aria-hidden="true">{SLIDES.map((s, i) => <i key={s.id} className={i === n ? "on" : ""} />)}</div>
          <p className="hs-foot">
            {reduced ? null : <button type="button" onClick={() => setPaused((p) => !p)}>{paused ? "Play" : "Pause"}</button>}
            <span>Sample screens · Photo: <a href={cur.page} target="_blank" rel="noopener noreferrer">{cur.by} / Unsplash</a></span>
          </p>
        </div>
      </div>
    </section>
  );
}
