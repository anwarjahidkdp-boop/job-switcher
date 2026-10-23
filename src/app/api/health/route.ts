import { NextResponse } from "next/server";

/** Uptime check: answers without touching the database, so it costs almost no CPU. */
export function GET() {
  return NextResponse.json({ ok: true, features: { gmailSending: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GMAIL_TOKEN_KEY) } }, { headers: { "Cache-Control": "no-store" } });
}
