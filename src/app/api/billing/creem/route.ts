import { readLimitedText } from "@/lib/request-security";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { handleCreemWebhook } from "@/lib/server/billing";

/** Creem webhook (checkout.completed, refund.created). Authenticated by the creem-signature HMAC, not by a session. */
export async function POST(req: Request) {
  const sig = req.headers.get("creem-signature");
  if (!/^[0-9a-f]{64}$/i.test(sig || "")) return NextResponse.json({ok:false},{status:401});
  let raw: string;
  try { raw = await readLimitedText(req, 1_000_000); }
  catch { return NextResponse.json({ok:false},{status:413}); }
  try {
    const r = await handleCreemWebhook(createAdminClient(), raw, sig);
    return NextResponse.json({ ok: r.status < 300, note: r.note }, { status: r.status });
  } catch (e) {
    console.error("creem webhook", e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
