import { NextResponse } from "next/server";
import { apiCtx, apiError, unauthorized } from "@/lib/server/api";
import { pushToUser } from "@/lib/server/push";

/** Opt-in device health check, once per calendar day per user. Never sends to employers. */
export async function POST() {
  const c = await apiCtx();
  if (!c) return unauthorized();
  try {
    const { count, error: countErr } = await c.admin.from("push_subscriptions")
      .select("id", { count: "exact", head: true }).eq("user_id", c.userId);
    if (countErr) throw countErr;
    if (!count) return NextResponse.json({ error: "Turn on phone notifications first." }, { status: 400 });
    const key = "push-test:" + new Date().toISOString().slice(0, 10);
    const { data, error } = await c.admin.from("notifications").upsert({
      user_id: c.userId, kind: "guide",
      title: "JobPao phone alerts are working",
      body: "You can now receive job matches, application deadlines and interview reminders.",
      link: "/notifications", dedupe_key: key,
    }, { onConflict: "user_id,dedupe_key", ignoreDuplicates: true }).select("id");
    if (error) throw error;
    if (!data?.length) return NextResponse.json({ error: "You already sent a test notification today." }, { status: 429 });
    const delivered = await pushToUser(c.admin, c.userId, {
      title: "JobPao phone alerts are working",
      body: "Job matches, deadlines and interview reminders can reach this device.",
      link: "/notifications", tag: "jobpao-push-test",
    });
    return NextResponse.json({ ok: delivered > 0, sent: delivered,
      message: delivered ? "Test notification sent. Check your phone." : "No phone accepted the push. Check this device's notification permissions and subscription." });
  } catch (e) { return apiError(e); }
}
