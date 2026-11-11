// Pure logic of the watchdog: which workflows are overdue, what to start, when to email.
// Kept free of Worker types so it is unit-tested with the app's vitest.

export interface Check { workflow: string; label: string; maxAgeHours: number }

// Overdue = no run of any kind (schedule, manual, watchdog) started for this long. Each limit is the
// workflow's longest normal gap plus a margin, so a healthy schedule never trips it.
export const CHECKS: Check[] = [
  { workflow: "ingest.yml", label: "Job scan (Ingest public job listings)", maxAgeHours: 3 },       // hourly
  { workflow: "reminders.yml", label: "Reminders and deadline alerts", maxAgeHours: 12 },          // longest gap 9 h (17:00 -> 02:00)
  { workflow: "backup.yml", label: "Weekly database backup", maxAgeHours: 8 * 24 },                // weekly
  { workflow: "sponsors.yml", label: "UK visa sponsor register", maxAgeHours: 8 * 24 },            // weekly
];

export interface Env {
  REPO: string;
  WATCHDOG_GITHUB_TOKEN?: string;
  BREVO_API_KEY?: string;
  EMAIL_FROM?: string;
  ADMIN_EMAILS?: string;
}

export interface Finding { check: Check; lastRun: Date | null; ageHours: number; started: boolean; error?: string }

const H = 3_600_000;

/** Hours since the last run started; Infinity when the workflow has never run. */
export function ageHours(lastRun: Date | null, now: Date): number {
  return lastRun ? (now.getTime() - lastRun.getTime()) / H : Infinity;
}

/**
 * Email only on the first hourly check that finds the job overdue, then once a day while it stays
 * overdue (for example when starting it keeps failing), so a stuck job never floods the inbox.
 */
export function shouldEmail(age: number, maxAgeHours: number): boolean {
  if (!Number.isFinite(age)) return true;
  const over = age - maxAgeHours;
  return over >= 0 && (over < 1 || over % 24 < 1);
}

function gh(env: Env, path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`https://api.github.com/repos/${env.REPO}${path}`, {
    ...init,
    headers: {
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
      "user-agent": "jobpao-watchdog",
      ...(env.WATCHDOG_GITHUB_TOKEN ? { authorization: `Bearer ${env.WATCHDOG_GITHUB_TOKEN}` } : {}),
      ...(init.headers as Record<string, string> | undefined),
    },
  });
}

export async function lastRunStart(env: Env, workflow: string): Promise<Date | null> {
  const r = await gh(env, `/actions/workflows/${workflow}/runs?per_page=1`);
  if (!r.ok) throw new Error(`GitHub ${r.status} reading ${workflow}`);
  const j = (await r.json()) as { workflow_runs?: { created_at?: string }[] };
  const at = j.workflow_runs?.[0]?.created_at;
  return at ? new Date(at) : null;
}

export async function startWorkflow(env: Env, workflow: string): Promise<void> {
  if (!env.WATCHDOG_GITHUB_TOKEN) throw new Error("WATCHDOG_GITHUB_TOKEN is not set, so the watchdog cannot start it");
  const r = await gh(env, `/actions/workflows/${workflow}/dispatches`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ref: "main" }),
  });
  if (r.status !== 204) throw new Error(`GitHub ${r.status} starting ${workflow}`);
}

export function emailText(findings: Finding[], repo: string): { subject: string; html: string } {
  const rows = findings.map((f) => {
    const when = f.lastRun ? `${Math.floor(f.ageHours)} hours ago (${f.lastRun.toISOString().slice(0, 16).replace("T", " ")} UTC)` : "never";
    const what = f.started ? "The watchdog started it again." : `Could not start it: ${f.error ?? "unknown error"}. Start it by hand.`;
    return `<li><b>${f.check.label}</b>: last ran ${when}. ${what}</li>`;
  });
  return {
    subject: `JobPao watchdog: ${findings.length === 1 ? findings[0].check.label + " was" : findings.length + " scheduled jobs were"} not running`,
    html: `<p>GitHub's timer missed these scheduled jobs:</p><ul>${rows.join("")}</ul>`
      + `<p>Check <a href="https://github.com/${repo}/actions">GitHub Actions</a>. If GitHub stopped the schedules, open each workflow, choose ··· then Disable workflow, then Enable workflow.</p>`,
  };
}

export async function sendEmail(env: Env, subject: string, html: string): Promise<void> {
  const to = (env.ADMIN_EMAILS ?? "").split(",")[0]?.trim();
  if (!env.BREVO_API_KEY || !env.EMAIL_FROM || !to) return;
  const m = env.EMAIL_FROM.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  const sender = m ? { name: m[1] || "JobPao", email: m[2] } : { name: "JobPao", email: env.EMAIL_FROM.trim() };
  const r = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": env.BREVO_API_KEY, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ sender, to: [{ email: to }], subject, htmlContent: html }),
  });
  if (!r.ok) throw new Error(`Brevo ${r.status}`);
}

/** One hourly pass. Returns what it found, for logs and tests. */
export async function runWatchdog(env: Env, now = new Date(), checks = CHECKS): Promise<Finding[]> {
  const overdue: Finding[] = [];
  const toEmail: Finding[] = [];
  for (const check of checks) {
    let lastRun: Date | null;
    try { lastRun = await lastRunStart(env, check.workflow); }
    catch (e) { console.error("watchdog read", check.workflow, e); continue; }
    const age = ageHours(lastRun, now);
    if (age < check.maxAgeHours) continue;
    const f: Finding = { check, lastRun, ageHours: age, started: false };
    try { await startWorkflow(env, check.workflow); f.started = true; }
    catch (e) { f.error = e instanceof Error ? e.message : String(e); }
    overdue.push(f);
    if (shouldEmail(age, check.maxAgeHours)) toEmail.push(f);
  }
  if (toEmail.length) {
    const { subject, html } = emailText(toEmail, env.REPO);
    try { await sendEmail(env, subject, html); } catch (e) { console.error("watchdog email", e); }
  }
  for (const f of overdue) console.log("watchdog overdue", f.check.workflow, Math.round(f.ageHours), f.started ? "started" : f.error);
  return overdue;
}
