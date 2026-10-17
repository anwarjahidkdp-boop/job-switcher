// Cloudflare Email Worker for Job Switcher.
// Receives forwarded job-alert emails (Gmail filter -> alias@inbound domain), optionally stores the raw
// message in a private R2 bucket, and POSTs it, HMAC-signed, to the app. It never reads or stores passwords
// and never replies to the sender.
import { buildForward, validRecipient, type IntakeEnv } from "./handler";

interface Env extends IntakeEnv {
  RAW?: R2Bucket;
}

const worker = {
  async email(message: ForwardableEmailMessage, env: Env): Promise<void> {
    const max = Number(env.MAX_BYTES || 5_000_000);
    if (message.rawSize > max) { message.setReject("Message too large"); return; }
    if (!validRecipient(message.to)) { message.setReject("Unknown address"); return; }
    if (!env.INBOUND_SHARED_SECRET || !env.APP_URL) throw new Error("Worker is not configured");

    const raw = new Uint8Array(await new Response(message.raw).arrayBuffer());
    let rawKey: string | null = null;
    if (env.RAW) {
      const key = `${message.to.toLowerCase()}/${Date.now()}-${crypto.randomUUID()}.eml`;
      await env.RAW.put(key, raw, { httpMetadata: { contentType: "message/rfc822" } });
      rawKey = `r2:${key}`;
    }

    const { url, init } = await buildForward(env, message.to, raw, rawKey);
    const res = await fetch(url, init);
    if (res.status === 401 || res.status === 400) {
      // Bad signature / unknown alias: bounce so the sender (Gmail) shows a failure instead of silently losing it.
      message.setReject("Recipient not accepted");
      return;
    }
    if (!res.ok) throw new Error(`App returned ${res.status}`); // Cloudflare retries / reports the failure
  },
};

export default worker;
