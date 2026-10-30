// Pro subscription payments via bKash. Server-only, service role for every write (users can only read their payments).
// Hard rule: Pro is activated only after verification - an admin checks a manual TrxID in the bKash merchant/personal
// statement, or the Tokenized Checkout payment is confirmed by querying bKash server-side. Never on the user's word.
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { BkashClient, BkashError, bkashCredentialsFromEnv, verifyCompleted, type BkashPaymentState } from "../billing/bkash";
import { billingConfig, bkashAmount, formatTaka, normaliseMsisdn, normaliseTrxId } from "../billing/manual";
import { paymentEmail } from "../email/templates";
import { emailProvider, sendEmail } from "../email/send";
import { publicEnv } from "../env";
import { formatPrice, packPrice, PAYABLE_CURRENCIES, type PackPrice } from "../billing/pricing";
import { createCreemCheckout, creemConfig, creemProductForPlan, parseEvent as parseCreemEvent, verifySignature as verifyCreemSignature } from "../billing/creem";

export interface PaymentRow {
  id: string; user_id: string; plan_code: string; method: "bkash_manual" | "bkash_checkout" | "lemonsqueezy" | "paddle" | "creem"; amount_minor: number; currency: string;
  trx_id: string | null; payer_msisdn: string | null; bkash_payment_id: string | null; invoice: string;
  status: "initiated" | "pending" | "approved" | "rejected" | "failed" | "canceled" | "refunded"; period_end: string | null; period_days: number;
  review_note: string | null; reviewed_by: string | null; reviewed_at: string | null; created_at: string;
}

export class PaymentError extends Error {}

const MAX_PENDING = 3;
const newInvoice = () => `JS${new Date().toISOString().slice(2, 10).replace(/-/g, "")}${randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`;

export async function proPlan(db: SupabaseClient): Promise<{ code: string; name: string; priceMinor: number }> {
  const { data } = await db.from("plans").select("code, name, price_minor").eq("code", "pro").maybeSingle();
  return { code: "pro", name: data?.name || "JobPao Pro", priceMinor: Number(data?.price_minor ?? packPrice("BD").minor) };
}

/** The price, and so the way to pay, follows the country the user lives in: Bangladesh pays with bKash, everyone else by card. */
export async function priceForUser(admin: SupabaseClient, userId: string, pack: unknown): Promise<PackPrice> {
  const { data, error } = await admin.from("profiles").select("home_country").eq("id", userId).maybeSingle();
  if (error) throw error;
  if (!data?.home_country) throw new PaymentError("Complete your subscription-country setup before purchasing.");
  return packPrice(data.home_country, pack);
}

async function bkashPrice(ctx: { admin: SupabaseClient; userId: string }, pack: unknown) {
  const price = await priceForUser(ctx.admin, ctx.userId, pack);
  if (!PAYABLE_CURRENCIES.includes(price.currency)) throw new PaymentError("bKash is for people living in Bangladesh. Outside Bangladesh, pay by card.");
  return price;
}

/** Manual path: the user paid with Send Money / Payment in their bKash app and gives us the TrxID. Stored as pending. */
export async function submitManualPayment(ctx: { admin: SupabaseClient; userId: string }, input: { trxId: string; msisdn: string; pack?: unknown }) {
  if (!billingConfig().manual) throw new PaymentError("Manual bKash payment is not available.");
  const trx = normaliseTrxId(input.trxId);
  if (!trx) throw new PaymentError("Enter the Transaction ID (TrxID) from your bKash SMS or app, for example 9JK7ABC1XY.");
  const msisdn = normaliseMsisdn(input.msisdn);
  if (!msisdn) throw new PaymentError("Enter the bKash number you paid from, for example 017XXXXXXXX.");
  const { count } = await ctx.admin.from("payments").select("id", { count: "exact", head: true }).eq("user_id", ctx.userId).eq("status", "pending");
  if ((count ?? 0) >= MAX_PENDING) throw new PaymentError("You already have payments waiting for review. We will email you once they are checked.");
  const price = await bkashPrice(ctx, input.pack);
  const { data, error } = await ctx.admin.from("payments").insert({
    user_id: ctx.userId, plan_code: "pro", method: "bkash_manual", amount_minor: price.minor, currency: "BDT",
    trx_id: trx, payer_msisdn: msisdn, invoice: newInvoice(), status: "pending", period_days: price.days,
  }).select("id").single();
  if (error) {
    if (error.code === "23505") throw new PaymentError("This Transaction ID has already been submitted. If you think this is wrong, contact support.");
    throw error;
  }
  return { id: data.id as string, status: "pending" as const };
}

