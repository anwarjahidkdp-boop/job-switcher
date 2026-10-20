import { NextResponse } from "next/server";
import { apiCtx, apiError, unauthorized } from "@/lib/server/api";
import { PaymentError, startCheckout } from "@/lib/server/billing";

/** Start a bKash Tokenized Checkout payment (merchant accounts only; disabled unless the BKASH_* env is set). */
export async function POST(req: Request) {
  const c = await apiCtx();
  if (!c) return unauthorized();
  try {
    const body = (await req.json().catch(() => ({}))) as { pack?: string };
    return NextResponse.json(await startCheckout(c, body.pack));
  } catch (e) {
    if (e instanceof PaymentError) return NextResponse.json({ error: e.message }, { status: 400 });
    return apiError(e);
  }
}
