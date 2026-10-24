import { NextResponse } from "next/server";
import { apiCtx, apiError, unauthorized } from "@/lib/server/api";
import { setReminder } from "@/lib/server/applications";
import { loadProfile } from "@/lib/server/state";
import { cc, rule } from "@/lib/countries";
import { todayStr } from "@/lib/dates";

export const maxDuration = 120;

/** Apply later: save a reminder only; application preparation requires an explicit Apply click. */
export async function POST(req: Request) {
  const c = await apiCtx();
  if (!c) return unauthorized();
  try {
    const b = (await req.json()) as { jobId: string; date: string };
    const p = await loadProfile(c.db, c.userId);
    await setReminder(c, String(b.jobId), String(b.date), todayStr(rule(cc(p?.target_country)).timeZone));
    return NextResponse.json({ ok: true });
  } catch (e) { return apiError(e); }
}
