// Inbound alert emails (forwarded by the user's own Gmail filter to <alias>@<domain>).
// Runs with the service role: the email belongs to the alias owner, and everything is stored under their user id.
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cc, PORTALS, rule } from "../countries";
import { todayStr } from "../dates";
import { aiJobToJob, jobToRow } from "../jobs";
import { ALERT_PROMPT, SYSTEM_RULES } from "../prompts";
import { AlertJobsSchema, type AlertJobsOut } from "../ai/schemas";
import { runAI } from "../ai";
import { AIError } from "../ai/provider";
import { detectGmailVerification } from "../inbound/gmail";
import { parseRawEmail } from "../inbound/parse";
import { loadProfile } from "./state";
import { refreshMatches } from "./matches";
import { safeUrl } from "./jobs";

export interface InboundInput { alias: string; raw: string; rawKey?: string | null }

const PORTAL_HINTS: [string, RegExp][] = [["Bdjobs", /bdjobs/i], ["LinkedIn", /linkedin/i], ["Bayt", /bayt/i], ["GulfTalent", /gulftalent/i], ["Naukrigulf", /naukrigulf/i], ["JobStreet", /jobstreet/i], ["Indeed", /indeed/i], ["Reed", /reed\.co/i], ["SEEK", /seek\.com/i], ["Job Bank", /jobbank/i]];
export const portalOf = (from: string) => PORTAL_HINTS.find(([, re]) => re.test(from))?.[0] || "Job alert";

export async function processInbound(admin: SupabaseClient, input: InboundInput) {
  const alias = input.alias.toLowerCase();
  const { data: fwd } = await admin.from("forwarding_addresses").select("id, user_id, active, emails_received").eq("alias", alias).maybeSingle();
  const parsed = await parseRawEmail(input.raw);
  const base = { alias, message_id: parsed.messageId, from_address: parsed.from.slice(0, 300), subject: parsed.subject.slice(0, 500), raw_storage_key: input.rawKey ?? null };
  if (!fwd || !fwd.active) {
    await admin.from("inbound_emails").insert({ ...base, status: "rejected", error: "unknown or inactive alias" });
    return { status: "rejected" as const };
  }
  const userId = fwd.user_id as string;
  const { data: rec, error: insErr } = await admin.from("inbound_emails").insert({ ...base, user_id: userId, status: "received" }).select("id").single();
  if (insErr) {
    if (insErr.code === "23505") return { status: "duplicate" as const };
    throw insErr;
  }
  await admin.from("forwarding_addresses").update({ last_email_at: new Date().toISOString(), emails_received: (fwd.emails_received || 0) + 1 }).eq("id", fwd.id);
  const done = (patch: Record<string, unknown>) => admin.from("inbound_emails").update({ ...patch, processed_at: new Date().toISOString() }).eq("id", rec.id);

  const verification = detectGmailVerification(parsed);
  if (verification) {
    await admin.from("forwarding_addresses").update({ gmail_verification_code: verification.code, gmail_code_received_at: new Date().toISOString() }).eq("id", fwd.id);
    await done({ kind: "gmail_verification", status: "processed" });
    return { status: "verification" as const };
  }

  const profile = await loadProfile(admin, userId);
  const country = cc(profile?.target_country);
  const today = todayStr(rule(country).timeZone);
  const portal = portalOf(parsed.from + " " + parsed.subject);
  let out: AlertJobsOut;
  try {
    const res = await runAI(admin, userId, "alert_parse", (p) => p.generateJSON({ tier: "fast", system: SYSTEM_RULES, prompt: ALERT_PROMPT(parsed.subject, parsed.from, parsed.text, parsed.links, country, today), schema: AlertJobsSchema }));
    out = res.data as AlertJobsOut;
  } catch (e) {
    // Keep the email for a retry once AI is available again.
    await done({ kind: "job_alert", status: "failed", error: e instanceof AIError ? e.code : String(e).slice(0, 300) });
    return { status: "failed" as const };
  }
  const links = new Set(parsed.links);
  const rows = (out.jobs || []).filter((j) => j.title && j.company).slice(0, 50).map((j) => {
    // Only keep a URL that really was in the email.
    const url = j.url && links.has(j.url) ? safeUrl(j.url) : null;
    const job = aiJobToJob(j, { country, source: `${portal} alert email`, url, today });
    return jobToRow(job, { owner_id: userId, source_kind: "email_alert", external_id: url, description: null, raw: { inbound_email_id: rec.id } });
  });
  let created = 0;
  for (const r of rows) {
    const { error } = r.url
      ? await admin.from("jobs").upsert(r, { onConflict: "owner_id,url", ignoreDuplicates: true })
      : await admin.from("jobs").insert(r);
    if (!error) created++;
  }
  await done({ kind: rows.length ? "job_alert" : "other", status: rows.length ? "processed" : "ignored", jobs_created: created });
  if (created && profile) {
    await admin.from("profiles").update({ setup_steps: { ...(profile.setup_steps || {}), test: true } }).eq("id", userId);
    await refreshMatches(admin, userId).catch(() => 0);
  }
  return { status: "processed" as const, created };
}

export const portalsFor = (country: string) => PORTALS[cc(country)];
