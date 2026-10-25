// AI entry point: picks the provider from env and meters every call per user against the monthly cap.
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AnthropicProvider } from "./anthropic";
import { GeminiProvider } from "./gemini";
import { AIError, type AIFeature, type AIProvider, type AIUsage } from "./provider";

export * from "./provider";

let provider: AIProvider | null | undefined;
export function getProvider(): AIProvider | null {
  if (provider !== undefined) return provider;
  const which = (process.env.AI_PROVIDER || "anthropic").toLowerCase();
  if (which === "gemini" && process.env.GEMINI_API_KEY) provider = new GeminiProvider(process.env.GEMINI_API_KEY);
  else if (process.env.ANTHROPIC_API_KEY) provider = new AnthropicProvider(process.env.ANTHROPIC_API_KEY);
  else provider = null;
  return provider;
}
export const aiConfigured = () => getProvider() !== null;

/** At most this many AI calls per person in any 10 minutes (a CV build plus edits and a few packs fit easily). */
export const RATE_MAX_CALLS = 30, RATE_WINDOW_MS = 10 * 60_000;
/** Calls the daily jobs make for the person (capped there), never blocked by the per-person rate limit. */
const BACKGROUND = new Set<AIFeature>(["match_check", "alert_parse"]);

/** Monthly AI allowance for Pro users living outside Bangladesh: US$2. */
export const INTL_PRO_CAP_MICRO_USD = 2_000_000;

export interface Budget { spent: number; cap: number; plan: string; status: string; trialEndsAt: string | null; periodEnd?: string | null }

export async function getBudget(admin: SupabaseClient, userId: string): Promise<Budget | null> {
  const expired = await admin.rpc("expire_ai_reservations");
  if (expired.error) return null;
  const { data, error } = await admin.rpc("ai_budget", { p_user: userId });
  if (error || !data || !data[0]) return null;
  const r = data[0] as { spent_micro_usd: number; cap_micro_usd: number; plan_code: string; status: string; trial_ends_at: string | null; current_period_end?: string | null };
  let cap = Number(r.cap_micro_usd);
  // Pro outside Bangladesh pays more, so it gets twice the monthly AI allowance (owner decision 2026-10-21).
  if (r.plan_code === "pro") {
    const { data: prof } = await admin.from("profiles").select("home_country").eq("id", userId).maybeSingle();
    if (prof && prof.home_country !== "BD") cap = Math.max(cap, INTL_PRO_CAP_MICRO_USD);
  }
  return { spent: Number(r.spent_micro_usd), cap, plan: r.plan_code, status: r.status, trialEndsAt: r.trial_ends_at, periodEnd: r.current_period_end ?? null };
}

export function checkBudget(b: Budget | null, now = Date.now()) {
  if (!b) throw new AIError("over_cap", "no subscription");
  if (b.status === "trialing" && b.trialEndsAt && Date.parse(b.trialEndsAt) <= now) throw new AIError("trial_expired");
  if (b.status === "active" && b.periodEnd && Date.parse(b.periodEnd) <= now) throw new AIError("plan_expired");
  if (b.status === "expired" || b.status === "canceled" || b.status === "past_due") throw new AIError(b.plan === "pro" ? "plan_expired" : "trial_expired");
  if (b.spent >= b.cap) throw new AIError("over_cap");
}

/**
 * Run one metered AI call for a user. Refuses before calling when the user is over their monthly cap,
 * records usage afterwards (service role; users cannot write ai_usage).
 */
export async function runAI<T extends { usage: AIUsage }>(admin: SupabaseClient, userId: string, feature: AIFeature, fn: (p: AIProvider) => Promise<T>): Promise<T> {
  const p = getProvider();
  if (!p) throw new AIError("not_configured");
  const [budget, recent] = await Promise.all([
    getBudget(admin, userId),
    admin.from("ai_usage").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", new Date(Date.now() - RATE_WINDOW_MS).toISOString()),
  ]);
  if (recent.error) throw new AIError("upstream", "Could not verify rate allowance");
  checkBudget(budget);
  // A person working normally makes a few AI calls a minute; a script hammering the API is stopped here.
  if (!BACKGROUND.has(feature) && (recent.count ?? 0) >= RATE_MAX_CALLS) throw new AIError("rate_limited");
  const { data: reservation, error: reserveError } = await admin.rpc("reserve_ai_call", { p_user: userId, p_feature: feature, p_provider: p.name });
  if (reserveError || reservation == null) {
    const code = reserveError?.message;
    if (["over_cap", "trial_expired", "plan_expired", "rate_limited", "unresolved"].includes(code || "")) throw new AIError(code as "over_cap" | "trial_expired" | "plan_expired" | "rate_limited" | "unresolved");
    throw new AIError("upstream", "Could not reserve AI allowance");
  }
  let res: T;
  try { res = await fn(p); }
  catch (e) {
    // Explicit authentication/rate refusals did not generate content. Other errors may conceal billable work.
    if (e instanceof AIError && e.usage) {
      const { error } = await admin.from("ai_usage").update({ feature, model: e.usage.model, input_tokens: e.usage.inputTokens, output_tokens: e.usage.outputTokens, cost_micro_usd: e.usage.costMicroUsd, ok: false }).eq("id", reservation).eq("user_id", userId).eq("model", "__reserved__");
      if (error) console.error("AI failed usage reconciliation failed", reservation, error);
    } else if (e instanceof AIError && (e.code === "not_configured" || e.code === "rate_limited")) {
      const { error } = await admin.from("ai_usage").update({ feature, model: "__rejected__", cost_micro_usd: 0, ok: false }).eq("id", reservation).eq("user_id", userId).eq("model", "__reserved__");
      if (error) console.error("AI rejected reservation reconciliation failed", reservation, error);
    } else {
      // Keep an auditable failed attempt, but never hold the entire allowance forever.
      const { error } = await admin.from("ai_usage").update({ feature, model: "__failed_unknown__", cost_micro_usd: 0, ok: false }).eq("id", reservation).eq("user_id", userId).eq("model", "__reserved__");
      if (error) console.error("AI failure release pending expiry", reservation, error);
    }
    throw e;
  }
  const { data: settled, error } = await admin.from("ai_usage").update({
    feature, model: res.usage.model, input_tokens: res.usage.inputTokens, output_tokens: res.usage.outputTokens,
    cost_micro_usd: res.usage.costMicroUsd, ok: true,
  }).eq("id", reservation).eq("user_id", userId).eq("model", "__reserved__").select("id").maybeSingle();
  if (error || !settled) {
    console.error("AI usage settlement failed; keep reservation", reservation, error);
    throw new AIError("upstream", "Could not record AI usage");
  }
  return res;
}
