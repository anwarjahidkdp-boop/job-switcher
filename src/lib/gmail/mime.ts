// Builds the RFC 2822 message the Gmail API sends (users.messages.send takes it base64url-encoded in "raw").
// Pure and dependency-free so it runs on Workers and in tests.

export interface Attachment { filename: string; contentType: string; content: string | Uint8Array }
export interface Mail { from: string; to: string; subject: string; text: string; attachments?: Attachment[]; boundary?: string }

const enc = new TextEncoder();
const bytes = (v: string | Uint8Array) => (typeof v === "string" ? enc.encode(v) : v);

export function base64(v: string | Uint8Array): string {
  const b = bytes(v);
  let s = "";
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
}
export const base64url = (v: string | Uint8Array) => base64(v).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/** RFC 2047 encoded-word when the header has non-ASCII text (names, Bangla subjects). */
export function encodeHeader(v: string): string {
  const clean = v.replace(/[\r\n]+/g, " ").trim();
  return /^[\x20-\x7e]*$/.test(clean) ? clean : `=?UTF-8?B?${base64(clean)}?=`;
}

/** One plain address; rejects anything that could smuggle extra headers or recipients. */
export function cleanAddress(v: string): string {
  const a = String(v || "").trim();
  if (!/^[^\s@<>,;"]+@[^\s@<>,;"]+\.[^\s@<>,;"]+$/.test(a)) throw new Error("This job has no valid application email address.");
  return a;
}

const wrap76 = (s: string) => s.replace(/.{1,76}/g, "$&\r\n").trimEnd();
const quoteName = (n: string) => n.replace(/["\\\r\n]/g, "");

export function buildMime(m: Mail): string {
  const boundary = m.boundary || "js_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
  const head = [
    `From: ${m.from}`,
    `To: ${cleanAddress(m.to)}`,
    `Subject: ${encodeHeader(m.subject)}`,
    "MIME-Version: 1.0",
  ];
  const textPart = ["Content-Type: text/plain; charset=UTF-8", "Content-Transfer-Encoding: base64", "", wrap76(base64(m.text.replace(/\r?\n/g, "\r\n")))].join("\r\n");
  if (!m.attachments?.length) return [...head, textPart].join("\r\n");
  const parts = [textPart, ...m.attachments.map((a) => [
    `Content-Type: ${a.contentType}; name="${quoteName(a.filename)}"`,
    `Content-Disposition: attachment; filename="${quoteName(a.filename)}"`,
    "Content-Transfer-Encoding: base64",
    "",
    wrap76(base64(a.content)),
  ].join("\r\n"))];
  return [...head, `Content-Type: multipart/mixed; boundary="${boundary}"`, "", ...parts.map((p) => `--${boundary}\r\n${p}`), `--${boundary}--`, ""].join("\r\n");
}

/** "Name <address>" with the display name encoded when needed. */
export function fromHeader(name: string | null | undefined, address: string): string {
  const a = cleanAddress(address);
  const n = quoteName(String(name || "").trim());
  return n ? `${/^[\x20-\x7e]*$/.test(n) ? `"${n}"` : encodeHeader(n)} <${a}>` : a;
}
