import {z} from 'zod';
import {manualContent,ManualCvSchema,type ManualCv} from './manual-cv';
import type {ApplicationPack,MasterCV} from './types';

export const ApplicationDocumentSchema=z.discriminatedUnion('document',[
 z.object({document:z.literal('cv'),baseUpdatedAt:z.string().min(1).max(80),cv:ManualCvSchema}),
 z.object({document:z.literal('cover'),baseUpdatedAt:z.string().min(1).max(80),text:z.string().trim().min(1).max(16000)}),
]);
/** Materialise the tailored CV without touching the user's master CV. */
export function applicationCv(master:MasterCV,pack:ApplicationPack):MasterCV{
 return pack.edited_cv||{...master,summary:pack.summary||master.summary,experience:(master.experience||[]).map((e,i)=>i===0&&pack.top_bullets?.length?{...e,bullets:[...pack.top_bullets]}:e)};
}
export function editApplicationCv(master:MasterCV,pack:ApplicationPack,input:ManualCv):ApplicationPack{
 const edited=manualContent(input,applicationCv(master,pack),[]).master;
 return {...pack,edited_cv:edited,summary:edited.summary,top_bullets:edited.experience[0]?.bullets||[],skills_order:[...edited.skills_core,...edited.skills_tools]};
}
