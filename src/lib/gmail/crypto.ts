// AES-GCM encryption for stored Google refresh tokens. The key (GMAIL_TOKEN_KEY, 32 random bytes in base64)
// lives only in Worker secrets, so a database leak alone does not expose anyone's mailbox.
import { base64 } from "./mime";

const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function key(secret: string): Promise<CryptoKey> {
  const raw = fromB64(secret);
  if (raw.length !== 32) throw new Error("GMAIL_TOKEN_KEY must be 32 bytes in base64.");
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

/** "v1.<iv>.<ciphertext>" in base64. The user id is bound as associated data so a token cannot be moved between rows. */
export async function sealToken(plain: string, secret: string, userId: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: new TextEncoder().encode(userId) }, await key(secret), new TextEncoder().encode(plain));
  return `v1.${base64(iv)}.${base64(new Uint8Array(ct))}`;
}

export async function openToken(sealed: string, secret: string, userId: string): Promise<string> {
  const [v, iv, ct] = sealed.split(".");
  if (v !== "v1" || !iv || !ct) throw new Error("Unknown token format.");
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromB64(iv), additionalData: new TextEncoder().encode(userId) }, await key(secret), fromB64(ct));
  return new TextDecoder().decode(pt);
}
