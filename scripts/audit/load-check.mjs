// Launch load check: a short burst of visitors on the public pages, as an ad campaign would bring.
// Counts Cloudflare CPU-limit errors (1102) and other failures, and the response times. Read-only: GET requests only.
import { writeFileSync } from "node:fs";

const origin = process.env.LOAD_ORIGIN || "https://jobpao.app";
const total = Number(process.env.LOAD_REQUESTS || 400), parallel = Number(process.env.LOAD_PARALLEL || 25);
const paths = ["/", "/", "/", "/login", "/terms", "/refund", "/install", "/robots.txt"];
const rows = [];

async function hit(i) {
  const path = paths[i % paths.length], at = performance.now();
  try {
    const r = await fetch(origin + path, { redirect: "manual", signal: AbortSignal.timeout(30000), headers: { "user-agent": "JobPao-Load-Check (owner QA)" } });
    const text = await r.text();
    rows.push({ path, status: r.status, ms: Math.round(performance.now() - at), cpu: r.status >= 500 && /1102|exceeded/i.test(text) });
  } catch { rows.push({ path, status: 0, ms: Math.round(performance.now() - at), cpu: false }); }
}

let next = 0;
await Promise.all(Array.from({ length: parallel }, async () => { while (next < total) await hit(next++); }));

const ms = rows.map((r) => r.ms).sort((a, b) => a - b), pct = (p) => ms[Math.min(ms.length - 1, Math.floor(ms.length * p))];
const failed = rows.filter((r) => r.status === 0 || r.status >= 500);
const byPath = Object.fromEntries(paths.filter((p, i) => paths.indexOf(p) === i).map((p) => {
  const mine = rows.filter((r) => r.path === p).map((r) => r.ms).sort((a, b) => a - b);
  return [p, { n: mine.length, p50: mine[Math.floor(mine.length / 2)], p95: mine[Math.floor(mine.length * 0.95)], failed: rows.filter((r) => r.path === p && (r.status === 0 || r.status >= 500)).length }];
}));
const summary = { origin, requests: rows.length, parallel, failed: failed.length, cpuLimit: rows.filter((r) => r.cpu).length, p50: pct(0.5), p95: pct(0.95), max: ms.at(-1), byPath };
writeFileSync("load-check-results.json", JSON.stringify({ summary, rows }, null, 1));
console.log(JSON.stringify(summary, null, 1));
// One line the run page shows without opening the log.
console.log(`::notice title=Load check::${rows.length} requests, ${parallel} at a time: ${failed.length} failed (${summary.cpuLimit} CPU limit), p50 ${summary.p50} ms, p95 ${summary.p95} ms`);
if (failed.length) process.exit(1);
