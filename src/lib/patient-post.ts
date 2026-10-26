/** Messages shown while a long AI step runs or waits for a retry, so the person sees the work going on. */
export const AI_WORKING = [
  "AI is reading your CV…",
  "AI is writing your new CV…",
  "Polishing every line in a professional style…",
  "Checking every fact against your CV…",
  "Almost there. Putting your CV together…",
];

// Waits between tries: about 4 minutes in all, longer than the 3 minutes after which a cut-off AI hold is released.
const WAITS = [12, 18, 25, 30, 35, 40, 45, 45].map((s) => s * 1000);
const RETRY_CODES = new Set(["unresolved", "upstream", "invalid_json"]);

/**
 * POST that keeps going through short outages: a request cut off on the server, an AI step still holding the
 * allowance, or a dropped connection are retried quietly while `onWait` shows progress. Real refusals (allowance
 * used up, trial ended, bad input) are thrown at once with the server's message.
 */
export function patientPost(url: string, body: unknown, onWait?: (message: string) => void, sleep?: (ms: number) => Promise<unknown>) {
  return patientFetch(() => fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }), onWait, sleep);
}

/** Same as patientPost for any request, e.g. a file upload. `send` must build a fresh request each time. */
export async function patientFetch(send: () => Promise<Response>, onWait?: (message: string) => void, sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))) {
  let last = "Something went wrong. Try again.";
  for (let i = 0; i <= WAITS.length; i++) {
    let retry = false;
    try {
      const r = await send();
      const j = await r.json().catch(() => null);
      if (r.ok && j) return j;
      last = (j && j.error) || last;
      // No JSON at all means the server was cut off mid-request; a known AI code may clear up on its own.
      retry = !j || r.status >= 500 && (!j.code || RETRY_CODES.has(j.code));
    } catch { retry = true; last = "Can't reach JobPao right now. Check your connection and try again."; }
    if (!retry || i === WAITS.length) break;
    onWait?.(AI_WORKING[Math.min(i + 1, AI_WORKING.length - 1)]);
    await sleep(WAITS[i]);
  }
  throw new Error(last);
}
