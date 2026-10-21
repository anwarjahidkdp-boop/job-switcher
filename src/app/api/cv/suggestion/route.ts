import { NextResponse } from "next/server";
import { apiCtx, apiError, unauthorized } from "@/lib/server/api";
import { resolveSuggestion } from "@/lib/server/onboarding";

/** POST {id, option}: apply the chosen option of a recommended CV change; option null keeps the CV as it is. */
export async function POST(req: Request) {
  const c = await apiCtx();
  if (!c) return unauthorized();
  try {
    const b = (await req.json().catch(() => ({}))) as { id?: unknown; option?: unknown };
    const id = String(b.id || "").slice(0, 10);
    const option = b.option === null || b.option === undefined ? null : Number(b.option);
    if (!/^s\d{1,2}$/.test(id) || (option !== null && !(Number.isInteger(option) && option >= 0 && option < 3))) return NextResponse.json({ error: "Bad request" }, { status: 400 });
    return NextResponse.json(await resolveSuggestion(c, id, option));
  } catch (e) { return apiError(e); }
}
