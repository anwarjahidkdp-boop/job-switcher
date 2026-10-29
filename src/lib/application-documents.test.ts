import {expect,it} from 'vitest';
import {applicationCv,editApplicationCv,packBoundToJob,canReusePack} from './application-documents';
import {manualDraft} from './manual-cv';
import {DEMO_MASTER} from './demo';
import type {ApplicationPack} from './types';
const pack={summary:'Application summary',top_bullets:['Application bullet'],skills_order:[],cover_letter:'Existing letter',emphasis:[],email_subject:'Subject',email_body:'Email',checklist:[]} as ApplicationPack;
it('never reuses a pack from a different job or an older master CV',()=>{
 const tagged={...pack,prepared_for:{job_id:'job-a',source_cv_id:'cv-1'}};
 expect(packBoundToJob(tagged,'job-b')).toBe(false);
 expect(canReusePack(tagged,'job-b','cv-1')).toBe(false);
 expect(canReusePack(tagged,'job-a','cv-2')).toBe(false);
 expect(canReusePack(tagged,'job-a','cv-1')).toBe(true);
 expect(canReusePack(pack,'job-a','cv-1')).toBe(false);
});
it('starts editing from the tailored application content and preserves the master',()=>{
 const before=structuredClone(DEMO_MASTER);
 const draft=manualDraft(applicationCv(before,pack),[]);expect(draft.summary).toBe('Application summary');
 draft.summary='My application-specific edit';draft.experience[0].bullets=['My revised responsibility'];
 const edited=editApplicationCv(before,pack,draft);
 expect(edited.edited_cv?.summary).toBe('My application-specific edit');
 expect(edited.top_bullets).toEqual(['My revised responsibility']);
 expect(edited.cover_letter).toBe('Existing letter');expect(before).toEqual(DEMO_MASTER);
 expect(applicationCv(before,edited)).toBe(edited.edited_cv);
});

it('keeps the original application CV snapshot even when the master CV changes',()=>{
 const original={...DEMO_MASTER,name:'Original Applicant'};
 const later={...DEMO_MASTER,name:'Updated Applicant'};
 const saved={...pack,source_cv_snapshot:original};
 expect(applicationCv(later,saved).name).toBe('Original Applicant');
 expect(applicationCv(later,saved).summary).toBe('Application summary');
});
