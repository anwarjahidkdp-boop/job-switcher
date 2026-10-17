// bKash Tokenized Checkout (merchant accounts) over plain fetch: grant token -> create -> (customer approves in the
// bKash page) -> callback -> execute -> query. Payments are activated only after a server-side query confirms them.
//
// Endpoints, headers and fields follow bKash's Tokenized Checkout v1.2.0-beta flow as used by maintained open-source
// integrations. Fields marked TODO(bkash) could not be confirmed against bKash's official reference from here and
// must be checked in the merchant sandbox before going live (see BUILD_NOTES.md).

export const BKASH_SANDBOX_URL = "https://tokenized.sandbox.bka.sh/v1.2.0-beta";
export const BKASH_PRODUCTION_URL = "https://tokenized.pay.bka.sh/v1.2.0-beta"; // TODO(bkash): confirm with your merchant onboarding pack.

export interface BkashCredentials { baseUrl: string; appKey: string; appSecret: string; username: string; password: string }

export interface BkashCreateResult { paymentID: string; bkashURL: string; transactionStatus?: string; statusCode?: string; statusMessage?: string }
export interface BkashPaymentState {
  paymentID?: string; trxID?: string; transactionStatus?: string; amount?: string; currency?: string; intent?: string;
  merchantInvoiceNumber?: string; merchantInvoice?: string; customerMsisdn?: string; payerReference?: string;
  statusCode?: string; statusMessage?: string; errorCode?: string; errorMessage?: string;
}

export class BkashError extends Error {
  constructor(message: string, public code?: string) { super(message); this.name = "BkashError"; }
}

export function bkashCredentialsFromEnv(env: Record<string, string | undefined> = process.env): BkashCredentials | null {
  if (!env.BKASH_APP_KEY || !env.BKASH_APP_SECRET || !env.BKASH_USERNAME || !env.BKASH_PASSWORD) return null;
  return { baseUrl: (env.BKASH_BASE_URL || BKASH_SANDBOX_URL).replace(/\/+$/, ""), appKey: env.BKASH_APP_KEY, appSecret: env.BKASH_APP_SECRET, username: env.BKASH_USERNAME, password: env.BKASH_PASSWORD };
}

// The id_token is valid for about an hour (expires_in, seconds). Cache it per Worker isolate.
// TODO(bkash): bKash asks merchants not to call grant on every payment; a shared cache (KV) would be better at scale.
let cached: { key: string; token: string; until: number } | null = null;
export const _resetTokenCache = () => { cached = null; };

export class BkashClient {
  constructor(private c: BkashCredentials, private fetchImpl: typeof fetch = fetch) {}

  private async post<T>(path: string, body: unknown, headers: Record<string, string>): Promise<T> {
    let res: Response;
    try {
      res = await this.fetchImpl(this.c.baseUrl + path, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json", ...headers },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30_000),
      });
    } catch (e) {
      throw new BkashError("bKash could not be reached: " + (e instanceof Error ? e.message : String(e)));
    }
    const j = (await res.json().catch(() => ({}))) as T & { statusCode?: string; statusMessage?: string; errorCode?: string; errorMessage?: string; msg?: string };
    if (!res.ok) throw new BkashError(`bKash HTTP ${res.status}: ${j.statusMessage || j.errorMessage || j.msg || ""}`.trim(), j.statusCode || j.errorCode);
    return j;
  }

  async token(): Promise<string> {
    const key = this.c.baseUrl + "|" + this.c.appKey;
    if (cached && cached.key === key && cached.until > Date.now()) return cached.token;
    const r = await this.post<{ id_token?: string; expires_in?: number; statusCode?: string; statusMessage?: string; msg?: string }>(
      "/tokenized/checkout/token/grant",
      { app_key: this.c.appKey, app_secret: this.c.appSecret },
      { username: this.c.username, password: this.c.password },
    );
    if (!r.id_token) throw new BkashError("bKash token grant failed: " + (r.statusMessage || r.msg || "no id_token"), r.statusCode);
    cached = { key, token: r.id_token, until: Date.now() + Math.max(60, (r.expires_in ?? 3600) - 300) * 1000 };
    return r.id_token;
  }

  private async authed<T>(path: string, body: unknown): Promise<T> {
    // bKash expects the raw id_token in Authorization (no "Bearer" prefix) plus the app key.
    return this.post<T>(path, body, { Authorization: await this.token(), "X-APP-Key": this.c.appKey });
  }

  /** Create a URL-based checkout payment. The customer is redirected to bkashURL, then back to callbackURL. */
  async createPayment(p: { amount: string; invoice: string; payerReference: string; callbackURL: string }): Promise<BkashCreateResult> {
    const r = await this.authed<BkashCreateResult>("/tokenized/checkout/create", {
      mode: "0011", // TODO(bkash): "0011" = checkout without agreement (URL based), per current integrations.
      payerReference: p.payerReference, // TODO(bkash): confirm allowed characters/length.
      callbackURL: p.callbackURL,
      amount: p.amount,
      currency: "BDT",
      intent: "sale",
      merchantInvoiceNumber: p.invoice,
    });
    if (r.statusCode !== "0000" || !r.paymentID || !r.bkashURL) throw new BkashError("bKash could not start the payment: " + (r.statusMessage || "unknown error"), r.statusCode);
    return r;
  }

  executePayment(paymentID: string) { return this.authed<BkashPaymentState>("/tokenized/checkout/execute", { paymentID }); }
  queryPayment(paymentID: string) { return this.authed<BkashPaymentState>("/tokenized/checkout/payment/status", { paymentID }); }
}

/**
 * Decide from a bKash query response whether this exact payment is complete for the expected amount and invoice.
 * Never trust the callback's `status` parameter on its own.
 */
export function verifyCompleted(q: BkashPaymentState, expected: { paymentID: string; amount: string; invoice: string }): { ok: true; trxID: string } | { ok: false; reason: string } {
  if (q.statusCode && q.statusCode !== "0000") return { ok: false, reason: `bKash status ${q.statusCode}: ${q.statusMessage || ""}`.trim() };
  if (q.paymentID && q.paymentID !== expected.paymentID) return { ok: false, reason: "payment ID mismatch" };
  if (q.transactionStatus !== "Completed") return { ok: false, reason: `transaction ${q.transactionStatus || "not completed"}` };
  if (!q.trxID) return { ok: false, reason: "no transaction ID" };
  if (q.currency && q.currency !== "BDT") return { ok: false, reason: "currency mismatch" };
  if (q.amount == null || Number(q.amount) !== Number(expected.amount)) return { ok: false, reason: "amount mismatch" };
  // The query response names the invoice merchantInvoice in some versions and merchantInvoiceNumber in others.
  const inv = q.merchantInvoiceNumber ?? q.merchantInvoice; // TODO(bkash): confirm which field the status query returns.
  if (inv && inv !== expected.invoice) return { ok: false, reason: "invoice mismatch" };
  return { ok: true, trxID: q.trxID };
}
