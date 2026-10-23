import {createHash} from 'node:crypto';import type {IngestedJob} from '../../../src/lib/ingest/ats';
export const normaliseIdentity=(s:string)=>s.normalize('NFKC').toLowerCase().replace(/&(?:amp;)?/g,' and ').replace(/[^\p{L}\p{N}]+/gu,' ').trim().replace(/\s+/g,' ');
export function canonicalIdentity(j:IngestedJob,sourceId:string):string{
 const company=normaliseIdentity(j.company).replace(/\b(?:limited|ltd|plc)\b/g,'').replace(/\s+/g,' ').trim();
 // Confidential companies and absent deadlines must not conflate distinct hiring rounds.
 const safe=company.length>=3&&!/^(a )?(reputed|renowned|leading|private|confidential|anonymous|company)/.test(company)&&!!j.deadline;
 const key=safe?['BD',company,normaliseIdentity(j.title),normaliseIdentity(j.location||''),j.deadline,j.category].join('|'):[sourceId,j.externalId].join('|');
 return createHash('sha256').update(key).digest('hex');
}
