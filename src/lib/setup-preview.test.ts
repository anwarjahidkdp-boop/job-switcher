import {expect,it} from 'vitest';
import {previewMatches} from './setup-preview';
import {emptySetup,type GuidedSetup} from './guided-setup';
import type {Job} from './types';
const setup={...emptySetup('GB'),roles:'Accountant',salaryMin:35000,workAuthorization:'yes',sponsorshipRequired:false,willingToRelocate:true} as GuidedSetup;
const job={id:'a',country:'GB',title:'Accountant',company:'Example',location:'London',type:'Full-time',required:['excel'],preferred:[],certs:[],salaryMax:50000,salaryMin:40000,resp:['Prepare accounts'],apply:{method:'portal',target:null},visa:null,deadline:null,publishedAt:null} as unknown as Job;
it('counts actual CV keyword matches, excluding private, sample, expired and unrelated jobs',()=>{const rows=[job,{...job,id:'b',ownerId:'someone'},{...job,id:'c',isSample:true},{...job,id:'d',deadline:'2020-01-01'},{...job,id:'e',title:'Software Developer'},{...job,id:'f',country:'BD'}] as Job[];expect(previewMatches(rows,'An accountant using Excel for reporting',setup)).toEqual([{title:'Accountant',company:'Example',location:'London',evidence:['excel']}]);expect(previewMatches([job],'Customer support and service',setup)).toEqual([]);expect(previewMatches([job],'Excellent customer support',setup)).toEqual([]);});
it('respects salary, visa, company, location and Bangladesh age restrictions',()=>{
 expect(previewMatches([{...job,salaryMax:20000}],'Excel accountant',setup)).toHaveLength(0);
 expect(previewMatches([{...job,visa:false}],'Excel accountant',{...setup,sponsorshipRequired:true})).toHaveLength(0);
 expect(previewMatches([job],'Excel accountant',{...setup,excludedCompanies:'Example'})).toHaveLength(0);
 expect(previewMatches([job],'Excel accountant',{...setup,locations:'Manchester',willingToRelocate:false})).toHaveLength(0);
 expect(previewMatches([{...job,country:'BD',eligibility:{maxAge:32,ageAsOf:'2026-10-28'}}],'Excel accountant',{...setup,country:'BD',birthDate:'1985-01-01'})).toHaveLength(0);
});
