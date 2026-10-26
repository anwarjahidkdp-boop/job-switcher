import { readLimitedText } from "@/lib/request-security";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { handlePaddleWebhook } from "@/lib/server/billing";

/** Paddle webhook (transaction.completed, adjustment.*). Authenticated by the Paddle-Signature HMAC, not by a session. */
export async function POST(req: Request) {
  const sig = req.headers.get("paddle-signature");
  if (!sig || !/(^|;)h1=[0-9a-f]{64}/i.test(sig)) return NextResponse.json({ok:false},{status:401});
  let raw: string;
  try { raw = await readLimitedText(req, 1_000_000); }
  catch { return NextResponse.json({ok:false},{status:413}); }
  try {
    const r = await handlePaddleWebhook(createAdminClient(), raw, sig);
    return NextResponse.json({ ok: r.status < 300, note: r.note }, { status: r.status });
  } catch (e) {
    console.error("paddle webhook", e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
