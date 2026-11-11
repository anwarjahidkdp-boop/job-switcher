// Pure logic of the watchdog: which workflows are overdue, what to start, when to email.
// Kept free of Worker types so it is unit-tested with the app's vitest.

export interface Check { workflow: string; label: string; maxAgeHours: number; alertAfterHours: number }

// maxAgeHours: start the workflow when no run of any kind (schedule, manual, watchdog) started for this long.
// alertAfterHours: email the owner when GitHub's own timer has not started it for this long. The two are
// separate because the watchdog's restarts keep the job alive, which must not hide that the timer is dead.
// Limits sit above each workflow's normal gap so a healthy (even late) schedule never trips them.
export const CHECKS: Check[] = [
  // Hourly at :10. 1.5 h restarts it every 2 h while the timer is dead, which still covers every market's
  // scan window (each run scans markets due in the next 2 h, src/lib/scan-schedule.ts).
  { workflow: "ingest.yml", label: "Job scan (Ingest public job listings)", maxAgeHours: 1.5, alertAfterHours: 3 },
  { workflow: "reminders.yml", label: "Reminders and deadline alerts", maxAgeHours: 12, alertAfterHours: 12 }, // longest gap 9 h (17:00 -> 02:00)
  { workflow: "backup.yml", label: "Weekly database backup", maxAgeHours: 8 * 24, alertAfterHours: 8 * 24 },
  { workflow: "sponsors.yml", label: "UK visa sponsor register", maxAgeHours: 8 * 24, alertAfterHours: 8 * 24 },
];

export interface Env {
  REPO: string;
  WATCHDOG_GITHUB_TOKEN?: string;
  BREVO_API_KEY?: string;
  EMAIL_FROM?: string;
  ADMIN_EMAILS?: string;
}

export interface Finding { check: Check; lastRun: Date | null; ageHours: number; lastScheduled: Date | null; started: boolean; error?: string }

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

/** Start time of the latest run; with event "schedule", the latest run GitHub's own timer started. */
export async function lastRunStart(env: Env, workflow: string, event?: "schedule"): Promise<Date | null> {
  const r = await gh(env, `/actions/workflows/${workflow}/runs?per_page=1${event ? `&event=${event}` : ""}`);
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
    const stamp = (d: Date) => `${d.toISOString().slice(0, 16).replace("T", " ")} UTC`;
    const timer = f.lastScheduled ? `GitHub's timer last started it ${stamp(f.lastScheduled)}` : "GitHub's timer has not started it";
    const what = f.started ? "The watchdog started it now." : f.error ? `Could not start it: ${f.error}. Start it by hand.` : "The watchdog keeps it running meanwhile.";
    return `<li><b>${f.check.label}</b>: ${timer}. ${what}</li>`;
  });
  return {
    subject: `JobPao watchdog: ${findings.length === 1 ? findings[0].check.label + " is" : findings.length + " scheduled jobs are"} not running on schedule`,
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

/** One hourly pass. Returns the workflows it restarted or emailed about, for logs and tests. */
export async function runWatchdog(env: Env, now = new Date(), checks = CHECKS): Promise<Finding[]> {
  const overdue: Finding[] = [];
  const toEmail: Finding[] = [];
  for (const check of checks) {
    let lastRun: Date | null, lastScheduled: Date | null;
    try { [lastRun, lastScheduled] = await Promise.all([lastRunStart(env, check.workflow), lastRunStart(env, check.workflow, "schedule")]); }
    catch (e) { console.error("watchdog read", check.workflow, e); continue; }
    const age = ageHours(lastRun, now);
    const restart = age >= check.maxAgeHours;
    const alert = shouldEmail(ageHours(lastScheduled, now), check.alertAfterHours);
    if (!restart && !alert) continue;
    const f: Finding = { check, lastRun, ageHours: age, lastScheduled, started: false };
    if (restart) {
      try { await startWorkflow(env, check.workflow); f.started = true; }
      catch (e) { f.error = e instanceof Error ? e.message : String(e); }
    }
    overdue.push(f);
    if (alert || (restart && !f.started && shouldEmail(age, check.maxAgeHours))) toEmail.push(f);
  }
  if (toEmail.length) {
    const { subject, html } = emailText(toEmail, env.REPO);
    try { await sendEmail(env, subject, html); } catch (e) { console.error("watchdog email", e); }
  }
  for (const f of overdue) console.log("watchdog", f.check.workflow, Math.round(f.ageHours), f.started ? "started" : f.error ?? "timer late");
  return overdue;
}
