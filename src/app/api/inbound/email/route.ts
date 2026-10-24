import { readLimitedText } from "@/lib/request-security";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { processInbound } from "@/lib/server/inbound";
import { verify, SIGNATURE_HEADER, TIMESTAMP_HEADER } from "@/lib/inbound/signature";
import { aliasFrom } from "@/lib/inbound/parse";

export const maxDuration = 120;

/**
 * Receives forwarded alert emails from the Cloudflare Email Worker.
 * Body: {"to": "<alias>@<domain>", "raw": "<base64 RFC822>", "rawKey": "r2:..." | null}, signed with INBOUND_SHARED_SECRET.
 */
export async function POST(req: Request) {
  if (!/^[0-9a-f]{64}$/i.test(req.headers.get(SIGNATURE_HEADER)||"")) return NextResponse.json({error:"bad signature"},{status:401});
  let body: string;
  try { body = await readLimitedText(req, 30_000_000); }
  catch { return NextResponse.json({error:"too large"},{status:413}); }
  const ok = await verify(process.env.INBOUND_SHARED_SECRET || "", req.headers.get(TIMESTAMP_HEADER), req.headers.get(SIGNATURE_HEADER), body);
  if (!ok) return NextResponse.json({ error: "bad signature" }, { status: 401 });
  if (body.length > 30_000_000) return NextResponse.json({ error: "too large" }, { status: 413 });
  let msg: { to?: string; raw?: string; rawKey?: string | null };
  try { msg = JSON.parse(body); } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }
  const domain = process.env.NEXT_PUBLIC_INBOUND_EMAIL_DOMAIN || "";
  const alias = aliasFrom(String(msg.to || ""), domain);
  if (!alias || !msg.raw) return NextResponse.json({ error: "bad recipient" }, { status: 400 });
  const raw = Buffer.from(msg.raw, "base64").toString("utf8");
  const admin = createAdminClient();
  let rawKey = msg.rawKey ?? null;
  if (!rawKey) {
    // Keep the raw message privately for audit / re-processing (bucket inbound-raw has no public access).
    const key = `${alias}/${Date.now()}-${crypto.randomUUID()}.eml`;
    const up = await admin.storage.from("inbound-raw").upload(key, raw, { contentType: "message/rfc822" });
    if (!up.error) rawKey = key;
  }
  try {
    const r = await processInbound(admin, { alias, raw, rawKey });
    return NextResponse.json(r);
  } catch (e) {
    console.error("inbound", e);
    return NextResponse.json({ error: "processing failed" }, { status: 500 });
  }
}
