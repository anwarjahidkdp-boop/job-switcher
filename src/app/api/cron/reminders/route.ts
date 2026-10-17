import { NextResponse } from "next/server";
import { safeEqual } from "@/lib/server/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendDueReminders } from "@/lib/server/reminders";
import { publicEnv } from "@/lib/env";

export const maxDuration = 60;

/** Optional HTTP trigger for the reminders job (Vercel Cron / external cron). Requires Authorization: Bearer CRON_SECRET. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET || "";
  const auth = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!secret || !safeEqual(auth, secret)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const r = await sendDueReminders(createAdminClient(), { appUrl: publicEnv.appUrl });
  return NextResponse.json(r);
}
