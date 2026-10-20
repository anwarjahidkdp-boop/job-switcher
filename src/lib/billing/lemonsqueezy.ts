// Lemon Squeezy card payments (Merchant of Record) for everyone living outside Bangladesh, who pays with bKash.
// The store sells one "JobPao Pro, 30 days" product in US dollars; the checkout is created per payment with a custom
// price, and Pro is activated only from a signed order_created webhook whose amount and payment id match our row.
import { createHmac, timingSafeEqual } from "node:crypto";

export interface LemonConfig { apiKey: string; storeId: string; variantId: string; webhookSecret: string }

/** On only when every LEMONSQUEEZY_* value is set (GitHub secrets copied to the Worker at deploy). */
export function lemonConfig(env: Record<string, string | undefined> = process.env): LemonConfig | null {
  const apiKey = env.LEMONSQUEEZY_API_KEY, storeId = env.LEMONSQUEEZY_STORE_ID, variantId = env.LEMONSQUEEZY_VARIANT_ID, webhookSecret = env.LEMONSQUEEZY_WEBHOOK_SECRET;
  return apiKey && storeId && variantId && webhookSecret ? { apiKey, storeId, variantId, webhookSecret } : null;
}

/** Lemon Squeezy signs the raw body with HMAC-SHA256 (hex) in the X-Signature header. */
export function verifySignature(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature || !/^[0-9a-f]{64}$/i.test(signature)) return false;
  const want = createHmac("sha256", secret).update(rawBody, "utf8").digest();
  return timingSafeEqual(want, Buffer.from(signature, "hex"));
}

export interface LemonOrderEvent { event: string; paymentId: string | null; orderId: string; storeId: string; status: string; currency: string; subtotal: number; email: string | null }

/** The fields we rely on from an order webhook; anything missing makes the event unusable. */
export function parseOrderEvent(body: unknown): LemonOrderEvent | null {
  const b = body as { meta?: { event_name?: string; custom_data?: Record<string, unknown> }; data?: { id?: string | number; type?: string; attributes?: Record<string, unknown> } };
  const a = b?.data?.attributes;
  if (!b?.meta?.event_name || b.data?.type !== "orders" || !a || b.data.id == null) return null;
  const pid = b.meta.custom_data?.payment_id;
  return {
    event: b.meta.event_name, paymentId: typeof pid === "string" ? pid : null, orderId: String(b.data.id), storeId: String(a.store_id ?? ""),
    status: String(a.status ?? ""), currency: String(a.currency ?? ""), subtotal: Number(a.subtotal ?? NaN), email: typeof a.user_email === "string" ? a.user_email : null,
  };
}

/** Create a hosted checkout for one payment. Returns the URL to send the customer to. */
export async function createLemonCheckout(cfg: LemonConfig, input: { priceMinor: number; paymentId: string; userId: string; email: string | null; redirectUrl: string; label: string }, f: typeof fetch = fetch): Promise<string> {
  const r = await f("https://api.lemonsqueezy.com/v1/checkouts", {
    method: "POST",
    headers: { Accept: "application/vnd.api+json", "Content-Type": "application/vnd.api+json", Authorization: `Bearer ${cfg.apiKey}` },
    body: JSON.stringify({ data: {
      type: "checkouts",
      attributes: {
        custom_price: input.priceMinor,
        product_options: { redirect_url: input.redirectUrl, description: input.label, enabled_variants: [Number(cfg.variantId)] },
        checkout_data: { ...(input.email ? { email: input.email } : {}), custom: { payment_id: input.paymentId, user_id: input.userId } },
        expires_at: new Date(Date.now() + 2 * 3600_000).toISOString(),
      },
      relationships: { store: { data: { type: "stores", id: cfg.storeId } }, variant: { data: { type: "variants", id: cfg.variantId } } },
    } }),
  });
  const j = await r.json().catch(() => ({})) as { data?: { attributes?: { url?: string } }; errors?: { detail?: string }[] };
  const url = j.data?.attributes?.url;
  if (!r.ok || !url) throw new Error(`Lemon Squeezy checkout ${r.status}: ${j.errors?.[0]?.detail || "no url"}`);
  return url;
}
