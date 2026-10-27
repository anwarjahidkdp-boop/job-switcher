import { NextResponse } from 'next/server';
import {apiCtx,apiError,unauthorized} from '@/lib/server/api';
import {loadProfile} from '@/lib/server/state';
import {ingestCv} from '@/lib/server/onboarding';
import {MAX_CV_BYTES,MAX_CV_TEXT} from '@/lib/cv/sniff';
export const maxDuration=120;
/** The anonymous draft may only fill the empty upload stage of the signed-in guided setup. */
export async function POST(req:Request){const c=await apiCtx();if(!c)return unauthorized();try{
 const p=await loadProfile(c.db,c.userId);
 const {data,error}=await c.db.from('cv_documents').select('id').eq('user_id',c.userId).eq('is_current',true).maybeSingle();if(error)throw error;
 if(data)return NextResponse.json({imported:false,existing:true});
 if(!p||p.onboarding_step!=='upload'||p.career_meta?.guided_setup!==true)return NextResponse.json({error:'Your account already has a setup. Update your CV from your account instead.'},{status:409});
 if(Number(req.headers.get('content-length')||0)>MAX_CV_BYTES+100000)return NextResponse.json({error:'CV file is too large.'},{status:413});
 const fd=await req.formData(),file=fd.get('file'),country=fd.get('country');
 if(country!==p.target_country)return NextResponse.json({error:'Your search country changed. Review your setup first.'},{status:409});
 if(!(file instanceof File)||file.size>MAX_CV_BYTES)return NextResponse.json({error:'Choose a CV under 10 MB.'},{status:400});
 const text=String(fd.get('text')||'');if(text.length>MAX_CV_TEXT)return NextResponse.json({error:'CV text is too long.'},{status:400});
 await ingestCv(c,{file:{name:file.name,bytes:new Uint8Array(await file.arrayBuffer())},text,source:'file'});
 return NextResponse.json({imported:true});
 }catch(e){return apiError(e);}}
