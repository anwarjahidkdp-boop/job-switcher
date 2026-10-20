import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { handleLemonWebhook } from "@/lib/server/billing";

/** Lemon Squeezy webhook (order_created). Authenticated by the X-Signature HMAC, not by a session. */
export async function POST(req: Request) {
  const raw = await req.text();
  try {
    const r = await handleLemonWebhook(createAdminClient(), raw, req.headers.get("x-signature"));
    return NextResponse.json({ ok: r.status < 300, note: r.note }, { status: r.status });
  } catch (e) {
    console.error("lemonsqueezy webhook", e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
