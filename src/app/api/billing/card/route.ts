import { NextResponse } from "next/server";
import { apiCtx, apiError, unauthorized } from "@/lib/server/api";
import { PaymentError, startCardCheckout } from "@/lib/server/billing";

/** Start a Lemon Squeezy card checkout (target countries other than Bangladesh; off unless LEMONSQUEEZY_* is set). */
export async function POST() {
  const c = await apiCtx();
  if (!c) return unauthorized();
  try {
    return NextResponse.json(await startCardCheckout(c));
  } catch (e) {
    if (e instanceof PaymentError) return NextResponse.json({ error: e.message }, { status: 400 });
    return apiError(e);
  }
}
