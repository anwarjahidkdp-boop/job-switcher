// Pro subscription payments via bKash. Server-only, service role for every write (users can only read their payments).
// Hard rule: Pro is activated only after verification - an admin checks a manual TrxID in the bKash merchant/personal
// statement, or the Tokenized Checkout payment is confirmed by querying bKash server-side. Never on the user's word.
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { BkashClient, BkashError, bkashCredentialsFromEnv, verifyCompleted, type BkashPaymentState } from "../billing/bkash";
import { billingConfig, bkashAmount, extendPeriod, formatTaka, normaliseMsisdn, normaliseTrxId, PERIOD_DAYS } from "../billing/manual";
import { paymentEmail } from "../email/templates";
import { emailProvider, sendEmail } from "../email/send";
import { publicEnv } from "../env";
import { cardUsd, formatPrice, PAYABLE_CURRENCIES, proPrice, type Price } from "../billing/pricing";
import { createLemonCheckout, lemonConfig, parseOrderEvent, verifySignature } from "../billing/lemonsqueezy";

export interface PaymentRow {
  id: string; user_id: string; plan_code: string; method: "bkash_manual" | "bkash_checkout" | "lemonsqueezy"; amount_minor: number; currency: string;
  trx_id: string | null; payer_msisdn: string | null; bkash_payment_id: string | null; invoice: string;
  status: "initiated" | "pending" | "approved" | "rejected" | "failed" | "canceled"; period_end: string | null;
  review_note: string | null; reviewed_by: string | null; reviewed_at: string | null; created_at: string;
}

export class PaymentError extends Error {}

const MAX_PENDING = 3;
const newInvoice = () => `JS${new Date().toISOString().slice(2, 10).replace(/-/g, "")}${randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`;

export async function proPlan(db: SupabaseClient): Promise<{ code: string; name: string; priceMinor: number }> {
  const { data } = await db.from("plans").select("code, name, price_minor").eq("code", "pro").maybeSingle();
  return { code: "pro", name: data?.name || "JobPao Pro", priceMinor: Number(data?.price_minor ?? 19000) };
}

/** Pro price for the country the user wants to work in (plan_prices, falling back to the built-in table). */
export async function proPriceFor(db: SupabaseClient, country: unknown): Promise<Price> {
  const fallback = proPrice(country);
  const { data } = await db.from("plan_prices").select("currency, price_minor").eq("plan_code", "pro").eq("country", fallback.country).maybeSingle();
  return data ? { country: fallback.country, currency: String(data.currency), minor: Number(data.price_minor) } : fallback;
}

/** The price, and so the way to pay, follows the target country: Bangladesh pays with bKash, everyone else by card. */
export async function priceForUser(admin: SupabaseClient, userId: string): Promise<Price> {
  const { data } = await admin.from("profiles").select("target_country").eq("id", userId).maybeSingle();
  return proPriceFor(admin, data?.target_country);
}

async function assertBkashPrice(ctx: { admin: SupabaseClient; userId: string }) {
  const price = await priceForUser(ctx.admin, ctx.userId);
  if (!PAYABLE_CURRENCIES.includes(price.currency)) throw new PaymentError("bKash is for jobs in Bangladesh. For other countries, pay by card.");
}

