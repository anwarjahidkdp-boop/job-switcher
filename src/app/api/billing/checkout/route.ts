import { NextResponse } from "next/server";

/** Payment is deferred (bKash merchant later). Plans and prices live in the `plans` table; this endpoint is a stub. */
export async function POST() {
  return NextResponse.json({ error: "Payments are not available yet. Your trial features keep working until the trial ends." }, { status: 501 });
}
