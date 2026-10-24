import {expect,it} from 'vitest';
import {applicationCv,editApplicationCv} from './application-documents';
import {manualDraft} from './manual-cv';
import {DEMO_MASTER} from './demo';
import type {ApplicationPack} from './types';
const pack={summary:'Application summary',top_bullets:['Application bullet'],skills_order:[],cover_letter:'Existing letter',emphasis:[],email_subject:'Subject',email_body:'Email',checklist:[]} as ApplicationPack;
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
