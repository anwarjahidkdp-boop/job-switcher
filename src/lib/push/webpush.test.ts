import { describe, expect, it } from "vitest";
import { b64u, encryptPayload, makeVapidKeys, unb64u, vapidAuth } from "./webpush";

const subtle = globalThis.crypto.subtle;
type Bytes = Uint8Array<ArrayBuffer>;
const hkdf = async (salt: Bytes, ikm: Bytes, info: Bytes, n: number) =>
  new Uint8Array(await subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, await subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]), n * 8));
const cat = (...p: Uint8Array[]): Bytes => { const o = new Uint8Array(p.reduce((n, x) => n + x.length, 0)); let a = 0; for (const x of p) { o.set(x, a); a += x.length; } return o; };
const te = new TextEncoder();

// Plays the browser's side of RFC 8291, so the test proves a real browser can open what the server sends.
async function browserDecrypt(body: Bytes, ua: CryptoKeyPair, auth: Bytes) {
  const salt = body.slice(0, 16), idlen = body[20], asPublic = body.slice(21, 21 + idlen), sealed = body.slice(21 + idlen);
  const uaPublic = new Uint8Array(await subtle.exportKey("raw", ua.publicKey));
  const peer = await subtle.importKey("raw", asPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const shared = new Uint8Array(await subtle.deriveBits({ name: "ECDH", public: peer }, ua.privateKey, 256));
  const ikm = await hkdf(auth, shared, cat(te.encode("WebPush: info\0"), uaPublic, asPublic), 32);
  const cek = await hkdf(salt, ikm, te.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, te.encode("Content-Encoding: nonce\0"), 12);
  const plain = new Uint8Array(await subtle.decrypt({ name: "AES-GCM", iv: nonce }, await subtle.importKey("raw", cek, "AES-GCM", false, ["decrypt"]), sealed));
  expect(plain[plain.length - 1]).toBe(2); // last-record delimiter
  return new TextDecoder().decode(plain.slice(0, -1));
}

describe("web push", () => {
  it("base64url round-trips bytes", () => {
    const b = new Uint8Array([0, 251, 255, 62, 63, 1]);
    expect(unb64u(b64u(b))).toEqual(b);
    expect(b64u(b)).not.toMatch(/[+/=]/);
  });

  it("encrypts a message only the subscribed browser can read", async () => {
    const ua = await subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]) as CryptoKeyPair;
    const auth = globalThis.crypto.getRandomValues(new Uint8Array(16));
    const target = { p256dh: b64u(await subtle.exportKey("raw", ua.publicKey)), auth: b64u(auth) };
    const msg = JSON.stringify({ title: "New 82% match: Accounts Manager", body: "ACME · Dhaka", link: "/jobs/1" });
    const body = await encryptPayload(target, te.encode(msg));
    expect(new DataView(body.buffer, body.byteOffset).getUint32(16)).toBe(4096);
    expect(await browserDecrypt(body, ua, auth)).toBe(msg);
  });

  it("signs a VAPID token the push service can verify", async () => {
    const keys = await makeVapidKeys();
    expect(unb64u(keys.publicKey)).toHaveLength(65);
    const header = await vapidAuth("https://fcm.googleapis.com/fcm/send/abc", keys, "mailto:hello@jobpao.app", Date.UTC(2026, 9, 27));
    const [, t, k] = header.match(/^vapid t=([^,]+), k=(.+)$/)!;
    expect(k).toBe(keys.publicKey);
    const [h, c, s] = t.split(".");
    expect(JSON.parse(new TextDecoder().decode(unb64u(c)))).toEqual({ aud: "https://fcm.googleapis.com", exp: Date.UTC(2026, 9, 27) / 1000 + 43200, sub: "mailto:hello@jobpao.app" });
    const pub = await subtle.importKey("raw", unb64u(keys.publicKey), { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
    expect(await subtle.verify({ name: "ECDSA", hash: "SHA-256" }, pub, unb64u(s), te.encode(`${h}.${c}`))).toBe(true);
  });
});
