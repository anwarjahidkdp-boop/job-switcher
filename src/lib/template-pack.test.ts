import {it,expect} from 'vitest';import {templatePack} from './template-pack';import {DEMO_MASTER,DEMO_EXTRACT,DEMO_CV_TEXT,DEMO_PREFS,SAMPLE_JOBS_RAW} from './demo';import {buildMatchProfile,groundExtraction} from './facts';import {sampleToJob} from './jobs';import {BAND} from './matching';
it('uses the approved score-band labels',()=>expect(Object.values(BAND).map(x=>x[0])).toEqual(['Strong Fit','Best Fit','Good Fit','Stretch Opportunity']));
it('never asserts willingness to relocate based solely on sponsorship need',()=>{
 const facts=groundExtraction(DEMO_EXTRACT,DEMO_CV_TEXT);const P=buildMatchProfile({name:DEMO_EXTRACT.name,facts,meta:DEMO_EXTRACT,prefs:DEMO_PREFS,country:'BD'});
 const pack=templatePack({...sampleToJob(SAMPLE_JOBS_RAW[0],'2026-10-23'),country:'GB'},DEMO_MASTER,P,{needVisa:true});
 expect(pack.cover_letter).toContain('need visa sponsorship');expect(pack.cover_letter).not.toMatch(/ready to relocate|willing to relocate/i);
 expect(pack.top_bullets.every(b=>DEMO_MASTER.experience[0].bullets.includes(b))).toBe(true);expect(pack.skills_order.every(s=>[...DEMO_MASTER.skills_core,...DEMO_MASTER.skills_tools].includes(s))).toBe(true);
});
