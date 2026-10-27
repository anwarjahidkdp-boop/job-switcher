import { NextResponse } from "next/server";
import { apiCtx, apiError, unauthorized } from "@/lib/server/api";
import { PUSH_COOKIE, removePushSubscription, savePushSubscription, validSubscription, vapidKeys } from "@/lib/server/push";
import { readLimitedText } from "@/lib/request-security";

/** The site's public key, which the browser needs to subscribe. */
export async function GET() {
  const c = await apiCtx();
  if (!c) return unauthorized();
  try {
    return NextResponse.json({ key: (await vapidKeys(c.admin)).publicKey });
  } catch (e) { return apiError(e); }
}

/** "Turn on": remember this browser for the signed-in person. */
export async function POST(req: Request) {
  const c = await apiCtx();
  if (!c) return unauthorized();
  try {
    const sub = validSubscription(JSON.parse(await readLimitedText(req, 4_000) || "null"));
    if (!sub) return NextResponse.json({ error: "This browser sent an unusable subscription. Try again." }, { status: 400 });
    const id = await savePushSubscription(c.admin, c.userId, sub, req.headers.get("user-agent"));
    const res = NextResponse.json({ ok: true });
    res.cookies.set(PUSH_COOKIE, id, { httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: 400 * 86400 });
    return res;
  } catch (e) { return apiError(e); }
}

/** "Turn off" on this browser. */
export async function DELETE(req: Request) {
  const c = await apiCtx();
  if (!c) return unauthorized();
  try {
    const { endpoint } = JSON.parse(await readLimitedText(req, 2_000) || "{}") as { endpoint?: unknown };
    if (typeof endpoint === "string") await removePushSubscription(c.admin, c.userId, endpoint);
    return NextResponse.json({ ok: true });
  } catch (e) { return apiError(e); }
}
