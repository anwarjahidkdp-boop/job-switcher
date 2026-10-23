import {expect,it} from 'vitest';
import {ageOn,eligibilityCheck,extractEligibility,setupRequirements,validBirthDate} from './eligibility';
import {normaliseJobText,jobToRow,rowToJob} from './jobs';
import {scoreJob} from './matching';
import {withAiScores} from './server/state';
import type {Job,MatchProfile} from './types';
const today='2026-10-23';
const job={id:'j',country:'BD',title:'Accountant',minYears:0,salaryMin:80000,salaryMax:100000,required:[],preferred:[],certs:[],resp:[],eligibility:{minAge:18,maxAge:32,ageAsOf:today}} as unknown as Job;
const P={birthDate:'1986-10-24',salaryMin:70000,salaryConfirmed:true,workAuthorization:'yes',sponsorshipRequired:false} as MatchProfile;
it('uses actual birthdays on the circular cutoff date, not approximate age or tenure',()=>{
 expect(ageOn('1994-10-24',today)).toBe(31);expect(ageOn('1994-10-23',today)).toBe(32);expect(ageOn('1994-10-22',today)).toBe(32);
 expect(validBirthDate('2026-02-30')).toBe(false);expect(validBirthDate('2027-01-01',today)).toBe(false);
 expect(eligibilityCheck(job,P,today)).toMatchObject({blocked:true,scoreCap:0});
 expect(eligibilityCheck(job,{...P,birthDate:'1994-10-23'},today).eligible).toBe(true);
});
it('does not assume missing birth date, cutoff, age exception or source requirements are satisfied',()=>{
 for(const [j,p] of [[job,{...P,birthDate:null}],[{...job,eligibility:{minAge:18,maxAge:32}},{...P,birthDate:'1996-01-01'}],[{...job,eligibility:{...job.eligibility,ageException:true}},P],[{...job,eligibility:{requirementsUnverified:true}},P]] as const){const r=eligibilityCheck(j,p,today);expect(r.eligible).toBe(false);expect(r.scoreCap).toBeLessThan(55);}
});
it('never applies Bangladesh age exclusions to protected or unreviewed markets',()=>{
 for(const country of ['GB','US','CA','XX']){const r=eligibilityCheck({...job,country},P,today);expect(r.blocked).toBe(false);expect(r.scoreCap).toBe(79);expect(r.issues[0].code).toBe('age_rule_review');}
});
it('enforces the exact pay floor, flags undisclosed and overlapping pay, and has no 10 percent tolerance',()=>{
 const j={...job,eligibility:{}};
 expect(eligibilityCheck({...j,salaryMax:69999},P,today)).toMatchObject({blocked:true,scoreCap:0});
 expect(eligibilityCheck({...j,salaryMin:70000,salaryMax:70000},P,today).eligible).toBe(true);
 expect(eligibilityCheck({...j,salaryMax:null},P,today).scoreCap).toBe(79);
 expect(eligibilityCheck({...j,salaryMin:21000,salaryMax:52000},P,today).scoreCap).toBe(0);
 expect(eligibilityCheck({...j,salaryMin:60000},P,today).scoreCap).toBe(79);
 expect(eligibilityCheck(j,{...P,salaryMin:null,salaryConfirmed:false},today)).toMatchObject({eligible:false,scoreCap:79});
});
it('checks work permission and explicit sponsorship rather than guessing residency',()=>{
 const j={...job,eligibility:{}};
 expect(eligibilityCheck(j,{...P,workAuthorization:'no'},today).scoreCap).toBe(0);
 expect(eligibilityCheck({...j,visa:false},{...P,workAuthorization:'no',sponsorshipRequired:true},today).scoreCap).toBe(0);
 expect(eligibilityCheck({...j,visa:null},{...P,sponsorshipRequired:true},today).scoreCap).toBe(79);
 expect(eligibilityCheck({...j,visa:true},{...P,workAuthorization:'no',sponsorshipRequired:true},today).eligible).toBe(true);
});
it('preserves literal English and Bangla age limits in stored jobs and list projections',()=>{
 expect(extractEligibility('Age limits: 18–32\nAge as of 2026-10-01')).toMatchObject({minAge:18,maxAge:32,ageAsOf:'2026-10-01'});
 expect(extractEligibility('বয়স: ১৮ থেকে ৩২ বছর')).toMatchObject({minAge:18,maxAge:32});
 expect(extractEligibility('5 years experience')).toEqual({});
 const j=normaliseJobText({title:'Accountant',company:'Test',text:'Age limits: 18–32',country:'BD',source:'Test',today});
 const row=jobToRow(j,{owner_id:null,source_kind:'bdweb',raw:{sourceField:'preserved'}});
 expect(row.raw).toMatchObject({sourceField:'preserved',eligibility:{minAge:18,maxAge:32}});
 expect(rowToJob({...row,id:'j'}).eligibility).toMatchObject({maxAge:32});
});
it('cannot be lifted to 100 by an old AI assessment after hard ineligibility',()=>{
 const profile={...P,currentTitle:'Accountant',seniority:'mid',skills:[],titles:['Accountant'],targetRoles:['Accountant'],categories:['Finance & Accounting'],education:[],industries:[],certs:[],locations:[],years:10,country:'BD'} as MatchProfile;
 const m=scoreJob({...job,category:'Finance & Accounting'},profile,{today});
 const [r]=withAiScores([{job,m}],new Map([['j',{fit:'strong',score:100,reason:'old opinion'}]]));
 expect(r.m.score).toBe(0);expect(r.m.relevant).toBe(false);
});
it('requires numeric salary, Bangladesh birth date, permission, sponsorship and relocation before setup completes',()=>{
 expect(setupRequirements({target_country:'BD'})).toEqual(['Date of birth','Expected salary','Work authorization','Sponsorship requirement','Relocation preference']);
 const answers={expectedSalary:70000,workAuthorization:'yes',sponsorshipRequired:false,willingToRelocate:false};
 expect(setupRequirements({target_country:'GB',answer_library:answers})).toEqual([]);
 expect(setupRequirements({target_country:'BD',answer_library:{...answers,birthDate:'1986-01-01'}})).toEqual([]);
 expect(setupRequirements({target_country:'US',answer_library:{...answers,salaryCountry:'BD'}})).toContain('Expected salary');
});
it('does not call an excluded company, a relocation conflict or unconfirmed remote work a match',()=>{
 const j={...job,eligibility:{},company:'Acme',location:'Chattogram',type:'On-site'};
 expect(eligibilityCheck(j,{...P,willingToRelocate:false,locations:['Dhaka']},today).scoreCap).toBe(0);
 expect(eligibilityCheck(j,{...P,workMode:'Remote'},today).scoreCap).toBe(79);
 expect(eligibilityCheck(j,{...P,dealBreakers:{excludedCompanies:['acme']}},today).scoreCap).toBe(0);
});
it('blocks application preparation when mandatory experience, education, skills or certification are absent',()=>{
 const j={...job,eligibility:{},minYears:5,education:{level:'masters' as const,field:''},required:['sap'],certs:[{names:['CA'],required:true}]};
 const r=eligibilityCheck(j,{...P,years:2,education:[{degree:'BBA',field:'accounting',level:'bachelors'}],skills:[],certs:[]},today);
 expect(r.eligible).toBe(false);expect(r.issues.map(i=>i.code)).toEqual(expect.arrayContaining(['experience','education','required_skills','certification']));
});

it('does not turn a title-only listing into a perfect match by ignoring missing requirements',()=>{
 const r=eligibilityCheck({...job,minYears:null,eligibility:{}},P,today);
 expect(r.scoreCap).toBe(79);expect(r.eligible).toBe(false);expect(r.issues.some(i=>i.code==='requirements_unknown')).toBe(true);
});
