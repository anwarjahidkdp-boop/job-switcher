import { NextResponse } from "next/server";
import { apiCtx, apiError, unauthorized } from "@/lib/server/api";
import { applyBoostAnswers, askBoost } from "@/lib/server/cv-boost";

export const maxDuration = 120;

/** "Strengthen my CV": {action:"ask"} returns the results questions; {action:"apply", answers} writes them into the CV. */
export async function POST(req: Request) {
  const c = await apiCtx();
  if (!c) return unauthorized();
  try {
    const body = await req.json().catch(() => ({})) as { action?: string; answers?: unknown };
    if (body.action === "apply") return NextResponse.json(await applyBoostAnswers(c, body.answers));
    return NextResponse.json({ questions: await askBoost(c) });
  } catch (e) { return apiError(e); }
}
