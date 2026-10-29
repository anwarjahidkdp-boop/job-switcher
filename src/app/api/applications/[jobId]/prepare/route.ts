import {readLimitedText} from "@/lib/request-security";
import { NextResponse } from "next/server";
import { apiCtx, apiError, unauthorized } from "@/lib/server/api";
import { ApplicationPreparationLimit, preparePack } from "@/lib/server/applications";
import { SubscriptionRequired } from "@/lib/server/trial-access";

export const maxDuration = 120;

export async function POST(req: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const c = await apiCtx();
  if (!c) return unauthorized();
  const { jobId } = await params;
  let standardOnly=false;
  if(req.body){
    let raw:string;try{raw=await readLimitedText(req,2048);}catch{return NextResponse.json({error:"Preparation request is too large."},{status:413});}
    if(raw.trim()){try{const body=JSON.parse(raw);standardOnly=body?.standard===true;}catch{return NextResponse.json({error:"Invalid preparation request."},{status:400});}}
  }
  try { return NextResponse.json(await preparePack(c, jobId,{standardOnly})); } catch (e) { if(e instanceof ApplicationPreparationLimit)return NextResponse.json({error:e.message,code:"preparation_allowance"},{status:429}); if(e instanceof SubscriptionRequired)return NextResponse.json({error:e.message,code:"subscription_required"},{status:402});return apiError(e); }
}
