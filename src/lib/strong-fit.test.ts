import { expect,it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StrongFitGuide } from "../components/StrongFitGuide";
import { strongFitGuide } from "./strong-fit";
import type { Scored } from "./matching";
const row=(score:number,gaps:unknown[]=[],expired=false)=>({job:{id:String(score),title:'Accounts Manager',company:'Synthetic'},m:{score,relevant:true,expired,allGaps:gaps}} as Scored);
it('aggregates skill gaps across vacancies instead of prioritizing one position',()=>{
 const guide=strongFitGuide([row(82,[{skill:'sap'},{skill:'sap'}]),row(75,[{skill:'power bi'}]),row(70,[{skill:'power bi'}])])!;
 expect(guide.points).toBe(8);expect(guide.score).toBe(82);expect(guide.skills.map(s=>s.skill)).toEqual(['power bi','sap']);
});
it('does not show no Strong Fit when an open relevant vacancy reaches 90',()=>{expect(strongFitGuide([row(90)])).toBeNull();});
it('excludes expired and irrelevant jobs without inventing skill gaps',()=>{
 const irrelevant=row(99,[{skill:'sap'}]);irrelevant.m.relevant=false;
 const guide=strongFitGuide([row(99,[{skill:'sap'}],true),irrelevant,row(69,[{t:'ACCA qualification required'}])])!;
 expect(guide.skills).toEqual([]);expect(guide.score).toBe(69);
});
it('renders a compact score and skill names without job details or course links',()=>{
 const html=renderToStaticMarkup(React.createElement(StrongFitGuide,{rows:[row(82,[{skill:'sap'}])]}));
 for(const text of ['No Strong Fit yet','90% or higher','82%','8 points','Skills to develop','SAP'])expect(html).toContain(text);
 for(const text of ['Accounts Manager','Synthetic','href=','Other factors','course','guarantee'])expect(html).not.toContain(text);
});
