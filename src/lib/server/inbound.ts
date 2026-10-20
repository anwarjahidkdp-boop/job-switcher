// Inbound alert emails (forwarded by the user's own Gmail filter to <alias>@<domain>).
// Runs with the service role: the email belongs to the alias owner, and everything is stored under their user id.
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cc, PORTALS, rule } from "../countries";
import { todayStr } from "../dates";
import { jobToRow, normaliseJobText } from "../jobs";
import { ALERT_FILL_PROMPT, ALERT_PROMPT, SYSTEM_RULES } from "../prompts";
import { AlertFillSchema, AlertJobsSchema, type AlertFillOut, type AlertJobsOut } from "../ai/schemas";
import { dedupeJobs, jobUrl, looksLikeAlert, parseAlert, titleCompanyKey, unwrapUrl, type AlertJob } from "../inbound/alerts";
import { runAI } from "../ai";
import { AIError } from "../ai/provider";
import { detectGmailVerification } from "../inbound/gmail";
import { parseRawEmail } from "../inbound/parse";
import { loadProfile } from "./state";
import { refreshMatches } from "./matches";
import { safeUrl } from "./jobs";

export interface InboundInput { alias: string; raw: string; rawKey?: string | null }

const isIso = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
const appears = (v: string, text: string) => text.toLowerCase().replace(/\s+/g, " ").includes(v.toLowerCase().replace(/\s+/g, " "));

/** Merge AI-filled fields into the deterministic jobs: only null fields, and only values the email text contains. */
export function mergeFill(items: AlertJob[], fill: AlertFillOut, emailText: string): AlertJob[] {
  const out = items.map((j) => ({ ...j }));
  for (const f of fill.jobs || []) {
    const j = out[f.index];
    if (!j) continue;
    for (const k of ["title", "company", "location"] as const) {
      const v = (f[k] || "").trim();
      if (!j[k] && v && v.length <= 200 && appears(v, emailText)) j[k] = v;
    }
    if (!j.deadline && isIso(f.deadline)) j.deadline = f.deadline;
  }
  return dedupeJobs(out);
}

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
    await admin.from("forwarding_addresses").update({ gmail_verification_code: verification.code, gmail_verification_link: verification.link, gmail_code_received_at: new Date().toISOString() }).eq("id", fwd.id);
    const { data: pr } = await admin.from("profiles").select("setup_steps").eq("id", userId).maybeSingle();
    await admin.from("profiles").update({ setup_steps: { ...(pr?.setup_steps || {}), address: true } }).eq("id", userId);
    await done({ kind: "gmail_verification", status: "processed" });
    return { status: "verification" as const };
  }

  const profile = await loadProfile(admin, userId);
  const country = cc(profile?.target_country);
  const today = todayStr(rule(country).timeZone);

  // 1) Deterministic pass over the email itself (no AI, no page fetches).
  const det = parseAlert({ from: parsed.from, subject: parsed.subject, html: parsed.html, text: parsed.text, today });
  let items: AlertJob[] = det.jobs;
  let aiNote: string | null = null;

  // 2) AI only for what the code could not read: missing titles/companies (one batched call per email), or a
  //    whole-email fallback when the email looks like an alert but no job links were recognised.
  const needsFill = items.some((j) => !j.title || !j.company);
  const needsFull = !items.length && looksLikeAlert(parsed.subject, parsed.from, parsed.text);
  if (needsFill || needsFull) {
    try {
      if (needsFill) {
        const gaps = items.map((j, index) => ({ index, ...j }));
        const res = await runAI(admin, userId, "alert_parse", (p) => p.generateJSON({ tier: "fast", system: SYSTEM_RULES, prompt: ALERT_FILL_PROMPT(parsed.subject, parsed.from, parsed.text, gaps, today), schema: AlertFillSchema }));
        items = mergeFill(items, res.data as AlertFillOut, parsed.text);
      } else {
        const res = await runAI(admin, userId, "alert_parse", (p) => p.generateJSON({ tier: "fast", system: SYSTEM_RULES, prompt: ALERT_PROMPT(parsed.subject, parsed.from, parsed.text, parsed.links, country, today), schema: AlertJobsSchema }));
        const links = new Map(parsed.links.map((l) => [jobUrl(l)?.url ?? safeUrl(unwrapUrl(l)), l]));
        items = dedupeJobs(((res.data as AlertJobsOut).jobs || []).filter((j) => j.title && j.company).map((j) => {
          // Only keep a URL that really was in the email.
          const canon = j.url ? jobUrl(j.url)?.url ?? safeUrl(unwrapUrl(j.url)) : null;
          return { title: j.title, company: j.company, location: j.location, deadline: isIso(j.deadline) ? j.deadline : null, url: canon && links.has(canon) ? canon : "" };
        }));
      }
    } catch (e) {
      aiNote = e instanceof AIError ? e.code : String(e).slice(0, 300);
      if (!items.length) {
        // Keep the email for a retry once AI is available again.
        await done({ kind: "job_alert", status: "failed", error: aiNote });
        return { status: "failed" as const };
      }
    }
  }

  // 3) Store what the alert says, with its link. Duplicates: by URL (unique index) and by (title, company).
  const { data: recent } = await admin.from("jobs").select("title, company").eq("owner_id", userId).eq("source_kind", "email_alert").gte("created_at", new Date(Date.now() - 60 * 86_400_000).toISOString()).limit(1000);
  const known = new Set((recent || []).map((r: { title: string; company: string }) => titleCompanyKey(r)).filter(Boolean));
  const rows = items.filter((j) => j.title).slice(0, 50).flatMap((j) => {
    const key = titleCompanyKey(j);
    if (key && known.has(key)) return [];
    if (key) known.add(key);
    const url = j.url ? safeUrl(j.url) : null;
    const job = normaliseJobText({ title: j.title!.slice(0, 200), company: j.company || "Company not stated", text: [j.title, j.company, j.location].filter(Boolean).join("\n"), country, location: j.location, url, deadline: j.deadline, source: `${det.portal} alert email`, today });
    return [jobToRow(job, { owner_id: userId, source_kind: "email_alert", external_id: url, description: null, raw: { inbound_email_id: rec.id, portal: det.portal, alert: j } })];
  });
  let created = 0;
  for (const r of rows) {
    const { error } = r.url
      ? await admin.from("jobs").upsert(r, { onConflict: "owner_id,url", ignoreDuplicates: true })
      : await admin.from("jobs").insert(r);
    if (!error) created++;
  }
  await done({ kind: rows.length || det.jobLinkCount ? "job_alert" : "other", status: rows.length ? "processed" : "ignored", jobs_created: created, error: aiNote ? `ai fill skipped: ${aiNote}` : null });
  if (created && profile) {
    await admin.from("profiles").update({ setup_steps: { ...(profile.setup_steps || {}), alerts: true, address: true, forward: true, filter: true, test: true } }).eq("id", userId);
    await refreshMatches(admin, userId).catch(() => 0);
  }
  return { status: "processed" as const, created };
}

export const portalsFor = (country: string) => PORTALS[cc(country)];