export async function listPayments(admin: SupabaseClient, status: "pending" | "recent") {
  let q = admin.from("payments").select("*").order("created_at", { ascending: status === "pending" }).limit(100);
  q = status === "pending" ? q.eq("status", "pending") : q.neq("status", "pending").neq("status", "initiated");
  const { data, error } = await q;
  if (error) throw error;
  const rows = (data || []) as PaymentRow[];
  const ids = [...new Set(rows.map((r) => r.user_id))];
  const { data: people } = ids.length ? await admin.from("profiles").select("id, email, full_name").in("id", ids) : { data: [] };
  const who = new Map((people || []).map((p: { id: string; email: string | null; full_name: string | null }) => [p.id, p]));
  return rows.map((r) => ({ ...r, email: who.get(r.user_id)?.email ?? null, name: who.get(r.user_id)?.full_name ?? null }));
}

/** Atomic and replay-safe: a committed approval always includes its entitlement. */
async function settle(admin: SupabaseClient, id: string, method: string, from: string[], review: Record<string, unknown>, refund = false) {
  const { data, error } = await admin.rpc("settle_payment", { p_id: id, p_method: method, p_from: from, p_review: review, p_refund: refund });
  if (error) throw error; // fail closed if migration is unavailable; never use a two-step fallback
  return data as { changed: boolean; status: string; period_end: string | null };
}

async function notify(admin: SupabaseClient, userId: string, kind: "approved" | "rejected", info: { periodEnd?: string; trx: string | null; amountMinor: number; currency?: string; note?: string | null }) {
  if (!emailProvider()) return;
  const { data: prof } = await admin.from("profiles").select("email, full_name").eq("id", userId).maybeSingle();
  if (!prof?.email) return;
  const m = paymentEmail({ kind, name: prof.full_name || "", amount: info.currency && info.currency !== "BDT" ? formatPrice(info.amountMinor, info.currency) : formatTaka(info.amountMinor), trx: info.trx, periodEnd: info.periodEnd ?? null, note: info.note ?? null, link: `${publicEnv.appUrl}/upgrade` });
  await sendEmail({ to: prof.email, ...m }).catch((e) => console.error("payment email", e));
}

/** Admin decision on a manual payment. Approval is atomic: only a pending (or previously rejected) row can be approved, once. */
export async function reviewPayment(admin: SupabaseClient, input: { paymentId: string; approve: boolean; reviewer: string; note?: string }) {
  const note = (input.note || "").trim().slice(0, 500) || null;
  const now = new Date().toISOString();
  if (input.approve) {
    const { data: p, error } = await admin.from("payments").select("id, user_id, trx_id, amount_minor").eq("id", input.paymentId).eq("method", "bkash_manual").maybeSingle();
    if (error) throw error;
    if (!p) throw new PaymentError("Payment not found.");
    const result = await settle(admin, p.id, "bkash_manual", ["pending", "rejected"], { reviewed_by: input.reviewer, review_note: note });
    if (!result.changed) throw new PaymentError("This payment was already reviewed.");
    await notify(admin, p.user_id, "approved", { periodEnd: result.period_end!, trx: p.trx_id, amountMinor: p.amount_minor, note });
    return { status: result.status, periodEnd: result.period_end! };
  }
  const { data, error } = await admin.from("payments").update({ status: "rejected", reviewed_by: input.reviewer, reviewed_at: now, review_note: note })
    .eq("id", input.paymentId).eq("method", "bkash_manual").eq("status", "pending").select("user_id, trx_id, amount_minor").maybeSingle();
  if (error) throw error;
  if (!data) throw new PaymentError("This payment was already reviewed.");
  await notify(admin, data.user_id, "rejected", { trx: data.trx_id, amountMinor: data.amount_minor, note });
  return { status: "rejected" };
}

