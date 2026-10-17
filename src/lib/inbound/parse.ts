// Parse a raw RFC 822 message (as received by the Cloudflare Email Worker) into the parts we use.
import PostalMime from "postal-mime";
import { stripHtml } from "../jobs";

export interface ParsedEmail {
  from: string;
  subject: string;
  messageId: string | null;
  text: string;
  /** HTML body (capped), for the deterministic alert parser. */
  html: string;
  links: string[];
  authResults: string | null;
}

export async function parseRawEmail(raw: string | Uint8Array | ArrayBuffer): Promise<ParsedEmail> {
  const email = await PostalMime.parse(raw);
  const html = email.html || "";
  const text = (email.text && email.text.trim()) || stripHtml(html);
  const links = [...new Set([...(html.match(/href\s*=\s*"(https?:\/\/[^"]+)"/gi) || []).map((h) => h.replace(/^href\s*=\s*"/i, "").replace(/"$/, "")), ...(text.match(/https?:\/\/[^\s<>")]+/g) || [])])]
    .map((u) => u.replace(/&amp;/g, "&"))
    .filter((u) => !/unsubscribe|privacy|preferences|settings|facebook\.com|twitter\.com|instagram\.com|youtube\.com/i.test(u));
  const header = (k: string) => email.headers.find((h) => h.key.toLowerCase() === k)?.value ?? null;
  return {
    from: email.from?.address ? `${email.from.name || ""} <${email.from.address}>`.trim() : header("from") || "",
    subject: email.subject || "",
    messageId: email.messageId || header("message-id"),
    text: text.slice(0, 60000),
    html: html.slice(0, 400000),
    links: links.slice(0, 200),
    authResults: header("authentication-results"),
  };
}

/** Alias from an address like "rahim-3f9a1c@jobs.example.com". */
export function aliasFrom(address: string, domain: string): string | null {
  const m = address.toLowerCase().trim().match(/^([a-z0-9][a-z0-9-]{3,40})@(.+)$/);
  if (!m) return null;
  if (domain && m[2] !== domain.toLowerCase()) return null;
  return m[1];
}
