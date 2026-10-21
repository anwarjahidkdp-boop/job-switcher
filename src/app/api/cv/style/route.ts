import { NextResponse } from "next/server";
import { apiCtx, apiError, unauthorized } from "@/lib/server/api";
import { loadProfile } from "@/lib/server/state";
import { isAccent, isTemplate } from "@/lib/countries";

/** CV look: { tpl?, accent? }. A plain route (not a server action) so a page opened before a release still works. */
export async function POST(req: Request) {
  const c = await apiCtx();
  if (!c) return unauthorized();
  const body = (await req.json().catch(() => null)) as { tpl?: unknown; accent?: unknown } | null;
  try {
    const p = await loadProfile(c.db, c.userId);
    const next = { ...(p?.cv_style || {}) } as Record<string, string>;
    if (isTemplate(body?.tpl)) next.tpl = body.tpl;
    if (isAccent(body?.accent)) next.accent = body.accent;
    const { error } = await c.db.from("profiles").update({ cv_style: next }).eq("id", c.userId);
    if (error) throw error;
    return NextResponse.json({ ok: true, style: next });
  } catch (e) { return apiError(e); }
}