// ---------------------------------------------------------------------------
// Tokenized Checkout (merchant accounts)
// ---------------------------------------------------------------------------
function client() {
  const creds = bkashCredentialsFromEnv();
  if (!creds || !billingConfig().checkout) throw new PaymentError("bKash checkout is not available.");
  return new BkashClient(creds);
}

export async function startCheckout(ctx: { admin: SupabaseClient; userId: string }, pack?: unknown) {
  const bk = client();
  const price = await bkashPrice(ctx, pack);
  const invoice = newInvoice();
  const { data: row, error } = await ctx.admin.from("payments").insert({
    user_id: ctx.userId, plan_code: "pro", method: "bkash_checkout", amount_minor: price.minor, currency: "BDT", invoice, status: "initiated", period_days: price.days,
  }).select("id").single();
  if (error) throw error;
  try {
    const r = await bk.createPayment({
      amount: bkashAmount(price.minor), invoice, payerReference: invoice,
      callbackURL: `${publicEnv.appUrl}/api/billing/bkash/callback`,
    });
    await ctx.admin.from("payments").update({ bkash_payment_id: r.paymentID }).eq("id", row.id);
    return { url: r.bkashURL };
  } catch (e) {
    await ctx.admin.from("payments").update({ status: "failed", review_note: e instanceof Error ? e.message.slice(0, 300) : "create failed" }).eq("id", row.id);
    throw e instanceof BkashError ? new PaymentError("bKash could not start the payment. Try again in a minute.") : e;
  }
}

/** Strip anything we do not need from a bKash response before storing it (no tokens are ever in these). */
const keep = (q: BkashPaymentState) => ({ paymentID: q.paymentID, trxID: q.trxID, transactionStatus: q.transactionStatus, amount: q.amount, currency: q.currency, merchantInvoiceNumber: q.merchantInvoiceNumber ?? q.merchantInvoice, statusCode: q.statusCode, statusMessage: q.statusMessage });

/**
 * bKash redirects the customer to the callback with ?paymentID=..&status=success|failure|cancel.
 * On success we execute the payment, then QUERY bKash and activate only if the query confirms a Completed payment
 * for our amount and invoice. Safe to call twice: the payment row is claimed atomically.
 */
