import { beforeEach, describe, expect, it } from "vitest";
import { billingConfig, bkashAmount, extendPeriod, isAdminEmail, normaliseMsisdn, normaliseTrxId } from "./manual";
import { BkashClient, BkashError, _resetTokenCache, verifyCompleted } from "./bkash";

describe("manual bKash input", () => {
  it("normalises TrxIDs and refuses junk", () => {
    expect(normaliseTrxId(" 9jk7abc1xy ")).toBe("9JK7ABC1XY");
    expect(normaliseTrxId("TrxID 9JK7-ABC1XY")).toBe("9JK7ABC1XY");
    expect(normaliseTrxId("abc")).toBeNull();
    expect(normaliseTrxId("9JK7ABC1XY'; drop")).toBeNull();
  });
  it("normalises Bangladeshi bKash numbers", () => {
    expect(normaliseMsisdn("+880 1712-345678")).toBe("01712345678");
    expect(normaliseMsisdn("01712345678")).toBe("01712345678");
    expect(normaliseMsisdn("01212345678")).toBeNull();
    expect(normaliseMsisdn("12345")).toBeNull();
  });
  it("extends an active period from its end, otherwise from now", () => {
    const now = Date.parse("2026-10-17T00:00:00Z");
    expect(extendPeriod(null, "trialing", now)).toBe("2026-11-16T00:00:00.000Z");
    expect(extendPeriod("2026-10-27T00:00:00Z", "active", now)).toBe("2026-11-26T00:00:00.000Z");
    expect(extendPeriod("2026-10-01T00:00:00Z", "active", now)).toBe("2026-11-16T00:00:00.000Z");
  });
  it("turns paths on only when their env is complete", () => {
    expect(billingConfig({})).toEqual({ manual: null, checkout: false });
    expect(billingConfig({ BKASH_MANUAL_NUMBER: "01712345678" }).manual).toEqual({ number: "01712345678", accountType: "personal" });
    expect(billingConfig({ BKASH_MANUAL_NUMBER: "01712345678", PAYMENT_METHODS: "checkout" }).manual).toBeNull();
    const ck = { BKASH_APP_KEY: "a", BKASH_APP_SECRET: "b", BKASH_USERNAME: "c", BKASH_PASSWORD: "d" };
    expect(billingConfig(ck).checkout).toBe(true);
    expect(billingConfig({ ...ck, BKASH_PASSWORD: "" }).checkout).toBe(false);
  });
  it("limits admin pages to ADMIN_EMAILS", () => {
    const env = { ADMIN_EMAILS: "owner@example.com, Other@Example.com" };
    expect(isAdminEmail("OWNER@example.com", env)).toBe(true);
    expect(isAdminEmail("other@example.com", env)).toBe(true);
    expect(isAdminEmail("someone@example.com", env)).toBe(false);
    expect(isAdminEmail("owner@example.com", {})).toBe(false);
    expect(isAdminEmail(null, env)).toBe(false);
  });
  it("formats amounts for bKash", () => {
    expect(bkashAmount(19900)).toBe("199");
    expect(bkashAmount(19950)).toBe("199.50");
  });
});

describe("bKash Tokenized Checkout client", () => {
  beforeEach(() => _resetTokenCache());
  const creds = { baseUrl: "https://tokenized.sandbox.bka.sh/v1.2.0-beta", appKey: "APPKEY", appSecret: "SECRET", username: "user", password: "pass" };
  function recorder(replies: Record<string, unknown>) {
    const calls: { path: string; headers: Record<string, string>; body: Record<string, unknown> }[] = [];
    const f = (async (url: string, init: RequestInit) => {
      const path = url.replace(creds.baseUrl, "");
      calls.push({ path, headers: init.headers as Record<string, string>, body: JSON.parse(String(init.body)) });
      return new Response(JSON.stringify(replies[path] ?? {}), { status: 200 });
    }) as unknown as typeof fetch;
    return { calls, f };
  }

  it("grants a token once, then creates with the documented fields and headers", async () => {
    const { calls, f } = recorder({
      "/tokenized/checkout/token/grant": { statusCode: "0000", id_token: "TOKEN", expires_in: 3600, refresh_token: "R" },
      "/tokenized/checkout/create": { statusCode: "0000", paymentID: "PAY1", bkashURL: "https://sandbox.payment.bkash.com/redirect/tokenized/?paymentID=PAY1", transactionStatus: "Initiated" },
    });
    const c = new BkashClient(creds, f);
    const r = await c.createPayment({ amount: "199", invoice: "JS1", payerReference: "JS1", callbackURL: "https://app/cb" });
    await c.queryPayment("PAY1");
    expect(r.paymentID).toBe("PAY1");
    expect(calls.map((x) => x.path)).toEqual(["/tokenized/checkout/token/grant", "/tokenized/checkout/create", "/tokenized/checkout/payment/status"]);
    expect(calls[0].headers).toMatchObject({ username: "user", password: "pass" });
    expect(calls[0].body).toEqual({ app_key: "APPKEY", app_secret: "SECRET" });
    expect(calls[1].headers).toMatchObject({ Authorization: "TOKEN", "X-APP-Key": "APPKEY" });
    expect(calls[1].body).toMatchObject({ mode: "0011", amount: "199", currency: "BDT", intent: "sale", merchantInvoiceNumber: "JS1", callbackURL: "https://app/cb" });
  });

  it("fails clearly when bKash refuses", async () => {
    const { f } = recorder({ "/tokenized/checkout/token/grant": { statusCode: "2079", statusMessage: "Invalid app token" } });
    await expect(new BkashClient(creds, f).createPayment({ amount: "199", invoice: "x", payerReference: "x", callbackURL: "x" })).rejects.toBeInstanceOf(BkashError);
  });

  it("activates only a completed payment for the right amount and invoice", () => {
    const exp = { paymentID: "PAY1", amount: "199", invoice: "JS1" };
    const good = { paymentID: "PAY1", trxID: "TRX1", transactionStatus: "Completed", amount: "199", currency: "BDT", merchantInvoice: "JS1", statusCode: "0000" };
    expect(verifyCompleted(good, exp)).toEqual({ ok: true, trxID: "TRX1" });
    expect(verifyCompleted({ ...good, transactionStatus: "Initiated" }, exp).ok).toBe(false);
    expect(verifyCompleted({ ...good, amount: "1" }, exp).ok).toBe(false);
    expect(verifyCompleted({ ...good, merchantInvoice: "OTHER" }, exp).ok).toBe(false);
    expect(verifyCompleted({ ...good, paymentID: "PAY2" }, exp).ok).toBe(false);
    expect(verifyCompleted({ ...good, statusCode: "2056" }, exp).ok).toBe(false);
    expect(verifyCompleted({ ...good, trxID: undefined }, exp).ok).toBe(false);
  });
});
