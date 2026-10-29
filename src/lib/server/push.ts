// Phone notifications: every bell notification (notify.ts) is also sent to the phones and computers where the person
// pressed "Turn on". The site key pair is made once and kept in push_keys; subscriptions live in push_subscriptions.
import type { SupabaseClient } from "@supabase/supabase-js";
import { makeVapidKeys, sendWebPush, type PushTarget, type VapidKeys } from "../push/webpush";

const SUBJECT = "mailto:hello@jobpao.app";
/** One run can add a handful of notifications for a person; their phone gets one alert per run, never a burst. */
export interface PushMessage { title: string; body: string; link: string; tag: string }

let cached: VapidKeys | null = null;
/** The site's key pair, made on first use. Two first uses at once keep whichever was saved first. */
export async function vapidKeys(admin: SupabaseClient): Promise<VapidKeys> {
  if (cached) return cached;
  const read = async () => {
    const { data, error } = await admin.from("push_keys").select("public_key, private_jwk").eq("id", 1).maybeSingle();
    if (error) throw error;
    return data ? { publicKey: data.public_key as string, privateJwk: data.private_jwk as JsonWebKey } : null;
  };
  let keys = await read();
  if (!keys) {
    const made = await makeVapidKeys();
    const { error } = await admin.from("push_keys").upsert({ id: 1, public_key: made.publicKey, private_jwk: made.privateJwk }, { onConflict: "id", ignoreDuplicates: true });
    if (error) throw error;
    keys = await read();
  }
  if (!keys) throw new Error("push keys missing");
  return (cached = keys);
}

/** What the phone shows for one batch of new bell notifications. */
export function pushMessage(items: { title: string; body?: string | null; link?: string | null; kind: string }[]): PushMessage | null {
  if (!items.length) return null;
  const [first] = items;
  const more = items.length - 1;
  const body = more ? `${first.title}${more === 1 ? " and 1 more update" : ` and ${more} more updates`}` : first.body || "";
  return {
    title: more ? `${items.length} new updates from JobPao` : first.title,
    body: body.slice(0, 180),
    link: more ? "/notifications" : safeLink(first.link),
    tag: more ? "jobpao-updates" : first.kind === "match" && first.link?.startsWith("/jobs/")
      ? `jobpao-match-${first.link.slice("/jobs/".length).split(/[/?#]/)[0].slice(0, 64)}`
      : `jobpao-${first.kind}`,
  };
}

/** Only links inside the app open from a notification. */
export const safeLink = (link?: string | null) => (link && link.startsWith("/") && !link.startsWith("//") ? link : "/notifications");

/** Saves this browser for the signed-in person. A browser belongs to whoever signed in on it last. Returns its id. */
export async function savePushSubscription(admin: SupabaseClient, userId: string, sub: PushTarget, userAgent: string | null): Promise<string> {
  const { data, error } = await admin.from("push_subscriptions").upsert({ user_id: userId, endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth, user_agent: userAgent?.slice(0, 300) ?? null }, { onConflict: "endpoint" }).select("id").single();
  if (error) throw error;
  return data.id as string;
}

/** The cookie that names this browser's subscription, so signing out stops its alerts (shared phones). */
export const PUSH_COOKIE = "jp_push";

/** Push endpoints are always https addresses of the browser's push service. */
export function validSubscription(v: unknown): PushTarget | null {
  const o = v as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } } | null;
  const endpoint = typeof o?.endpoint === "string" ? o.endpoint : "";
  const p256dh = typeof o?.keys?.p256dh === "string" ? o.keys.p256dh : "";
  const auth = typeof o?.keys?.auth === "string" ? o.keys.auth : "";
  try {
    if (new URL(endpoint).protocol !== "https:" || endpoint.length > 1000) return null;
  } catch { return null; }
  if (!/^[A-Za-z0-9_-]{80,100}$/.test(p256dh) || !/^[A-Za-z0-9_-]{16,32}$/.test(auth)) return null;
  return { endpoint, p256dh, auth };
}

/** Sends one alert to each of the person's devices. Gone devices (404/410) are forgotten. Returns how many got it. */
export async function pushToUser(admin: SupabaseClient, userId: string, msg: PushMessage): Promise<number> {
  const { data, error } = await admin.from("push_subscriptions").select("endpoint, p256dh, auth").eq("user_id", userId).limit(10);
  if (error) throw error;
  if (!data?.length) return 0;
  const keys = await vapidKeys(admin);
  let sent = 0;
  await Promise.all((data as PushTarget[]).map(async (t) => {
    try {
      const status = await sendWebPush(t, msg, keys, { subject: SUBJECT });
      if (status === 404 || status === 410) await admin.from("push_subscriptions").delete().eq("endpoint", t.endpoint);
      else if (status >= 200 && status < 300) sent++;
      else console.error("push rejected", status, new URL(t.endpoint).host);
    } catch (e) { console.error("push failed", new URL(t.endpoint).host, e); }
  }));
  return sent;
}
