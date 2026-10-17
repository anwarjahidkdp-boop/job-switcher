// Pure logic of the email worker, kept free of Cloudflare globals so it can be unit-tested.
import { sign, SIGNATURE_HEADER, TIMESTAMP_HEADER } from "./signature";

export interface IntakeEnv {
  APP_URL: string;
  INBOUND_SHARED_SECRET: string;
  MAX_BYTES?: string;
}

export function toBase64(bytes: Uint8Array): string {
  let bin = "";
  const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) bin += String.fromCharCode(...bytes.subarray(i, i + CH));
  return btoa(bin);
}

/** Builds the signed request the app's /api/inbound/email route expects. */
export async function buildForward(env: IntakeEnv, to: string, raw: Uint8Array, rawKey: string | null, now = Date.now()) {
  const body = JSON.stringify({ to, raw: toBase64(raw), rawKey });
  const ts = String(now);
  const sig = await sign(env.INBOUND_SHARED_SECRET, ts, body);
  return {
    url: `${env.APP_URL.replace(/\/+$/, "")}/api/inbound/email`,
    init: { method: "POST", headers: { "content-type": "application/json", [SIGNATURE_HEADER]: sig, [TIMESTAMP_HEADER]: ts }, body },
  };
}

/** Local part must look like an alias we issue (letters, digits, dots, dashes). */
export function validRecipient(to: string): boolean {
  return /^[a-z0-9][a-z0-9.\-]{1,62}@[a-z0-9.\-]+$/i.test(to.trim());
}
