import React from "react";
import Link from "next/link";
import { strongFitGuide } from "@/lib/strong-fit";
import type { Scored } from "@/lib/matching";
export interface FitTile { label:string; count:number; range:string; tone:string; icon:string }
export function FitOverviewCard({tile,rows,guidanceHref="#career-guidance",compact=false}:{tile:FitTile;rows:Scored[];guidanceHref?:string;compact?:boolean}){
 const guide=tile.label==="Strong Fit" && tile.count===0 ? strongFitGuide(rows) : null;
 return <div key={tile.label} className={`card fit-overview-card${compact ? " fit-card-compact" : ""}`} data-tone={tile.tone}>
          <div className="fit-overview-top"><span className="fit-overview-icon"><svg aria-hidden="true" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{tile.icon==="star" ? <path d="m12 3 2.8 5.6 6.2.9-4.5 4.4 1.1 6.1-5.6-2.9L6.4 20l1.1-6.1L3 9.5l6.2-.9Z"/> : tile.icon==="check" ? <><circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/></> : tile.icon==="rise" ? <><path d="m4 17 6-6 4 4 6-10M14 5h6v6"/></> : <><circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/></>}</svg></span><span className="fit-range">{tile.range}</span></div>
          <b className="fit-overview-count">{tile.count}</b><span className="fit-overview-label">{tile.label}</span>
          {tile.label==="Strong Fit" && tile.count===0 ? compact ? <Link prefetch={false} className="fit-compact-link" href={guidanceHref} aria-label="No strong fit, go to career guide.">No strong fit, go to career guide.</Link> : <div className="fit-zero-guide"><p>{guide?.score!=null ? `Best score ${guide.score}% · ${guide.points} points to 90%.` : "No open match reaches 90% yet."}</p><p>{guide?.skills.length ? `Develop: ${guide.skills.slice(0,2).map(s=>s.label).join(", ")}.` : "Review your skills and profile gaps."}</p><Link prefetch={false} className="btn btn-ghost btn-sm" href={guidanceHref}>Career guidance ↗</Link></div>:null}
        </div>;
}
export function fitTiles(rows:Scored[]):FitTile[]{
 const rel=rows.filter(x=>x.m.relevant && !x.m.expired);
 const count=(min:number,max=101)=>rel.filter(x=>x.m.score>=min && x.m.score<max).length;
 return [
  {label:"Relevant jobs",count:rel.length,range:"All fit levels",tone:"navy",icon:"search"},
  {label:"Strong Fit",count:count(90),range:"90–100%",tone:"gold",icon:"star"},
  {label:"Best Fit",count:count(80,90),range:"80–89%",tone:"green",icon:"check"},
  {label:"Good Fit",count:count(70,80),range:"70–79%",tone:"blue",icon:"check"},
  {label:"Stretch Opportunity",count:count(55,70),range:"55–69%",tone:"amber",icon:"rise"},
  {label:"Explore Further",count:count(0,55),range:"Below 55%",tone:"slate",icon:"search"},
 ];
}

// Strong Fit has a dedicated card; show the highest other available band beside it.
export function dashboardFitSummary(rows:Scored[]):FitTile {
 const bands=fitTiles(rows).slice(2);
 return bands.find(tile=>tile.count>0) || bands[0];
}
