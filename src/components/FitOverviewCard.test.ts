import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect,it } from "vitest";
import { FitOverviewCard,fitTiles } from "./FitOverviewCard";
import type { Scored } from "@/lib/matching";
const row=(score:number,expired=false)=>({job:{title:'Hidden role',company:'Hidden company'},m:{score,relevant:true,expired,allGaps:[{skill:'sap'}]}} as Scored);
it('counts each percentage band at its exact boundaries and excludes expired jobs',()=>{
 const tiles=fitTiles([54,55,69,70,79,80,89,90,100].map(s=>row(s)).concat(row(95,true)));
 expect(tiles.map(t=>t.count)).toEqual([9,2,2,2,2,1]);
 expect(tiles.map(t=>t.range)).toEqual(['All fit levels','90–100%','80–89%','70–79%','55–69%','Below 55%']);
});
it('shows concise zero Strong Fit guidance on both surfaces without naming a job',()=>{
 for(const href of ['#career-guidance','/insights#career-guidance']){
  const rows=[row(82)];const html=renderToStaticMarkup(React.createElement(FitOverviewCard,{tile:fitTiles(rows)[1],rows,guidanceHref:href}));
  for(const text of ['90–100%','82%','8 points','SAP','Career guidance',href])expect(html).toContain(text);
  expect(html).not.toContain('Hidden role');expect(html).not.toContain('Hidden company');
 }
});
it('removes the improvement prompt once Strong Fit opportunities exist',()=>{
 const rows=[row(90)];const html=renderToStaticMarkup(React.createElement(FitOverviewCard,{tile:fitTiles(rows)[1],rows}));
 expect(html).not.toContain('fit-zero-guide');
});
