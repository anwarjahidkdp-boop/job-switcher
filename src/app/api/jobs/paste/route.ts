import { NextResponse } from "next/server";
import { apiCtx, apiError, unauthorized } from "@/lib/server/api";
import { pasteJob } from "@/lib/server/jobs";

export const maxDuration = 60;

export async function POST(req: Request) {
  const c = await apiCtx();
  if (!c) return unauthorized();
  try {
    const b = (await req.json()) as { text?: string; url?: string };
    return NextResponse.json(await pasteJob(c, String(b.text || "").slice(0, 30000), b.url || null));
  } catch (e) { return apiError(e); }
}
