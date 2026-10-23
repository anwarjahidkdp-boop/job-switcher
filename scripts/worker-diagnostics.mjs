// Read-only production diagnostics. Never print tokens, bindings, headers or request bodies.
const token = process.env.CLOUDFLARE_API_TOKEN;
if (!token) throw new Error("Missing Cloudflare token");
const api = "https://api.cloudflare.com/client/v4";
async function read(path, body) {
  const res = await fetch(api + path, {
    method: body ? "POST" : "GET",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json();
  if (!res.ok || data.success === false || data.errors?.length) {
    console.log(JSON.stringify({ path, status: res.status, errors: data.errors?.map(e => ({ code: e.code, message: e.message })) }));
    return null;
  }
  return data;
}
const accounts = await read("/accounts");
for (const account of accounts?.result || []) {
  const settings = await read(`/accounts/${account.id}/workers/scripts/job-switcher/settings`);
  if (!settings) continue;
  const s = settings.result || {};
  console.log(JSON.stringify({ worker: "job-switcher", limits: s.limits, usage_model: s.usage_model, observability: s.observability, compatibility_date: s.compatibility_date }));
  const subscriptions = await read(`/accounts/${account.id}/subscriptions`);
  if (subscriptions) console.log(JSON.stringify({ workerPlans: (subscriptions.result || []).filter(x => /worker/i.test(JSON.stringify(x.rate_plan || {}))).map(x => ({ name: x.rate_plan?.public_name, id: x.rate_plan?.id, state: x.state })) }));
  const end = new Date();
  const start = new Date(end.getTime() - 6 * 3600000);
  const query = `query($accountTag: string, $start: string, $end: string) {
    viewer { accounts(filter: {accountTag: $accountTag}) {
      workersInvocationsAdaptive(limit: 100, filter: {scriptName: "job-switcher", datetime_geq: $start, datetime_leq: $end}) {
        dimensions { status } sum { requests errors subrequests } quantiles { cpuTimeP50 cpuTimeP99 }
      }
    } }
  }`;
  const metrics = await read("/graphql", { query, variables: { accountTag: account.id, start: start.toISOString(), end: end.toISOString() } });
  if (metrics) console.log(JSON.stringify({ start: start.toISOString(), end: end.toISOString(), metrics: metrics.data?.viewer?.accounts }));
  const telemetry = await read(`/accounts/${account.id}/workers/observability/telemetry/query`, {
    queryId: "jobpao-resource-errors", dry: true, view: "events", limit: 30,
    timeframe: { from: start.getTime(), to: end.getTime() },
    parameters: { datasets: ["cloudflare-workers"], filterCombination: "and", filters: [
      { key: "$metadata.service", operation: "eq", type: "string", value: "job-switcher" },
      { key: "$workers.outcome", operation: "neq", type: "string", value: "ok" },
    ] },
  });
  for (const event of telemetry?.result?.events || []) {
    const w = event.$workers || {}; let path;
    try { path = new URL(w.event?.request?.url).pathname; } catch { /* no request */ }
    console.log(JSON.stringify({ errorEvent: { timestamp: event.timestamp, outcome: w.outcome, cpuTimeMs: w.cpuTimeMs, wallTimeMs: w.wallTimeMs, path, requestId: w.requestId } }));
  }
}
for (const path of ["/", "/login", "/install", "/api/health", "/inbox"]) {
  const begin = performance.now();
  try {
    const r = await fetch(`https://jobpao.app${path}`, { redirect: "manual", signal: AbortSignal.timeout(30000) });
    const text = await r.text();
    console.log(JSON.stringify({ path, status: r.status, elapsedMs: Math.round(performance.now()-begin), resourceError: text.includes("Error 1102"), ray: r.headers.get("cf-ray") }));
  } catch { console.log(JSON.stringify({ path, error: "request failed or timed out" })); }
}
