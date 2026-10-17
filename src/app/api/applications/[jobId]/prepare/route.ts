import { NextResponse } from "next/server";
import { apiCtx, apiError, unauthorized } from "@/lib/server/api";
import { preparePack } from "@/lib/server/applications";

export const maxDuration = 120;

export async function POST(_req: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const c = await apiCtx();
  if (!c) return unauthorized();
  const { jobId } = await params;
  try { return NextResponse.json(await preparePack(c, jobId)); } catch (e) { return apiError(e); }
}
