import { exportAccount } from "@/lib/server/account-data";
import { NextResponse } from "next/server";
import { apiCtx, apiError, unauthorized } from "@/lib/server/api";

/** Download everything we hold about the user as JSON. */
export async function GET() {
  const c = await apiCtx();
  if (!c) return unauthorized();
  try {
  const out = await exportAccount(c.db,c.userId);
  return new NextResponse(JSON.stringify(out, null, 2), { headers: { "Content-Type": "application/json", "Content-Disposition": 'attachment; filename="job-switcher-data.json"', "Cache-Control": "no-store" } });
  } catch(e) { return apiError(e); }
}
