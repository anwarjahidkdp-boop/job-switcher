import {readLimitedText} from "@/lib/request-security";
import { NextResponse } from "next/server";
import { apiCtx, apiError, unauthorized } from "@/lib/server/api";
import { saveInterview, type InterviewInput } from "@/lib/server/interview";

/** POST {date, time, mode, where, notes, tzOffsetMin}: the user records an interview call for this job. */
export async function POST(req: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const c = await apiCtx();
  if (!c) return unauthorized();
  let raw:string;try{raw=await readLimitedText(req,16384);}catch{return NextResponse.json({error:"Interview details are too large."},{status:413});}
  let b:Partial<InterviewInput>;try{b=JSON.parse(raw);}catch{return NextResponse.json({error:"Invalid interview details."},{status:400});}
  if(!b||typeof b!=="object")return NextResponse.json({error:"Invalid interview details."},{status:400});
  const { jobId } = await params;
  try {
    await saveInterview(c, jobId, { date: String(b.date || ""), time: b.time ? String(b.time) : null, mode: b.mode as InterviewInput["mode"], where: b.where ? String(b.where) : null, notes: b.notes ? String(b.notes) : null, tzOffsetMin: Number(b.tzOffsetMin) || 0 });
    return NextResponse.json({ ok: true });
  } catch (e) { return apiError(e); }
}
