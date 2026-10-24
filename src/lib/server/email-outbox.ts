import {loadState} from './state';
import {deadlineItems,deadlineSummary} from '../deadlines';
import {nudgeEmail} from '../email/templates';
import {todayStr} from '../dates';
import {rule} from '../countries';
import type { SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { EmailDeliveryError, sendEmail, type OutboundEmail } from "../email/send";

type QueuedEmail = OutboundEmail & { applicationId?: string; dueDate?: string;deadlineContext?:{country:string;date:string;jobIds:string[];appUrl:string} };
export type DeliveryStatus = "pending" | "sending" | "sent" | "unresolved" | "failed" | "canceled";
/** No automatic reclaim of sending: a crashed worker may already have delivered. */
export async function deliverEmail(db: SupabaseClient, userId: string, key: string, payload: QueuedEmail): Promise<DeliveryStatus> {
  const dedupe = createHash("sha256").update(`${userId}:${key}`).digest("hex");
  const { error } = await db.from("email_deliveries").upsert({ user_id: userId, dedupe_key: dedupe, payload }, { onConflict: "dedupe_key", ignoreDuplicates: true });
  if (error) throw error;
  return attemptEmail(db, dedupe);
}
async function attemptEmail(db: SupabaseClient, key: string): Promise<DeliveryStatus> {
  const { data: prev, error: pe } = await db.from("email_deliveries").select("status,attempts,payload,user_id,last_error").eq("dedupe_key", key).maybeSingle();
  if (pe) throw pe;
  if (!prev) throw new Error("Email delivery is missing");
  if (prev.status !== "pending") return prev.status === "failed" && String(prev.last_error||"").startsWith("Deadline alert canceled") ? "canceled" : prev.status as DeliveryStatus;
  const { data: claimed, error: ce } = await db.from("email_deliveries").update({ status: "sending", attempts: prev.attempts + 1 })
    .eq("dedupe_key", key).eq("status", "pending").eq("attempts", prev.attempts).lt("attempts", 3).lte("next_attempt_at", new Date().toISOString()).select("id").maybeSingle();
  if (ce) throw ce;
  if (!claimed) return "pending";
  // Recheck opt-out on delayed deliveries, so a queued email does not ignore later preferences.
  const { data: profile, error: prefError } = await db.from("profiles").select("email_reminders,target_country,full_name").eq("id", prev.user_id).maybeSingle();
  if (prefError) {
    await db.from("email_deliveries").update({ status: "pending", last_error: "Preference lookup failed" }).eq("id", claimed.id);
    throw prefError;
  }
  if (!profile || profile.email_reminders === false) {
    const { error } = await db.from("email_deliveries").update({ status: "failed", last_error: (prev.payload as QueuedEmail).deadlineContext ? "Deadline alert canceled: user opted out" : "User opted out" }).eq("id", claimed.id);
    if (error) throw error;
    return (prev.payload as QueuedEmail).deadlineContext ? "canceled" : "failed";
  }
  let message = prev.payload as QueuedEmail;
  if(message.deadlineContext){
    const context=message.deadlineContext;
    try{
      const st=await loadState(db,prev.user_id);
      const items=st&&st.country===context.country&&todayStr(rule(st.country).timeZone)===context.date?deadlineItems(st).filter(x=>context.jobIds.includes(x.job.id)):[];
      if(!items.length){await db.from("email_deliveries").update({status:"failed",last_error:"Deadline alert canceled: selection or date changed"}).eq("id",claimed.id);return "canceled";}
      const account=await db.auth.admin.getUserById(prev.user_id);
      if(account.error)throw account.error;
      if(!account.data.user?.email||!account.data.user.email_confirmed_at){await db.from("email_deliveries").update({status:"failed",last_error:"Deadline alert canceled: email is not verified"}).eq("id",claimed.id);return "canceled";}
      message={...message,to:account.data.user.email,...nudgeEmail({name:profile.full_name||"",subject:"Your selected job deadlines",body:deadlineSummary(items),button:"Review your applications",link:context.appUrl.replace(/\/$/,"")+"/queue"})};
      const refreshed=await db.from("email_deliveries").update({payload:message}).eq("id",claimed.id);if(refreshed.error)throw refreshed.error;
    }catch(e){await db.from("email_deliveries").update({status:"pending",last_error:"Deadline validation unavailable"}).eq("id",claimed.id);throw e;}
  }
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
  try { receipt = await sendEmail(message as OutboundEmail, key); }
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
  for (const r of data || []) { if (!["sent","canceled"].includes(await attemptEmail(db, r.dedupe_key))) failed++; }
  return { checked: (data || []).length, failed };
}
