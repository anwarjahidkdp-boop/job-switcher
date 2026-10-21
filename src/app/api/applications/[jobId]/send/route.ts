import { NextResponse } from "next/server";
import { apiCtx, apiError, unauthorized } from "@/lib/server/api";
import { GmailError, sendApplication } from "@/lib/server/gmail";
import { TrialLimit } from "@/lib/server/applications";

/** POST {confirm:true}: the user pressed Apply on the review screen; send the prepared email from their Gmail. */
export async function POST(req: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const c = await apiCtx();
  if (!c) return unauthorized();
  const body = (await req.json().catch(() => ({}))) as { confirm?: boolean };
  if (body.confirm !== true) return NextResponse.json({ error: "Press Apply to confirm sending." }, { status: 400 });
  const { jobId } = await params;
  try { return NextResponse.json(await sendApplication(c, jobId)); }
  catch (e) {
    if (e instanceof TrialLimit) return NextResponse.json({ error: e.message, code: "trial_limit" }, { status: 402 });
    if (e instanceof GmailError) return NextResponse.json({ error: e.message, code: e.code }, { status: e.code === "google" ? 502 : 409 });
    return apiError(e);
  }
}
