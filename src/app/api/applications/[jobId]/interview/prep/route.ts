import { NextResponse } from "next/server";
import { apiCtx, apiError, unauthorized } from "@/lib/server/api";
import { prepareInterview } from "@/lib/server/interview";

export const maxDuration = 120;

/** POST: build likely questions, sample answers and a checklist for this interview. */
export async function POST(_req: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const c = await apiCtx();
  if (!c) return unauthorized();
  const { jobId } = await params;
  try { return NextResponse.json(await prepareInterview(c, jobId)); } catch (e) { return apiError(e); }
}
