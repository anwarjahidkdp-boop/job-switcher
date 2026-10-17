// "Send from my Gmail": Google OAuth with the gmail.send scope only (we can send, never read the mailbox),
// and sending one application when the user presses Apply. Nothing is ever sent without that press.
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { publicEnv } from "../env";
import { openToken, sealToken } from "../gmail/crypto";
import { base64url, buildMime, cleanAddress, fromHeader } from "../gmail/mime";
import { cvDocHtml, safeFileName } from "../cv/doc";
import { esc } from "../cv/render";
import { loadState } from "./state";
import type { Ctx } from "./applications";

export const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.send";
const SCOPES = ["openid", "email", GMAIL_SCOPE].join(" ");

export function gmailConfigured(): boolean {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GMAIL_TOKEN_KEY);
}
const redirectUri = () => `${publicEnv.appUrl.replace(/\/$/, "")}/api/gmail/callback`;

export function authUrl(state: string, loginHint?: string | null): string {
  const q = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!, redirect_uri: redirectUri(), response_type: "code", scope: SCOPES,
    access_type: "offline", prompt: "consent", include_granted_scopes: "false", state,
  });
  if (loginHint) q.set("login_hint", loginHint);
  return "https://accounts.google.com/o/oauth2/v2/auth?" + q;
}

async function tokenRequest(body: Record<string, string>) {
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!, ...body }),
  });
  const j = (await r.json().catch(() => ({}))) as Record<string, string>;
  if (!r.ok) throw new GmailError(j.error === "invalid_grant" ? "reconnect" : "google", j.error_description || j.error || `Google returned ${r.status}`);
  return j;
}

export class GmailError extends Error {
  constructor(public code: "reconnect" | "google" | "not_connected", message: string) { super(message); }
}

/** Finish the OAuth flow: store the encrypted refresh token and the Gmail address it belongs to. */
export async function connectGmail(admin: SupabaseClient, userId: string, code: string): Promise<string> {
  const t = await tokenRequest({ code, grant_type: "authorization_code", redirect_uri: redirectUri() });
  if (!String(t.scope || "").split(" ").includes(GMAIL_SCOPE)) throw new GmailError("google", "Permission to send email was not given. Tick the box to send email on your behalf and try again.");
  if (!t.refresh_token) throw new GmailError("google", "Google did not return a long-lived token. Try connecting again.");
  const info = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: `Bearer ${t.access_token}` } }).then((r) => r.json() as Promise<{ email?: string; email_verified?: boolean }>);
  if (!info.email || info.email_verified === false) throw new GmailError("google", "Could not read your Gmail address.");
  const sealed = await sealToken(t.refresh_token, process.env.GMAIL_TOKEN_KEY!, userId);
  const { error } = await admin.from("gmail_connections").upsert({ user_id: userId, google_email: info.email, refresh_token_enc: sealed, scope: t.scope, connected_at: new Date().toISOString() });
  if (error) throw error;
  return info.email;
}

export async function gmailAccount(admin: SupabaseClient, userId: string): Promise<string | null> {
  if (!gmailConfigured()) return null;
  const { data } = await admin.from("gmail_connections").select("google_email").eq("user_id", userId).maybeSingle();
  return data?.google_email ?? null;
}

export async function disconnectGmail(admin: SupabaseClient, userId: string) {
  const { data } = await admin.from("gmail_connections").select("refresh_token_enc").eq("user_id", userId).maybeSingle();
  if (data && gmailConfigured()) {
    try {
      const token = await openToken(data.refresh_token_enc, process.env.GMAIL_TOKEN_KEY!, userId);
      await fetch("https://oauth2.googleapis.com/revoke", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ token }) });
    } catch { /* still remove our copy */ }
  }
  await admin.from("gmail_connections").delete().eq("user_id", userId);
}

