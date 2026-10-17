import { NextResponse } from "next/server";
import { apiCtx, apiError, unauthorized } from "@/lib/server/api";
import { buildMasterCv } from "@/lib/server/onboarding";

export const maxDuration = 120;

export async function POST() {
  const c = await apiCtx();
  if (!c) return unauthorized();
  try { return NextResponse.json(await buildMasterCv(c)); } catch (e) { return apiError(e); }
}
