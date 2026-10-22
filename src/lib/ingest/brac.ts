// Official public BRAC Careers API linked by careers.brac.net. No application endpoints.
import {normaliseJobText,stripHtml} from '../jobs';
import type {IngestedJob} from './ats';
export const BRAC_API='https://er-api.brac.net/api/v1/job/public/job-posts/';
export function parseBrac(payload:unknown,today:string):IngestedJob[]{
 if(!payload||typeof payload!=='object'||!Array.isArray((payload as {results?:unknown}).results))throw new Error('Invalid BRAC listing payload');
 return ((payload as {results:Record<string,unknown>[]}).results).flatMap(p=>{
  if(p.is_external_job!==true||p.status!=='Live'||!p.id||!p.slug||!p.job_title)return [];
  const deadline=typeof p.application_deadline==='string'?p.application_deadline.slice(0,10):null;
  if(deadline&&deadline<today)return [];
  const text=['job_purpose','key_responsibilities','education_details','experience_details','required_competencies','other_benefits'].map(k=>`${k.replaceAll('_',' ')}: ${stripHtml(String(p[k]||''))}`).join('\n');
  const url=`https://careers.brac.net/jobs/${encodeURIComponent(String(p.slug))}?bulk=${p.is_bulk_requisition===true}`;
  const job=normaliseJobText({title:stripHtml(String(p.job_title)),company:'BRAC',country:'BD',location:String(p.job_location_details||'Bangladesh'),type:String(p.employee_type||''),text,url,deadline,publishedAt:typeof p.published_date==='string'?p.published_date.slice(0,10):null,source:'BRAC careers',today});
  // This field is an explicit minimum in the employer's structured listing.
  if(/^\d+(\.\d+)?$/.test(String(p.experience_details||'')))job.minYears=Number(p.experience_details);
  return [{...job,externalId:`brac:${p.id}`,description:text}];
 });
}
