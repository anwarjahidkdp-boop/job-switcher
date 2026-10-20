import { NextResponse } from "next/server";
import { apiCtx, apiError, unauthorized } from "@/lib/server/api";
import { PaymentError, startCardCheckout } from "@/lib/server/billing";

/** Start a Lemon Squeezy card checkout (people living outside Bangladesh; off unless LEMONSQUEEZY_* is set). */
export async function POST(req: Request) {
  const c = await apiCtx();
  if (!c) return unauthorized();
  try {
    const body = (await req.json().catch(() => ({}))) as { pack?: string };
    return NextResponse.json(await startCardCheckout(c, body.pack));
  } catch (e) {
    if (e instanceof PaymentError) return NextResponse.json({ error: e.message }, { status: 400 });
    return apiError(e);
  }
}