export async function completeCheckout(admin: SupabaseClient, paymentID: string, status: string): Promise<"success" | "failure" | "cancel" | "unknown"> {
  if (!paymentID) return "unknown";
  const { data: p } = await admin.from("payments").select("id, user_id, plan_code, amount_minor, invoice, status, method").eq("bkash_payment_id", paymentID).maybeSingle();
  if (!p || p.method !== "bkash_checkout") return "unknown";
  if (p.status === "approved") return "success";
  if (p.status !== "initiated") return "failure";
  const bk = client();
  if (status !== "success") {
    // The callback URL is public, so its status is only a hint: cancel only if bKash itself does not report the payment completed.
    const q0 = await bk.queryPayment(paymentID).catch(() => null);
    if (!q0) return "unknown";
    if (!verifyCompleted(q0, { paymentID, amount: bkashAmount(p.amount_minor), invoice: p.invoice }).ok) {
      if (!["Cancelled", "Canceled", "Failed"].includes(q0.transactionStatus || "")) return "unknown";
      await admin.from("payments").update({ status: status === "cancel" ? "canceled" : "failed" }).eq("id", p.id).eq("status", "initiated");
      return status === "cancel" ? "cancel" : "failure";
    }
  } else {
    try { await bk.executePayment(paymentID); } catch (e) { console.error("bkash execute", e); /* fall through to the query, which is authoritative */ }
  }
  const q = await bk.queryPayment(paymentID);
  const v = verifyCompleted(q, { paymentID, amount: bkashAmount(p.amount_minor), invoice: p.invoice });
  if (!v.ok) {
    // Pending outcomes stay reconcilable; do not discard a payment which may complete later.
    if (!["Cancelled", "Canceled", "Failed"].includes(q.transactionStatus || "")) return "unknown";
    await admin.from("payments").update({ status: "failed", provider_response: keep(q), review_note: v.reason }).eq("id", p.id).eq("status", "initiated");
    return "failure";
  }
  const result = await settle(admin, p.id, "bkash_checkout", ["initiated"], { trx_id: v.trxID, payer_msisdn: q.customerMsisdn ?? null, provider_response: keep(q), reviewed_by: "bkash-query" });
  if (result.status !== "approved") return "failure";
  if (result.changed) await notify(admin, p.user_id, "approved", { periodEnd: result.period_end!, trx: v.trxID, amountMinor: p.amount_minor });
  return "success";
}

// ---------------------------------------------------------------------------
// Card payments through Creem (everyone living outside Bangladesh)
// ---------------------------------------------------------------------------
/** True once Creem is configured; card payment stays closed until then. */
export const cardOpen = (): boolean => !!creemConfig();

export async function startCardCheckout(ctx: { admin: SupabaseClient; userId: string }, pack?: unknown, startNow?: unknown) {
  const cfg = creemConfig();
  if (!cfg) throw new PaymentError("Card payment is not open yet. Your trial features keep working until the trial ends.");
  // UK/EU consumer law: Pro may start inside the 14-day cancellation period only on the buyer's express request, and a
  // later cancellation then refunds the unused part. The tick is recorded with the payment (see /refund).
  if (startNow !== true) throw new PaymentError("Tick the box to start Pro straight away before paying.");
  const consentAt = new Date().toISOString();
  const price = await priceForUser(ctx.admin, ctx.userId, pack);
  if (PAYABLE_CURRENCIES.includes(price.currency)) throw new PaymentError("In Bangladesh, pay with bKash.");
  const usd = price.usd;
  const productId = creemProductForPlan(price.pack);
  if (!productId) throw new PaymentError("This plan is not available for international card checkout.");
  const plan = await proPlan(ctx.admin);
  const { data: prof } = await ctx.admin.from("profiles").select("email").eq("id", ctx.userId).maybeSingle();
  const { data: row, error } = await ctx.admin.from("payments").insert({
    user_id: ctx.userId, plan_code: plan.code, method: "creem", amount_minor: usd, currency: "USD", invoice: newInvoice(), status: "initiated", period_days: price.days,
    provider_response: { start_now_consent_at: consentAt },
  }).select("id").single();
  if (error) throw error;
  try {
    const co = await createCreemCheckout(cfg, { productId, paymentId: row.id, userId: ctx.userId, email: prof?.email ?? null, successUrl: `${publicEnv.appUrl}/upgrade?payment=card`, consentAt });
    // The webhook must name this exact checkout before Pro starts; on payment it is replaced by the order id.
    const { error: e2 } = await ctx.admin.from("payments").update({ provider_order_id: co.id }).eq("id", row.id);
    if (e2) throw e2;
    return { url: co.url };
  } catch (e) {
    console.error("creem checkout", e);
    await ctx.admin.from("payments").update({ status: "failed", review_note: e instanceof Error ? e.message.slice(0, 300) : "checkout failed" }).eq("id", row.id);
    throw new PaymentError("Card checkout could not start. Try again in a minute.");
  }
}

const TEST_MODES = ["test", "sandbox", "local"];

