import { NextResponse } from "next/server";
import { apiCtx, apiError, unauthorized } from "@/lib/server/api";
import { pushToUser } from "@/lib/server/push";

/** "Send a test": proves the alert reaches the person's own devices. Not stored in the bell. */
export async function POST() {
  const c = await apiCtx();
  if (!c) return unauthorized();
  try {
    const sent = await pushToUser(c.admin, c.userId, { title: "JobPao alerts are on", body: "New strong matches and reminders will show here, like this one.", link: "/notifications", tag: "jobpao-test" });
    return NextResponse.json({ sent });
  } catch (e) { return apiError(e); }
}
