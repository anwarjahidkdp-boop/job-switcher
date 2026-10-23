import { NextResponse } from "next/server";
import { apiCtx, apiError, unauthorized } from "@/lib/server/api";
import { savePreferences } from "@/lib/server/onboarding";

export async function POST(req: Request) {
  const c = await apiCtx();
  if (!c) return unauthorized();
  try {
    const b = (await req.json()) as { prefs: Record<string, unknown>; readiness?: {workAuthorization?:"yes"|"no"|"unknown";sponsorshipRequired?:boolean|null;willingToRelocate?:boolean|null}; personal?: Record<string, string> | null; needsVisa?: boolean; country?: string; revision?: number };
    if (typeof b.country !== "string" || !Number.isInteger(b.revision)) throw new Error("Reload this page to save your current country's preferences.");
    await savePreferences(c, b.prefs || {}, b.personal || null, { country: b.country, revision: b.revision!, needsVisa: b.needsVisa },b.readiness);
    return NextResponse.json({ ok: true });
  } catch (e) { return apiError(e); }
}
