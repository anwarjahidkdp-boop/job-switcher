import {describe,it,expect} from 'vitest';import {parseBrac} from './brac';
const p={id:1,slug:'analyst-1',job_title:'Analyst',is_external_job:true,is_internal_job:false,status:'Live',application_deadline:'2026-10-31 00:00:00',job_location_details:'Dhaka',experience_details:'3',education_details:'BSc in Computer Science',job_purpose:'SQL reporting'};
describe('verified BRAC public source',()=>{
 it('uses only public, live, unexpired employer jobs with original links',()=>{
  const rows=parseBrac({results:[p,{...p,id:2,is_external_job:false},{...p,id:3,status:'Closed'},{...p,id:4,application_deadline:'2026-10-01'}]},'2026-10-23');expect(rows).toHaveLength(1);expect(rows[0]).toMatchObject({company:'BRAC',country:'BD',minYears:3,deadline:'2026-10-31',externalId:'brac:1',url:'https://careers.brac.net/jobs/analyst-1?bulk=false'});
 });
 it('does not invent an expiry when deadline is absent',()=>expect(parseBrac({results:[{...p,application_deadline:null}]},'2026-10-23')[0].deadline).toBeNull());
 it('rejects provider schema changes',()=>expect(()=>parseBrac({jobs:[p]},'2026-10-23')).toThrow());
});
