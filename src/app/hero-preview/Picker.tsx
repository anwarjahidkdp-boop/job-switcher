"use client";
import { useState } from "react";

export type Photo = { id: string; by: string; page: string; label: string };
const src = (id: string, w: number) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&h=${Math.round(w * 1.1)}&q=80&crop=faces,edges`;

/** Owner preview: the hero with a photo on the right and floating JobPao cards; thumbnails switch the photo. */
export function Picker({ photos }: { photos: Photo[] }) {
  const [i, setI] = useState(0);
  const p = photos[i];
  return (
    <>
      <div className="hv-thumbs">
        {photos.map((x, n) => (
          <button key={x.id} type="button" className={n === i ? "on" : ""} onClick={() => setI(n)} aria-label={`Photo ${n + 1}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src(x.id, 160)} alt="" />
            <span>{n + 1}</span>
          </button>
        ))}
      </div>
      <div className="hv-photo">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src(p.id, 900)} alt={p.label} />
        <div className="hv-float hv-f1"><span className="hp-ring">96</span><div><b>New best match</b><span>Assistant Manager, Accounts</span></div></div>
        <div className="hv-float hv-f2"><span className="hp-tick"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg></span><div><b>CV + cover letter ready</b><span>Tailored for this job</span></div></div>
        <div className="hv-float hv-f3"><span className="hp-tick"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg></span><div><b>Interview: Tue 11:00</b><span>Your prep is ready</span></div></div>
      </div>
      <p className="hv-credit">Photo {i + 1}: <a href={p.page} target="_blank" rel="noopener noreferrer">{p.by} on Unsplash</a></p>
    </>
  );
}
