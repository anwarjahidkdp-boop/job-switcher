// COPY of src/lib/inbound/signature.ts (kept identical; a unit test checks this).
// HMAC-SHA256 request signing between the Cloudflare Email Worker and the app (Web Crypto: works in Workers and Node).
export const SIGNATURE_HEADER = "x-js-signature";
export const TIMESTAMP_HEADER = "x-js-timestamp";
export const MAX_SKEW_MS = 5 * 60 * 1000;

const enc = new TextEncoder();
const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

export async function sign(secret: string, timestamp: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", key, enc.encode(`${timestamp}.${body}`)));
}

export async function verify(secret: string, timestamp: string | null, signature: string | null, body: string, now = Date.now()): Promise<boolean> {
  if (!secret || !timestamp || !signature) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(now - ts) > MAX_SKEW_MS) return false;
  const expected = await sign(secret, timestamp, body);
  if (expected.length !== signature.length) return false;
  let r = 0;
  for (let i = 0; i < expected.length; i++) r |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return r === 0;
}
