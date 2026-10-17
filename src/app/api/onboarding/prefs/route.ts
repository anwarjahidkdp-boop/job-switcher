import { NextResponse } from "next/server";
import { apiCtx, apiError, unauthorized } from "@/lib/server/api";
import { savePreferences } from "@/lib/server/onboarding";

export async function POST(req: Request) {
  const c = await apiCtx();
  if (!c) return unauthorized();
  try {
    const b = (await req.json()) as { prefs: Record<string, unknown>; personal?: Record<string, string> | null };
    await savePreferences(c, b.prefs || {}, b.personal || null);
    return NextResponse.json({ ok: true });
  } catch (e) { return apiError(e); }
}
