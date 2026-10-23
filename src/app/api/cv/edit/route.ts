import { NextResponse } from "next/server";

/** Retired: stale browser tabs must never start a paid AI edit. */
export async function POST() {
  return NextResponse.json({ error: "AI chat editing has been discontinued. Reload the page and choose Edit CV to make changes yourself, with no AI charge." }, { status: 410 });
}
