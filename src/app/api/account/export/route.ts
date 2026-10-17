import { NextResponse } from "next/server";
import { apiCtx, unauthorized } from "@/lib/server/api";

/** Download everything we hold about the user as JSON. */
export async function GET() {
  const c = await apiCtx();
  if (!c) return unauthorized();
  const tables = ["profiles", "subscriptions", "cv_documents", "career_facts", "master_cvs", "applications", "application_events", "reminders", "forwarding_addresses", "inbound_emails", "ai_usage"] as const;
  const out: Record<string, unknown> = {};
  for (const t of tables) {
    const col = t === "profiles" ? "id" : "user_id";
    const { data } = await c.db.from(t).select("*").eq(col, c.userId);
    out[t] = data || [];
  }
  const { data: jobs } = await c.db.from("jobs").select("*").eq("owner_id", c.userId);
  out.private_jobs = jobs || [];
  return new NextResponse(JSON.stringify(out, null, 2), { headers: { "Content-Type": "application/json", "Content-Disposition": 'attachment; filename="job-switcher-data.json"', "Cache-Control": "no-store" } });
}