/**
 * Signed webhook from Creem. Pro starts only for a completed, paid checkout that we created for this payment (same
 * checkout id) in USD for at least our price (tax may be added on top). A full refund takes the days back.
 * Safe to receive twice: the row is claimed atomically.
 */
export async function handleCreemWebhook(admin: SupabaseClient, rawBody: string, signature: string | null): Promise<{ status: number; note: string }> {
  const cfg = creemConfig();
  if (!cfg) return { status: 503, note: "not configured" };
  if (!verifyCreemSignature(rawBody, signature, cfg.webhookSecret)) return { status: 401, note: "bad signature" };
  let body: unknown;
  try { body = JSON.parse(rawBody); } catch { return { status: 400, note: "bad json" }; }
  const ev = parseCreemEvent(body);
  if (ev && !cfg.test && TEST_MODES.includes(ev.mode)) return { status: 200, note: "test mode ignored" };
  if (ev?.kind === "refund") return handleCreemRefund(admin, ev);
  if (!ev || !ev.paymentId) return { status: 200, note: "ignored" };
  const { data: p } = await admin.from("payments").select("id, user_id, amount_minor, currency, period_days, status, method, provider_order_id").eq("id", ev.paymentId).maybeSingle();
  if (!p || p.method !== "creem") return { status: 200, note: "unknown payment" };
  if (p.status === "approved") return { status: 200, note: "already done" };
  if (p.provider_order_id !== ev.checkoutId) return { status: 200, note: "unknown payment" };
  if (ev.status !== "completed" || ev.orderStatus !== "paid" || !ev.orderId) return { status: 200, note: "not paid" };
  const expectedPlan = `${p.period_days}d`;
  if (!ev.productId || ev.productId !== creemProductForPlan(expectedPlan)) {
    console.error("creem product mismatch", p.id);
    return { status: 200, note: "product mismatch" };
  }
  if (ev.currency !== "USD" || !(ev.amount >= p.amount_minor)) {
    await admin.from("payments").update({ status: "failed", review_note: `amount mismatch: ${ev.currency} ${ev.amount} (order ${ev.orderId})` }).eq("id", p.id).eq("status", "initiated");
    return { status: 200, note: "amount mismatch" };
  }
  const result = await settle(admin, p.id, "creem", ["initiated"], { trx_id: ev.orderId, provider_order_id: ev.orderId, reviewed_by: "creem-webhook" });
  if (result.changed) await notify(admin, p.user_id, "approved", { periodEnd: result.period_end!, trx: ev.orderId, amountMinor: p.amount_minor, currency: "USD" });
  return { status: 200, note: result.changed ? "activated" : "already done" };
}

/** A full refund takes back the pack's days (once). Partial refunds are left to the admin. */
async function handleCreemRefund(admin: SupabaseClient, ev: { refundId: string; status: string; orderId: string | null; transactionStatus: string }): Promise<{ status: number; note: string }> {
  if (ev.status !== "succeeded") return { status: 200, note: "ignored" };
  if (!ev.orderId) { console.error("creem refund without order, check by hand", ev.refundId); return { status: 200, note: "no order" }; }
  const { data: p } = await admin.from("payments").select("id, method").eq("provider_order_id", ev.orderId).maybeSingle();
  if (!p || p.method !== "creem") return { status: 200, note: "not ours" };
  if (ev.transactionStatus !== "refunded") {
    // A pro-rata refund (UK/EU cancellation after day 7) ends Pro by hand on /admin/payments; leave a note there.
    console.error("creem partial refund, check by hand", ev.orderId);
    await admin.from("payments").update({ review_note: `partial refund ${ev.refundId}: end Pro by hand if the buyer cancelled` }).eq("id", p.id);
    return { status: 200, note: "partial refund" };
  }
  const result = await settle(admin, p.id, "creem", ["approved"], { provider_order_id: ev.orderId, reviewed_by: "creem-webhook", review_note: `refunded (${ev.refundId})` }, true);
  return { status: 200, note: result.changed ? "refunded" : "nothing to refund" };
}
