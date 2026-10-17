import { NextResponse } from "next/server";
import { apiCtx, apiError, unauthorized } from "@/lib/server/api";
import { PaymentError, submitManualPayment } from "@/lib/server/billing";

/** Record a manual bKash payment (TrxID + payer number) as pending. Pro starts only after an admin verifies it. */
export async function POST(req: Request) {
  const c = await apiCtx();
  if (!c) return unauthorized();
  try {
    const body = (await req.json().catch(() => ({}))) as { trxId?: string; msisdn?: string };
    return NextResponse.json(await submitManualPayment(c, { trxId: String(body.trxId || ""), msisdn: String(body.msisdn || "") }));
  } catch (e) {
    if (e instanceof PaymentError) return NextResponse.json({ error: e.message }, { status: 400 });
    return apiError(e);
  }
}
