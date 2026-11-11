import { NextResponse } from "next/server";
import { apiCtx, apiError, unauthorized } from "@/lib/server/api";
import { answerFormQuestion } from "@/lib/server/uk-writing";

export const maxDuration = 120;

/** POST {question, words?}: answer one question from the employer's application form, from the CV used for this application. */
export async function POST(req: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const c = await apiCtx();
  if (!c) return unauthorized();
  const { jobId } = await params;
  const body = await req.json().catch(() => ({}));
  try { return NextResponse.json(await answerFormQuestion(c, jobId, body?.question, body?.words)); } catch (e) { return apiError(e); }
}
