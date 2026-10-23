import Link from "next/link";
import { strongFitGuide } from "@/lib/strong-fit";
import type { Scored } from "@/lib/matching";
import { courseLinks } from "@/lib/today";
export function StrongFitGuide({rows}:{rows:Scored[]}) {
 const guide=strongFitGuide(rows);
 return <section className="panel" style={{borderBottom:'1px solid var(--line)',background:guide ? 'var(--warn-soft)':undefined}} aria-label="Strong Fit career guidance">
  <div className="row" style={{justifyContent:'space-between'}}><h3>{guide ? 'No Strong Fit yet':'Strong Fit opportunities'}</h3><span className="pill p-ex">Strong Fit · 90% or higher</span></div>
  {guide ? <>
   {guide.closest ? <><p className="small" style={{marginTop:8}}>Your closest current match is <b>{guide.closest.m.score}%</b> — {guide.points} points below Strong Fit.</p><div className="bar" role="progressbar" aria-label="Closest profile match; Strong Fit starts at 90 percent" aria-valuemin={0} aria-valuemax={100} aria-valuenow={guide.closest.m.score} style={{margin:'8px 0'}}><i style={{width:`${guide.closest.m.score}%`}}/></div><Link href={`/jobs/${guide.closest.job.id}`} className="small">{guide.closest.job.title} · {guide.closest.job.company}</Link></>:<p className="small muted" style={{marginTop:8}}>Strong Fit begins at 90%. Add a relevant job or update your profile to see specific development opportunities.</p>}
   {guide.skills.length ? <><h4 style={{marginTop:12}}>Skills to develop or confirm</h4><p className="small muted">These vacancies ask for skills your profile does not fully show yet.</p>{guide.skills.map(s=><div className="qitem" key={s.skill}><div className="small"><b>{s.label}</b><div className="muted">{s.closest ? 'A gap for your closest match':`Requested in ${s.jobs} other relevant vacancies`}</div><div className="guide-links">{courseLinks(s.label).slice(0,2).map(l=><a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer nofollow">{l.label} ↗</a>)}</div></div></div>)}</>:guide.closest ? <p className="small muted" style={{marginTop:10}}>No specific missing skill is confirmed by the available job requirements. Check the full post before choosing a course.</p>:null}
   {guide.other.length ? <><h4 style={{marginTop:12}}>Other factors affecting this match</h4><ul className="small" style={{paddingLeft:18}}>{guide.other.map(s=><li key={s}>{s}</li>)}</ul></>:null}
   <p className="small muted" style={{marginTop:10}}>Fit also depends on the role, experience, qualifications and job requirements. Developing a skill can improve fit; it does not guarantee 90% or a job offer.</p>
   <div className="row" style={{marginTop:10}}><Link className="btn btn-ghost btn-sm" href="/profile">Add a skill I already have</Link><Link className="btn btn-text btn-sm" href="/insights">Explore career insights</Link></div>
  </>:null}
  <p className="small muted" style={{marginTop:10}}>Best Fit 80–89% · Good Fit 70–79% · Stretch Opportunity 55–69% · Explore Further below 55%</p>
 </section>;
}
