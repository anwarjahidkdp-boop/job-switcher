import { NextResponse } from "next/server";
import { apiCtx, apiError, unauthorized } from "@/lib/server/api";
import { writeUkStatement } from "@/lib/server/uk-writing";

export const maxDuration = 120;

/** POST: write the UK supporting statement for this application from the CV used for it. */
export async function POST(_req: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const c = await apiCtx();
  if (!c) return unauthorized();
  const { jobId } = await params;
  try { return NextResponse.json(await writeUkStatement(c, jobId)); } catch (e) { return apiError(e); }
}
