// Web Push without a library: the VAPID signature (RFC 8292) and the aes128gcm payload encryption (RFC 8291),
// built on WebCrypto so the same code runs in the Cloudflare Worker and in the GitHub Actions scripts.
const enc = new TextEncoder();
const subtle = () => globalThis.crypto.subtle;
type Bytes = Uint8Array<ArrayBuffer>;

export const b64u = (b: ArrayBuffer | Uint8Array) => {
  let s = "";
  for (const c of b instanceof Uint8Array ? b : new Uint8Array(b)) s += String.fromCharCode(c);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
export const unb64u = (s: string): Bytes => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - s.length % 4) % 4)), (c) => c.charCodeAt(0));
const concat = (...parts: Uint8Array[]): Bytes => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
};

export interface VapidKeys { publicKey: string; privateJwk: JsonWebKey }
export interface PushTarget { endpoint: string; p256dh: string; auth: string }

/** A new site key pair. The public half goes to browsers when they subscribe; the private half signs every send. */
export async function makeVapidKeys(): Promise<VapidKeys> {
  const pair = await subtle().generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]) as CryptoKeyPair;
  const raw = await subtle().exportKey("raw", pair.publicKey);
  const jwk = await subtle().exportKey("jwk", pair.privateKey);
  return { publicKey: b64u(raw), privateJwk: { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y, d: jwk.d } };
}

/** The Authorization header value for one push service (the audience is the endpoint's origin). */
export async function vapidAuth(endpoint: string, keys: VapidKeys, subject: string, now = Date.now()): Promise<string> {
  const head = b64u(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = b64u(enc.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(now / 1000) + 12 * 3600, sub: subject })));
  const key = await subtle().importKey("jwk", { ...keys.privateJwk, key_ops: ["sign"], ext: true }, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const sig = await subtle().sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(`${head}.${claims}`));
  return `vapid t=${head}.${claims}.${b64u(sig)}, k=${keys.publicKey}`;
}

const hkdf = async (salt: Bytes, ikm: Bytes, info: Bytes, bytes: number): Promise<Bytes> =>
  new Uint8Array(await subtle().deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, await subtle().importKey("raw", ikm, "HKDF", false, ["deriveBits"]), bytes * 8));

/** Encrypts the message for one browser (aes128gcm, a single record). Only that browser can read it. */
export async function encryptPayload(target: Pick<PushTarget, "p256dh" | "auth">, payload: Bytes, salt: Bytes = globalThis.crypto.getRandomValues(new Uint8Array(16))): Promise<Bytes> {
  const uaPublic = unb64u(target.p256dh);
  const local = await subtle().generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]) as CryptoKeyPair;
  const asPublic = new Uint8Array(await subtle().exportKey("raw", local.publicKey));
  const peer = await subtle().importKey("raw", uaPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const shared = new Uint8Array(await subtle().deriveBits({ name: "ECDH", public: peer }, local.privateKey, 256));
  const ikm = await hkdf(unb64u(target.auth), shared, concat(enc.encode("WebPush: info\0"), uaPublic, asPublic), 32);
  const cek = await hkdf(salt, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, enc.encode("Content-Encoding: nonce\0"), 12);
  const key = await subtle().importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const sealed = new Uint8Array(await subtle().encrypt({ name: "AES-GCM", iv: nonce }, key, concat(payload, new Uint8Array([2]))));
  const rs = new Uint8Array([0, 0, 0x10, 0]); // record size 4096
  return concat(salt, rs, new Uint8Array([asPublic.length]), asPublic, sealed);
}

/** Sends one message. Returns the push service's status: 201 delivered, 404/410 the browser unsubscribed. */
export async function sendWebPush(target: PushTarget, message: unknown, keys: VapidKeys, opts: { subject: string; ttl?: number; urgency?: "normal" | "high"; timeoutMs?: number }): Promise<number> {
  const body = await encryptPayload(target, enc.encode(JSON.stringify(message)));
  const res = await fetch(target.endpoint, {
    method: "POST",
    headers: { Authorization: await vapidAuth(target.endpoint, keys, opts.subject), "Content-Encoding": "aes128gcm", "Content-Type": "application/octet-stream", TTL: String(opts.ttl ?? 86_400), Urgency: opts.urgency ?? "normal" },
    body,
    signal: AbortSignal.timeout(opts.timeoutMs ?? 8_000),
  });
  return res.status;
}
