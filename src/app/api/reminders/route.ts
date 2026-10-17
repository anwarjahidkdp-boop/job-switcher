import { NextResponse, after } from "next/server";
import { apiCtx, apiError, unauthorized } from "@/lib/server/api";
import { preparePack, setReminder } from "@/lib/server/applications";
import { loadProfile } from "@/lib/server/state";
import { cc, rule } from "@/lib/countries";
import { todayStr } from "@/lib/dates";

export const maxDuration = 120;

/** Apply later: set a reminder and prepare the pack in the background so it is ready when the reminder arrives. */
export async function POST(req: Request) {
  const c = await apiCtx();
  if (!c) return unauthorized();
  try {
    const b = (await req.json()) as { jobId: string; date: string };
    const p = await loadProfile(c.db, c.userId);
    const r = await setReminder(c, String(b.jobId), String(b.date), todayStr(rule(cc(p?.target_country)).timeZone));
    if (r.needsPack) after(() => preparePack(c, String(b.jobId)).then(() => undefined).catch((e) => console.error("background pack", e)));
    return NextResponse.json({ ok: true });
  } catch (e) { return apiError(e); }
}
