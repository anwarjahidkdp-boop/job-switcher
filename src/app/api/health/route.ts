import { NextResponse } from "next/server";

/** Uptime check: answers without touching the database, so it costs almost no CPU. */
export function GET() {
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
