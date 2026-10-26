import React from "react";
import Link from "next/link";
import { strongFitGuide } from "@/lib/strong-fit";
import type { Scored } from "@/lib/matching";
import { jobTotals } from "@/lib/server/search-summary";
export interface FitTile { label:string; count:number; range:string; tone:string; icon:string; href:string }
export function FitOverviewCard({tile,rows,guidanceHref="#career-guidance",compact=false}:{tile:FitTile;rows:Scored[];guidanceHref?:string;compact?:boolean}){
 const guide=tile.label==="Strong Fit" && tile.count===0 ? strongFitGuide(rows) : null;
 return <div key={tile.label} className={`card fit-overview-card${compact ? " fit-card-compact" : ""}`} data-tone={tile.tone}>
          <Link prefetch={false} className="fit-overview-hit" href={tile.href} aria-label={`${tile.count} ${tile.label}: see the jobs`} />
          <div className="fit-overview-top"><span className="fit-overview-icon"><svg aria-hidden="true" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{tile.icon==="star" ? <path d="m12 3 2.8 5.6 6.2.9-4.5 4.4 1.1 6.1-5.6-2.9L6.4 20l1.1-6.1L3 9.5l6.2-.9Z"/> : tile.icon==="check" ? <><circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/></> : tile.icon==="rise" ? <><path d="m4 17 6-6 4 4 6-10M14 5h6v6"/></> : <><circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/></>}</svg></span><span className="fit-range">{tile.range}</span></div>
          <b className="fit-overview-count">{tile.count}</b><span className="fit-overview-label">{tile.label}</span>
          {tile.label==="Strong Fit" && tile.count===0 ? compact ? <Link prefetch={false} className="fit-compact-link" href={guidanceHref} aria-label="No strong fit, go to career guide.">No strong fit, go to career guide.</Link> : <div className="fit-zero-guide"><p>{guide?.score!=null ? `Best score ${guide.score}% · ${guide.points} points to 90%.` : "No open match reaches 90% yet."}</p><p>{guide?.skills.length ? `Develop: ${guide.skills.slice(0,2).map(s=>s.label).join(", ")}.` : "Review your skills and profile gaps."}</p><Link prefetch={false} className="btn btn-ghost btn-sm" href={guidanceHref}>Career guidance ↗</Link></div>:null}
        </div>;
}
/** Insights fit tiles: the same totals and groups as Home (jobTotals), and each opens the same list as Home's card. */
export function fitTiles(rows:Scored[],checked=0):FitTile[]{
 const t=jobTotals(rows,null,checked);
 return [
  {label:"Jobs found",count:t.found,range:"All fit levels",tone:"navy",icon:"search",href:"/opportunities?fit=found"},
  {label:"Strong Fit",count:t.ex,range:"90–100%",tone:"gold",icon:"star",href:"/opportunities?fit=ex"},
  {label:"Best Fit",count:t.st,range:"80–89%",tone:"green",icon:"check",href:"/opportunities?fit=st"},
  {label:"Good Fit",count:t.po,range:"70–79%",tone:"blue",icon:"check",href:"/opportunities?fit=po"},
  {label:"Stretch & others",count:t.rest,range:"Below 70%",tone:"amber",icon:"rise",href:"/opportunities?fit=rest"},
 ];
}
