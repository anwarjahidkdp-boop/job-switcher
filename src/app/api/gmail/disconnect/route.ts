import { NextResponse } from "next/server";
import { apiCtx, apiError, unauthorized } from "@/lib/server/api";
import { disconnectGmail } from "@/lib/server/gmail";

export async function POST() {
  const c = await apiCtx();
  if (!c) return unauthorized();
  try { await disconnectGmail(c.admin, c.userId); return NextResponse.json({ ok: true }); } catch (e) { return apiError(e); }
}
