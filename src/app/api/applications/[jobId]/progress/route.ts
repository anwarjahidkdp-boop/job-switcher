import {revalidatePath} from "next/cache";
import {NextResponse} from 'next/server';
import {apiCtx,apiError,unauthorized} from '@/lib/server/api';
import {readLimitedText} from '@/lib/request-security';
import {confirmExternalApplied,updateStatus,TrialLimit} from '@/lib/server/applications';
export async function POST(req:Request,{params}:{params:Promise<{jobId:string}>}){
 const c=await apiCtx();if(!c)return unauthorized();
 const {jobId}=await params;
 if(!/^[0-9a-f-]{36}$/i.test(jobId))return NextResponse.json({error:'Invalid application.'},{status:400});
 let raw:string;try{raw=await readLimitedText(req,2048);}catch{return NextResponse.json({error:'Request too large.'},{status:413});}
 let body:{action?:unknown;confirm?:unknown};try{body=JSON.parse(raw);}catch{return NextResponse.json({error:'Invalid update.'},{status:400});}
 if(body?.confirm!==true||!['applied','interviewed','offer','closed','withdrawn'].includes(String(body.action)))return NextResponse.json({error:'Confirm the application update.'},{status:400});
 try{
  if(body.action==='applied')await confirmExternalApplied(c,jobId);else await updateStatus(c,jobId,String(body.action));
  revalidatePath("/","layout");
  return NextResponse.json({ok:true},{headers:{'Cache-Control':'private, no-store'}});
 }catch(e){if(e instanceof TrialLimit)return NextResponse.json({error:e.message,code:'trial_limit'},{status:402});return apiError(e);}
}