function coverLetterDoc(name: string, letter: string): string {
  const paras = letter.split(/\n{2,}/).map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`).join("");
  return `<html><head><meta charset="utf-8"><title>${esc(name)} – Cover letter</title><style>body{font-family:Calibri,Arial,sans-serif;font-size:11pt;line-height:1.45}p{margin:0 0 10pt}</style></head><body>${paras}</body></html>`;
}

/** The user pressed Apply: send the prepared application from their Gmail, then record it as applied. */
export async function sendApplication(ctx: Ctx, jobId: string): Promise<{ to: string; from: string }> {
  if (!gmailConfigured()) throw new GmailError("not_connected", "Sending from Gmail is not set up on this server yet.");
  const { data: conn } = await ctx.admin.from("gmail_connections").select("google_email, refresh_token_enc").eq("user_id", ctx.userId).maybeSingle();
  if (!conn) throw new GmailError("not_connected", "Connect your Gmail first.");

  const st = await loadState(ctx.db, ctx.userId);
  const app = st?.apps[jobId];
  if (!st?.master || !app?.pack) throw new Error("Prepare the application first.");
  if (["applied", "interview", "offer", "closed", "withdrawn"].includes(app.status)) throw new Error("This application was already sent.");
  const { data: job } = await ctx.db.from("jobs").select("company, title, apply_method, apply_target, deadline").eq("id", jobId).maybeSingle();
  if (!job || job.apply_method !== "email" || !job.apply_target) throw new Error("This job does not take applications by email. Apply on the employer's page instead.");
  if (job.deadline && job.deadline < st.today) throw new Error("The deadline for this job has passed.");
  const to = cleanAddress(job.apply_target);

  let photoUrl: string | null = null;
  if (st.profile.photo_path) {
    const { data } = await ctx.db.storage.from("cv-files").download(st.profile.photo_path);
    if (data) photoUrl = "data:image/jpeg;base64," + Buffer.from(await data.arrayBuffer()).toString("base64");
  }
  const master = st.master.content;
  const cv = cvDocHtml({ master, tailored: app.pack, country: st.country, homeCountry: st.homeCountry, style: st.profile.cv_style, personal: st.profile.personal, photoUrl });
  const base = safeFileName(master.name) + (job.company ? "-" + safeFileName(job.company) : "");
  const raw = buildMime({
    from: fromHeader(master.name, conn.google_email), to, subject: app.pack.email_subject, text: app.pack.email_body,
    attachments: [
      { filename: `${base}-CV.doc`, contentType: "application/msword", content: cv },
      ...(app.pack.cover_letter ? [{ filename: `${base}-Cover-Letter.doc`, contentType: "application/msword", content: coverLetterDoc(master.name, app.pack.cover_letter) }] : []),
    ],
  });

  let refresh: string;
  try { refresh = await openToken(conn.refresh_token_enc, process.env.GMAIL_TOKEN_KEY!, ctx.userId); }
  catch { throw new GmailError("reconnect", "Please connect your Gmail again."); }
  const t = await tokenRequest({ refresh_token: refresh, grant_type: "refresh_token" });
  const r = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST", headers: { Authorization: `Bearer ${t.access_token}`, "Content-Type": "application/json" }, body: JSON.stringify({ raw: base64url(raw) }),
  });
  const sent = (await r.json().catch(() => ({}))) as { id?: string; error?: { message?: string } };
  if (!r.ok || !sent.id) {
    if (r.status === 401 || r.status === 403) throw new GmailError("reconnect", "Gmail refused to send. Please connect your Gmail again.");
    throw new GmailError("google", "Gmail could not send the email: " + (sent.error?.message || `error ${r.status}`));
  }

  // Gmail accepted the message (it has an id), so the application really went out. The user's own session records it.
  await ctx.admin.from("gmail_connections").update({ last_sent_at: new Date().toISOString() }).eq("user_id", ctx.userId);
  const { error } = await ctx.db.from("applications").update({ status: "applied" }).eq("id", app.id);
  if (error) throw error;
  await ctx.db.from("reminders").delete().eq("application_id", app.id).is("sent_at", null);
  await ctx.db.from("application_events").insert({ application_id: app.id, user_id: ctx.userId, event: `Sent from ${conn.google_email} to ${to} (Gmail message ${sent.id})`, status: "applied", actor: "user" });
  return { to, from: conn.google_email };
}
