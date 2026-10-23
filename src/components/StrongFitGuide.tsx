import React from "react";
import { strongFitGuide } from "@/lib/strong-fit";
import type { Scored } from "@/lib/matching";
export function StrongFitGuide({rows}:{rows:Scored[]}) {
 const guide=strongFitGuide(rows);
 return <section className="panel" style={{borderBottom:'1px solid var(--line)',background:guide ? 'var(--warn-soft)':undefined}} aria-label="Strong Fit career guidance">
  <div className="row" style={{justifyContent:'space-between'}}><h3>{guide ? 'No Strong Fit yet':'Strong Fit opportunities'}</h3><span className="pill p-ex">Strong Fit · 90% or higher</span></div>
  {guide ? <>
   {guide.score!=null ? <><p className="small" style={{marginTop:8}}>Current best match: <b>{guide.score}%</b> · {guide.points} points to Strong Fit.</p><div className="bar" role="progressbar" aria-label="Current best match; Strong Fit starts at 90 percent" aria-valuemin={0} aria-valuemax={100} aria-valuenow={guide.score} style={{margin:'8px 0'}}><i style={{width:`${guide.score}%`}}/></div></>:null}
   {guide.skills.length ? <div style={{marginTop:8}}><h4 className="small">Skills to develop</h4><ul className="small" style={{display:'flex',flexWrap:'wrap',gap:'4px 24px',paddingLeft:18,marginTop:4}}>{guide.skills.map(s=><li key={s.skill}>{s.label}</li>)}</ul></div>:null}
  </>:null}
 </section>;
}
