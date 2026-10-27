// Creem card payments (Merchant of Record) for everyone living outside Bangladesh, who pays with bKash.
// The store sells one "JobPao Pro" one-time product in US dollars; each payment gets its own hosted checkout with a
// custom price, and Pro is activated only from a signed checkout.completed webhook whose checkout id, payment id and
// amount match our row.
import { createHmac, timingSafeEqual } from "node:crypto";

export interface CreemConfig { apiKey: string; productId: string; webhookSecret: string; test: boolean }

/** On only when every CREEM_* value is set (GitHub secrets copied to the Worker at deploy). Test keys use the test API. */
export function creemConfig(env: Record<string, string | undefined> = process.env): CreemConfig | null {
  const apiKey = env.CREEM_API_KEY, productId = env.CREEM_PRODUCT_ID, webhookSecret = env.CREEM_WEBHOOK_SECRET;
  return apiKey && productId && webhookSecret ? { apiKey, productId, webhookSecret, test: apiKey.startsWith("creem_test_") } : null;
}

const apiBase = (cfg: CreemConfig) => cfg.test ? "https://test-api.creem.io" : "https://api.creem.io";

/** creem-signature is the hex HMAC-SHA256 of the raw body, keyed with the webhook secret. */
export function verifySignature(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature || !/^[0-9a-f]{64}$/i.test(signature)) return false;
  const want = createHmac("sha256", secret).update(rawBody, "utf8").digest();
  return timingSafeEqual(want, Buffer.from(signature, "hex"));
}

const idOf = (v: unknown): string | null => typeof v === "string" ? v : v && typeof (v as { id?: unknown }).id === "string" ? (v as { id: string }).id : null;

export interface CreemCheckoutEvent { kind: "checkout"; checkoutId: string; status: string; orderId: string | null; orderStatus: string; amount: number; currency: string; paymentId: string | null; mode: string }
export interface CreemRefundEvent { kind: "refund"; refundId: string; status: string; orderId: string | null; transactionStatus: string; mode: string }

/** The fields we rely on from a webhook; anything missing makes the event unusable. */
export function parseEvent(body: unknown): CreemCheckoutEvent | CreemRefundEvent | null {
  const b = body as { eventType?: string; object?: Record<string, unknown> };
  const o = b?.object;
  if (!o || typeof o.id !== "string") return null;
  const mode = String(o.mode ?? "");
  if (b.eventType === "checkout.completed") {
    const order = (o.order ?? {}) as Record<string, unknown>;
    const pid = (o.metadata as Record<string, unknown> | null)?.payment_id;
    return {
      kind: "checkout", checkoutId: o.id, status: String(o.status ?? ""), orderId: idOf(o.order), orderStatus: String(order.status ?? ""),
      amount: Number(order.amount ?? NaN), currency: String(order.currency ?? ""), paymentId: typeof pid === "string" ? pid : null, mode,
    };
  }
  if (b.eventType === "refund.created") {
    const t = (o.transaction ?? {}) as Record<string, unknown>;
    return { kind: "refund", refundId: o.id, status: String(o.status ?? ""), orderId: idOf(o.order) ?? idOf(t.order), transactionStatus: String(t.status ?? ""), mode };
  }
  return null;
}

/** Create a hosted checkout for one payment. Returns its id and the URL to send the customer to. */
export async function createCreemCheckout(cfg: CreemConfig, input: { priceMinor: number; paymentId: string; userId: string; email: string | null; successUrl: string; consentAt?: string }, f: typeof fetch = fetch): Promise<{ id: string; url: string }> {
  const r = await f(`${apiBase(cfg)}/v1/checkouts`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": cfg.apiKey },
    body: JSON.stringify({
      product_id: cfg.productId, units: 1, custom_price: input.priceMinor, request_id: input.paymentId, success_url: input.successUrl,
      ...(input.email ? { customer: { email: input.email } } : {}),
      metadata: { payment_id: input.paymentId, user_id: input.userId, ...(input.consentAt ? { start_now_consent_at: input.consentAt } : {}) },
    }),
  });
  const j = await r.json().catch(() => ({})) as { id?: string; checkout_url?: string; message?: string | string[] };
  if (!r.ok || !j.id || !j.checkout_url) throw new Error(`Creem checkout ${r.status}: ${[j.message].flat().join("; ") || "no checkout url"}`);
  return { id: j.id, url: j.checkout_url };
}
