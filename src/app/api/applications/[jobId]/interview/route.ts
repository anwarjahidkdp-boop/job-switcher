import { NextResponse } from "next/server";
import { apiCtx, apiError, unauthorized } from "@/lib/server/api";
import { saveInterview, type InterviewInput } from "@/lib/server/interview";

/** POST {date, time, mode, where, notes, tzOffsetMin}: the user records an interview call for this job. */
export async function POST(req: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const c = await apiCtx();
  if (!c) return unauthorized();
  const b = (await req.json().catch(() => ({}))) as Partial<InterviewInput>;
  const { jobId } = await params;
  try {
    await saveInterview(c, jobId, { date: String(b.date || ""), time: b.time ? String(b.time) : null, mode: b.mode as InterviewInput["mode"], where: b.where ? String(b.where) : null, notes: b.notes ? String(b.notes) : null, tzOffsetMin: Number(b.tzOffsetMin) || 0 });
    return NextResponse.json({ ok: true });
  } catch (e) { return apiError(e); }
}
