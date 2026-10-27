// In-app notifications: the bell in the header and /notifications. Written with the service role; each one has a
// dedupe key so a job, reply check or trial message is only ever announced once per user.
import type { SupabaseClient } from "@supabase/supabase-js";
import { cache } from "react";

export type NotificationKind = "match" | "ready" | "reminder" | "reply" | "followup" | "interview" | "guide" | "trial";
export interface NewNotification { kind: NotificationKind; title: string; body?: string | null; link?: string | null; key: string }
export interface NotificationRow { id: string; kind: NotificationKind; title: string; body: string | null; link: string | null; created_at: string; read_at: string | null }

/** Adds notifications, skipping any the user already has (same key). Returns how many were new. */
export async function notify(admin: SupabaseClient, userId: string, items: NewNotification[]): Promise<number> {
  if (!items.length) return 0;
  const rows = items.map((n) => ({ user_id: userId, kind: n.kind, title: n.title.slice(0, 200), body: n.body?.slice(0, 500) ?? null, link: n.link ?? null, dedupe_key: n.key }));
  const { data, error } = await admin.from("notifications").upsert(rows, { onConflict: "user_id,dedupe_key", ignoreDuplicates: true }).select("id");
  if (error) throw error;
  return data?.length || 0;
}

export async function unreadCount(db: SupabaseClient, userId: string): Promise<number> {
  const { count } = await db.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", userId).is("read_at", null);
  return count || 0;
}

/** Cached per request, so a page can start this read early and await it where it is used. */
export const listNotifications = cache(async function listNotifications(db: SupabaseClient, userId: string, limit = 50): Promise<NotificationRow[]> {
  const { data } = await db.from("notifications").select("id, kind, title, body, link, created_at, read_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(limit);
  return (data || []) as NotificationRow[];
});

export async function markAllRead(db: SupabaseClient, userId: string) {
  await db.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", userId).is("read_at", null);
}
