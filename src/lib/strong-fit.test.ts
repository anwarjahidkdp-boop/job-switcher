import { expect,it } from "vitest";
import { strongFitGuide } from "./strong-fit";
import type { Scored } from "./matching";
const row=(score:number,gaps:unknown[]=[],expired=false)=>({job:{id:String(score),title:'Accounts Manager',company:'Synthetic'},m:{score,relevant:true,expired,allGaps:gaps}} as Scored);
it('explains the 90 percent threshold and actual skill gaps for the closest match',()=>{
 const guide=strongFitGuide([row(82,[{skill:'sap',t:'SAP missing'}]),row(75,[{skill:'power bi',t:'Power BI missing'}])])!;
 expect(guide.points).toBe(8);expect(guide.closest?.m.score).toBe(82);expect(guide.skills[0]).toMatchObject({skill:'sap',closest:true});
});
it('does not show no Strong Fit when an open relevant vacancy reaches 90',()=>{expect(strongFitGuide([row(90)])).toBeNull();});
it('excludes expired jobs, does not invent skills, and keeps non-skill barriers visible',()=>{
 const guide=strongFitGuide([row(99,[],true),row(69,[{t:'ACCA qualification required'}])])!;
 expect(guide.skills).toEqual([]);expect(guide.other).toEqual(['ACCA qualification required']);expect(guide.closest?.m.score).toBe(69);
});
