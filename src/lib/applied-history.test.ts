import {expect,it} from 'vitest';
import type {ApplicationRow} from './server/state';
import {applicationMilestones,submittedApplications} from './applied-history';
const row=(status:string,applied_at:string|null=null)=>({id:status,status,applied_at,updated_at:'2026-10-24T00:00:00Z',application_events:[]} as unknown as ApplicationRow);
it('shows only submitted jobs, excluding prepared packs, reminders and unsent closed drafts',()=>{
 const rows=['preparing','ready','reminder','waiting','applied','interview','offer','closed','withdrawn'].map(status=>[status,row(status)]);
 expect(submittedApplications(Object.fromEntries(rows)).map(x=>x.status)).toEqual(['applied','interview','offer']);
 expect(submittedApplications({closed:row('closed','2026-10-23'),withdrawn:row('withdrawn','2026-10-24')})).toHaveLength(2);
});
it('retains recorded interviews after an offer and does not invent an interview for a direct offer',()=>{
 expect(applicationMilestones(row('offer'))).toEqual({interview:false,offer:true});
 const app=row('closed','2026-10-23');app.application_events=[{status:'interview',event:'Interview',actor:'user',created_at:'2026-10-23'},{status:'offer',event:'Offer',actor:'user',created_at:'2026-10-24'}];
 expect(applicationMilestones(app)).toEqual({interview:true,offer:true});
});