/** Manual path: the user paid with Send Money / Payment in their bKash app and gives us the TrxID. Stored as pending. */
export async function submitManualPayment(ctx: { admin: SupabaseClient; userId: string }, input: { trxId: string; msisdn: string }) {
  if (!billingConfig().manual) throw new PaymentError("Manual bKash payment is not available.");
  const trx = normaliseTrxId(input.trxId);
  if (!trx) throw new PaymentError("Enter the Transaction ID (TrxID) from your bKash SMS or app, for example 9JK7ABC1XY.");
  const msisdn = normaliseMsisdn(input.msisdn);
  if (!msisdn) throw new PaymentError("Enter the bKash number you paid from, for example 017XXXXXXXX.");
  const { count } = await ctx.admin.from("payments").select("id", { count: "exact", head: true }).eq("user_id", ctx.userId).eq("status", "pending");
  if ((count ?? 0) >= MAX_PENDING) throw new PaymentError("You already have payments waiting for review. We will email you once they are checked.");
  await assertBkashPrice(ctx);
  const plan = await proPlan(ctx.admin);
  const { data, error } = await ctx.admin.from("payments").insert({
    user_id: ctx.userId, plan_code: plan.code, method: "bkash_manual", amount_minor: plan.priceMinor, currency: "BDT",
    trx_id: trx, payer_msisdn: msisdn, invoice: newInvoice(), status: "pending", period_days: PERIOD_DAYS,
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

/** Extend the user's Pro period by 30 days and record it on the payment. */
async function activate(admin: SupabaseClient, p: Pick<PaymentRow, "id" | "user_id" | "plan_code" | "trx_id" | "method">) {
  const { data: sub } = await admin.from("subscriptions").select("status, current_period_end").eq("user_id", p.user_id).maybeSingle();
  const periodEnd = extendPeriod(sub?.current_period_end, sub?.status);
  const { error } = await admin.from("subscriptions").update({
    plan_code: p.plan_code, status: "active", current_period_end: periodEnd, payment_provider: p.method === "lemonsqueezy" ? "lemonsqueezy" : p.method === "bkash_checkout" ? "bkash_checkout" : "bkash", payment_ref: p.trx_id,
  }).eq("user_id", p.user_id);
  if (error) throw error;
  await admin.from("payments").update({ period_end: periodEnd }).eq("id", p.id);
  return periodEnd;
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
  const from = input.approve ? ["pending", "rejected"] : ["pending"];
  const { data, error } = await admin.from("payments")
    .update({ status: input.approve ? "approved" : "rejected", reviewed_by: input.reviewer, reviewed_at: now, review_note: note })
    .eq("id", input.paymentId).eq("method", "bkash_manual").in("status", from)
    .select("id, user_id, plan_code, trx_id, method, amount_minor, status").maybeSingle();
  if (error) throw error;
  if (!data) throw new PaymentError("This payment was already reviewed.");
  let periodEnd: string | undefined;
  if (input.approve) {
    try {
      periodEnd = await activate(admin, data as PaymentRow);
    } catch (e) {
      // Put the row back so the admin can retry; never leave a payment approved without the subscription extended.
      await admin.from("payments").update({ status: "pending", reviewed_by: null, reviewed_at: null }).eq("id", data.id);
      throw e;
    }
  }
  await notify(admin, data.user_id, input.approve ? "approved" : "rejected", { periodEnd, trx: data.trx_id, amountMinor: data.amount_minor, note });
  return { status: data.status as string, periodEnd };
}

// ---------------------------------------------------------------------------
// Tokenized Checkout (merchant accounts)
// ---------------------------------------------------------------------------
function client() {
  const creds = bkashCredentialsFromEnv();
  if (!creds || !billingConfig().checkout) throw new PaymentError("bKash checkout is not available.");
  return new BkashClient(creds);
}

export async function startCheckout(ctx: { admin: SupabaseClient; userId: string }) {
  const bk = client();
  await assertBkashPrice(ctx);
  const plan = await proPlan(ctx.admin);
  const invoice = newInvoice();
  const { data: row, error } = await ctx.admin.from("payments").insert({
    user_id: ctx.userId, plan_code: plan.code, method: "bkash_checkout", amount_minor: plan.priceMinor, currency: "BDT", invoice, status: "initiated", period_days: PERIOD_DAYS,
  }).select("id").single();
  if (error) throw error;
  try {
    const r = await bk.createPayment({
      amount: bkashAmount(plan.priceMinor), invoice, payerReference: invoice,
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
  if (status !== "success") {
    await admin.from("payments").update({ status: status === "cancel" ? "canceled" : "failed" }).eq("id", p.id).eq("status", "initiated");
    return status === "cancel" ? "cancel" : "failure";
  }
  const bk = client();
  try { await bk.executePayment(paymentID); } catch (e) { console.error("bkash execute", e); /* fall through to the query, which is authoritative */ }
  const q = await bk.queryPayment(paymentID);
  const v = verifyCompleted(q, { paymentID, amount: bkashAmount(p.amount_minor), invoice: p.invoice });
  if (!v.ok) {
    // TODO(bkash): an "Initiated"/"Pending" execute can complete later; a scheduled re-query would recover those.
    await admin.from("payments").update({ status: "failed", provider_response: keep(q), review_note: v.reason }).eq("id", p.id).eq("status", "initiated");
    return "failure";
  }
  const { data: claimed, error } = await admin.from("payments").update({ status: "approved", trx_id: v.trxID, payer_msisdn: q.customerMsisdn ?? null, provider_response: keep(q), reviewed_by: "bkash-query", reviewed_at: new Date().toISOString() })
    .eq("id", p.id).eq("status", "initiated").select("id, user_id, plan_code, trx_id, method").maybeSingle();
  if (error) throw error;
  if (!claimed) return "success"; // another request finished it first
  const periodEnd = await activate(admin, claimed as PaymentRow);
  await notify(admin, p.user_id, "approved", { periodEnd, trx: v.trxID, amountMinor: p.amount_minor });
  return "success";
}

// ---------------------------------------------------------------------------
// Card payments through Lemon Squeezy (every target country except Bangladesh)
// ---------------------------------------------------------------------------
export async function startCardCheckout(ctx: { admin: SupabaseClient; userId: string }) {
  const cfg = lemonConfig();
  if (!cfg) throw new PaymentError("Card payment is not open yet. Your trial features keep working until the trial ends.");
  const price = await priceForUser(ctx.admin, ctx.userId);
  if (PAYABLE_CURRENCIES.includes(price.currency)) throw new PaymentError("For jobs in Bangladesh, pay with bKash.");
  const usd = cardUsd(price.country);
  const plan = await proPlan(ctx.admin);
  const { data: prof } = await ctx.admin.from("profiles").select("email").eq("id", ctx.userId).maybeSingle();
  const { data: row, error } = await ctx.admin.from("payments").insert({
    user_id: ctx.userId, plan_code: plan.code, method: "lemonsqueezy", amount_minor: usd, currency: "USD", invoice: newInvoice(), status: "initiated", period_days: PERIOD_DAYS,
  }).select("id").single();
  if (error) throw error;
  try {
    const url = await createLemonCheckout(cfg, { priceMinor: usd, paymentId: row.id, userId: ctx.userId, email: prof?.email ?? null, redirectUrl: `${publicEnv.appUrl}/upgrade?payment=card`, label: `${plan.name}, ${PERIOD_DAYS} days` });
    return { url };
  } catch (e) {
    console.error("lemonsqueezy checkout", e);
    await ctx.admin.from("payments").update({ status: "failed", review_note: e instanceof Error ? e.message.slice(0, 300) : "checkout failed" }).eq("id", row.id);
    throw new PaymentError("Card checkout could not start. Try again in a minute.");
  }
}

/**
 * Signed webhook from Lemon Squeezy. Pro starts only for a paid order_created event from our store whose payment id,
 * currency and amount match a card payment we started. Safe to receive twice: the row is claimed atomically.
 */
export async function handleLemonWebhook(admin: SupabaseClient, rawBody: string, signature: string | null): Promise<{ status: number; note: string }> {
  const cfg = lemonConfig();
  if (!cfg) return { status: 503, note: "not configured" };
  if (!verifySignature(rawBody, signature, cfg.webhookSecret)) return { status: 401, note: "bad signature" };
  let body: unknown;
  try { body = JSON.parse(rawBody); } catch { return { status: 400, note: "bad json" }; }
  const ev = parseOrderEvent(body);
  if (!ev || ev.event !== "order_created") return { status: 200, note: "ignored" };
  if (ev.storeId !== cfg.storeId || !ev.paymentId || ev.status !== "paid") return { status: 200, note: "not ours or not paid" };
  const { data: p } = await admin.from("payments").select("id, user_id, plan_code, amount_minor, currency, status, method").eq("id", ev.paymentId).maybeSingle();
  if (!p || p.method !== "lemonsqueezy") return { status: 200, note: "unknown payment" };
  if (p.status === "approved") return { status: 200, note: "already done" };
  if (ev.currency !== "USD" || ev.subtotal !== p.amount_minor) {
    await admin.from("payments").update({ status: "failed", review_note: `amount mismatch: ${ev.currency} ${ev.subtotal}`, provider_order_id: ev.orderId }).eq("id", p.id).eq("status", "initiated");
    return { status: 200, note: "amount mismatch" };
  }
  const { data: claimed, error } = await admin.from("payments").update({ status: "approved", trx_id: `LS-${ev.orderId}`, provider_order_id: ev.orderId, reviewed_by: "lemonsqueezy-webhook", reviewed_at: new Date().toISOString() })
    .eq("id", p.id).eq("status", "initiated").select("id, user_id, plan_code, trx_id, method").maybeSingle();
  if (error) throw error;
  if (!claimed) return { status: 200, note: "already done" };
  const periodEnd = await activate(admin, claimed as PaymentRow);
  await notify(admin, p.user_id, "approved", { periodEnd, trx: `LS-${ev.orderId}`, amountMinor: p.amount_minor, currency: "USD" });
  return { status: 200, note: "activated" };
}
