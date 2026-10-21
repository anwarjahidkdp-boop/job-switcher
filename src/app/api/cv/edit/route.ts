import { NextResponse } from "next/server";
import { apiCtx, apiError, unauthorized } from "@/lib/server/api";
import { editMasterCv } from "@/lib/server/onboarding";
import { EditRefused, MAX_EDIT_CHARS } from "@/lib/cv-edit";

export const maxDuration = 120;

/** "Ask AI to change your CV": { instruction } -> { message, flags }. */
export async function POST(req: Request) {
  const c = await apiCtx();
  if (!c) return unauthorized();
  const body = (await req.json().catch(() => null)) as { instruction?: unknown } | null;
  const instruction = typeof body?.instruction === "string" ? body.instruction : "";
  if (instruction.length > MAX_EDIT_CHARS) return NextResponse.json({ error: `Keep it under ${MAX_EDIT_CHARS} characters. Ask for one change at a time.` }, { status: 400 });
  try { return NextResponse.json(await editMasterCv(c, instruction)); } catch (e) {
    if (e instanceof EditRefused) return NextResponse.json({ error: e.message }, { status: 422 });
    return apiError(e);
  }
}
