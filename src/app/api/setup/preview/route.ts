import { NextResponse } from 'next/server';
import { z } from 'zod';
import { GuidedSetupSchema } from '@/lib/guided-setup';
import { createAdminClient } from '@/lib/supabase/admin';
import { rowToJob,type JobRow } from '@/lib/jobs';
import { previewMatches } from '@/lib/setup-preview';
import { readLimitedText,trustedMutation,RequestTooLarge } from '@/lib/request-security';
const schema=z.object({setup:GuidedSetupSchema,text:z.string().min(200).max(60000)});
export async function POST(req:Request){
 if(!trustedMutation(req))return NextResponse.json({error:'Please use the JobPao form.'},{status:403});
 try{
  const parsed=schema.safeParse(JSON.parse(await readLimitedText(req,80000)));if(!parsed.success)return NextResponse.json({error:'Check your answers and choose a readable CV.'},{status:400});
  // Read only public, active, non-demo jobs. Never select private user jobs, applications or CVs.
  const {data,error}=await createAdminClient().from('jobs').select('id,country,title,company,industry,category,location,employment_type,salary_min,salary_max,min_years,max_years,seniority,education,required_skills,preferred_skills,certs,visa_sponsorship,deadline,published_at,apply_method,apply_target,url,responsibilities,is_sample,owner_id,source_kind,source_label,created_at,eligibility:raw->eligibility').is('owner_id',null).eq('active',true).eq('is_sample',false).eq('country',parsed.data.setup.country).order('created_at',{ascending:false}).limit(1000);
  if(error)throw error;
  const jobs=((data||[]) as unknown as JobRow[]).map(rowToJob);const matches=previewMatches(jobs,parsed.data.text,parsed.data.setup);
  return NextResponse.json({count:matches.length,searched:jobs.length,limited:jobs.length===1000,matches:matches.slice(0,3),checkedAt:new Date().toISOString()},{headers:{'Cache-Control':'no-store'}});
 }catch(e){if(e instanceof RequestTooLarge)return NextResponse.json({error:'That CV text is too large.'},{status:413});if(e instanceof SyntaxError)return NextResponse.json({error:'Check your CV and try again.'},{status:400});return NextResponse.json({error:'We could not check jobs right now. Try again, or continue to signup.'},{status:503});}
}
