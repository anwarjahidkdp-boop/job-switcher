// Paddle Billing card payments (Merchant of Record) for everyone living outside Bangladesh, who pays with bKash.
// Each payment is one transaction created server-side with a non-catalog USD price on the "JobPao Pro" product; the
// customer pays on our /pay page (Paddle.js). Pro is activated only from a signed transaction.completed webhook
// whose transaction id, amount and payment id match our row.
import { createHmac, timingSafeEqual } from "node:crypto";

export interface PaddleConfig { apiKey: string; productId: string; webhookSecret: string; clientToken: string; sandbox: boolean }

/** On only when every PADDLE_* value is set (GitHub secrets copied to the Worker at deploy). PADDLE_ENV=sandbox for tests. */
export function paddleConfig(env: Record<string, string | undefined> = process.env): PaddleConfig | null {
  const apiKey = env.PADDLE_API_KEY, productId = env.PADDLE_PRODUCT_ID, webhookSecret = env.PADDLE_WEBHOOK_SECRET, clientToken = env.PADDLE_CLIENT_TOKEN;
  return apiKey && productId && webhookSecret && clientToken ? { apiKey, productId, webhookSecret, clientToken, sandbox: env.PADDLE_ENV === "sandbox" } : null;
}

const apiBase = (cfg: PaddleConfig) => cfg.sandbox ? "https://sandbox-api.paddle.com" : "https://api.paddle.com";

/** Paddle-Signature: "ts=<unix>;h1=<hex>" (h1 may repeat during secret rotation); HMAC-SHA256 of "<ts>:<raw body>". */
export function verifySignature(rawBody: string, header: string | null, secret: string, now = Date.now(), toleranceSec = 300): boolean {
  if (!header) return false;
  let ts = "";
  const sigs: string[] = [];
  for (const part of header.split(";")) {
    const [k, v] = part.split("=", 2);
    if (k === "ts") ts = v ?? "";
    else if (k === "h1" && v) sigs.push(v);
  }
  if (!/^\d{1,12}$/.test(ts) || Math.abs(now / 1000 - Number(ts)) > toleranceSec) return false;
  const want = createHmac("sha256", secret).update(`${ts}:${rawBody}`, "utf8").digest();
  return sigs.some(s => /^[0-9a-f]{64}$/i.test(s) && timingSafeEqual(want, Buffer.from(s, "hex")));
}

export interface PaddleTransactionEvent { kind: "transaction"; event: string; transactionId: string; status: string; currency: string; unitAmount: number; quantity: number; paymentId: string | null }
export interface PaddleRefundEvent { kind: "refund"; event: string; transactionId: string; action: string; status: string; type: string }

/** The fields we rely on from a webhook; anything missing makes the event unusable. */
export function parseEvent(body: unknown): PaddleTransactionEvent | PaddleRefundEvent | null {
  const b = body as { event_type?: string; data?: Record<string, unknown> };
  const d = b?.data, event = b?.event_type;
  if (!event || !d) return null;
  if (event.startsWith("transaction.")) {
    if (typeof d.id !== "string") return null;
    const items = Array.isArray(d.items) ? d.items as { quantity?: number; price?: { unit_price?: { amount?: string; currency_code?: string } } }[] : [];
    const pid = (d.custom_data as Record<string, unknown> | null)?.payment_id;
    return {
      kind: "transaction", event, transactionId: d.id, status: String(d.status ?? ""), currency: String(d.currency_code ?? ""),
      // One item, quantity one, at the price we set; anything else fails the amount check.
      unitAmount: items.length === 1 ? Number(items[0].price?.unit_price?.amount ?? NaN) : NaN, quantity: items.length === 1 ? Number(items[0].quantity ?? NaN) : NaN,
      paymentId: typeof pid === "string" ? pid : null,
    };
  }
  if (event.startsWith("adjustment.")) {
    if (typeof d.transaction_id !== "string") return null;
    return { kind: "refund", event, transactionId: d.transaction_id, action: String(d.action ?? ""), status: String(d.status ?? ""), type: String(d.type ?? "") };
  }
  return null;
}

/** Create a transaction for one payment. Returns its id and the /pay link that opens Paddle's checkout for it. */
export async function createPaddleTransaction(cfg: PaddleConfig, input: { priceMinor: number; paymentId: string; userId: string; payUrl: string; label: string }, f: typeof fetch = fetch): Promise<{ id: string; url: string }> {
  const r = await f(`${apiBase(cfg)}/transactions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.apiKey}` },
    body: JSON.stringify({
      items: [{ quantity: 1, price: { product_id: cfg.productId, name: input.label, description: input.label, unit_price: { amount: String(input.priceMinor), currency_code: "USD" }, quantity: { minimum: 1, maximum: 1 } } }],
      currency_code: "USD",
      collection_mode: "automatic",
      custom_data: { payment_id: input.paymentId, user_id: input.userId },
      checkout: { url: input.payUrl },
    }),
  });
  const j = await r.json().catch(() => ({})) as { data?: { id?: string; checkout?: { url?: string } }; error?: { detail?: string } };
  const id = j.data?.id, url = j.data?.checkout?.url;
  if (!r.ok || !id || !url) throw new Error(`Paddle transaction ${r.status}: ${j.error?.detail || "no checkout url"}`);
  return { id, url };
}
