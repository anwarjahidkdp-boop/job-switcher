import { NextResponse } from 'next/server';
import { apiCtx, apiError, unauthorized } from '@/lib/server/api';
import { importGuidedSetup } from '@/lib/server/guided-setup';
import { GuidedSetupSchema } from '@/lib/guided-setup';
export async function POST(req:Request){const c=await apiCtx();if(!c)return unauthorized();try{const raw=await req.text();if(raw.length>8000)return NextResponse.json({error:'Your setup is too large.'},{status:400});const parsed=GuidedSetupSchema.safeParse(JSON.parse(raw));if(!parsed.success)return NextResponse.json({error:'Check your setup answers before saving.'},{status:400});return NextResponse.json(await importGuidedSetup(c,parsed.data));}catch(e){return apiError(e);}}
