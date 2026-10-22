import type { SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { EmailDeliveryError, sendEmail, type OutboundEmail } from "../email/send";

type QueuedEmail = OutboundEmail & { applicationId?: string; dueDate?: string };
export type DeliveryStatus = "pending" | "sending" | "sent" | "unresolved" | "failed";
/** No automatic reclaim of sending: a crashed worker may already have delivered. */
export async function deliverEmail(db: SupabaseClient, userId: string, key: string, payload: QueuedEmail): Promise<DeliveryStatus> {
  const dedupe = createHash("sha256").update(`${userId}:${key}`).digest("hex");
  const { error } = await db.from("email_deliveries").upsert({ user_id: userId, dedupe_key: dedupe, payload }, { onConflict: "dedupe_key", ignoreDuplicates: true });
  if (error) throw error;
  return attemptEmail(db, dedupe);
}
async function attemptEmail(db: SupabaseClient, key: string): Promise<DeliveryStatus> {
  const { data: prev, error: pe } = await db.from("email_deliveries").select("status,attempts,payload,user_id").eq("dedupe_key", key).maybeSingle();
  if (pe) throw pe;
  if (!prev) throw new Error("Email delivery is missing");
  if (prev.status !== "pending") return prev.status as DeliveryStatus;
  const { data: claimed, error: ce } = await db.from("email_deliveries").update({ status: "sending", attempts: prev.attempts + 1 })
    .eq("dedupe_key", key).eq("status", "pending").eq("attempts", prev.attempts).lt("attempts", 3).lte("next_attempt_at", new Date().toISOString()).select("id").maybeSingle();
  if (ce) throw ce;
  if (!claimed) return "pending";
  // Recheck opt-out on delayed deliveries, so a queued email does not ignore later preferences.
  const { data: profile, error: prefError } = await db.from("profiles").select("email_reminders").eq("id", prev.user_id).maybeSingle();
  if (prefError) {
    await db.from("email_deliveries").update({ status: "pending", last_error: "Preference lookup failed" }).eq("id", claimed.id);
    throw prefError;
  }
  if (!profile || profile.email_reminders === false) {
    const { error } = await db.from("email_deliveries").update({ status: "failed", last_error: "User opted out" }).eq("id", claimed.id);
    if (error) throw error;
    return "failed";
  }
  const message = prev.payload as QueuedEmail;
  if (message.applicationId) {
    const { data: app, error } = await db.from("applications").select("status,reminder_date").eq("id", message.applicationId).eq("user_id", prev.user_id).maybeSingle();
    if (error) {
      await db.from("email_deliveries").update({ status: "pending", last_error: "Application lookup failed" }).eq("id", claimed.id);
      throw error;
    }
    if (!app || app.status !== "reminder" || app.reminder_date !== message.dueDate) {
      const { error } = await db.from("email_deliveries").update({ status: "failed", last_error: "Reminder changed or canceled" }).eq("id", claimed.id);
      if (error) throw error;
      return "failed";
    }
  }
  let receipt: { id: string | null };
  try { receipt = await sendEmail(prev.payload as OutboundEmail, key); }
  catch (e) {
    const safe = e instanceof EmailDeliveryError && e.safeToRetry;
    const status = safe ? (prev.attempts + 1 >= 3 ? "failed" : "pending") : "unresolved";
    const { error } = await db.from("email_deliveries").update({ status, last_error: String(e).slice(0, 300), next_attempt_at: new Date(Date.now() + 3600_000).toISOString() }).eq("id", claimed.id);
    if (error) throw error;
    return status;
  }
  // A failed acknowledgement leaves sending locked; never cause another delivery.
  const { error } = await db.from("email_deliveries").update({ status: "sent", sent_at: new Date().toISOString(), provider_id: receipt.id, last_error: null }).eq("id", claimed.id);
  if (error) throw error;
  return "sent";
}
export async function flushEmailOutbox(db: SupabaseClient) {
  const { data, error } = await db.from("email_deliveries").select("dedupe_key").eq("status", "pending").lt("attempts", 3).lte("next_attempt_at", new Date().toISOString()).limit(100);
  if (error) throw error;
  let failed = 0;
  for (const r of data || []) { if (await attemptEmail(db, r.dedupe_key) !== "sent") failed++; }
  return { checked: (data || []).length, failed };
}
