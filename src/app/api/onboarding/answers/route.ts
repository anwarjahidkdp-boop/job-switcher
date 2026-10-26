import { NextResponse } from "next/server";
import { apiCtx, apiError, unauthorized } from "@/lib/server/api";
import { saveAnswers } from "@/lib/server/onboarding";

export const maxDuration = 120;

/** Setup questions: saves the answers (or none, when skipped) and moves on to preferences. */
export async function POST(req: Request) {
  const c = await apiCtx();
  if (!c) return unauthorized();
  try {
    const b = (await req.json()) as { answers?: Record<string, unknown>; skip?: boolean };
    const answers: Record<string, string> = {};
    if (!b.skip) for (const [k, v] of Object.entries(b.answers || {})) answers[k] = String(v ?? "");
    await saveAnswers(c, answers);
    return NextResponse.json({ ok: true });
  } catch (e) { return apiError(e); }
}
