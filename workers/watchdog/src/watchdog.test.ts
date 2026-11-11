import { afterEach, describe, expect, it, vi } from "vitest";
import { ageHours, CHECKS, emailText, runWatchdog, shouldEmail, type Env } from "./watchdog";

const NOW = new Date("2026-11-11T08:40:00Z");
const env: Env = { REPO: "o/r", WATCHDOG_GITHUB_TOKEN: "t", BREVO_API_KEY: "b", EMAIL_FROM: "JobPao <hello@jobpao.app>", ADMIN_EMAILS: "owner@x.com, other@x.com" };
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000).toISOString();
type Runs = Record<string, { any: number | null; schedule?: number | null }>;
const healthy: Runs = { "ingest.yml": { any: 0.5 }, "reminders.yml": { any: 8 }, "backup.yml": { any: 6 * 24 }, "sponsors.yml": { any: 7 * 24 } };

function fakeGitHub(runs: Runs, dispatchStatus = 204) {
  const calls: { url: string; method: string; body?: string }[] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit = {}) => {
    calls.push({ url, method: init.method ?? "GET", body: init.body as string | undefined });
    if (url.includes("api.brevo.com")) return new Response("{}", { status: 201 });
    if (url.endsWith("/dispatches")) return new Response(null, { status: dispatchStatus });
    const r = runs[url.match(/workflows\/([^/]+)\//)?.[1] ?? ""];
    const h = url.includes("event=schedule") ? (r?.schedule === undefined ? r?.any : r.schedule) : r?.any;
    return Response.json({ workflow_runs: h == null ? [] : [{ created_at: hoursAgo(h) }] });
  }));
  return calls;
}
const mails = (calls: { url: string; body?: string }[]) => calls.filter((c) => c.url.includes("brevo")).map((c) => JSON.parse(c.body!));
const dispatched = (calls: { url: string; method: string }[]) => calls.filter((c) => c.url.endsWith("/dispatches")).map((c) => c.url.split("/").at(-2));
afterEach(() => vi.unstubAllGlobals());

describe("watchdog", () => {
  it("does nothing while every schedule is on time", async () => {
    const calls = fakeGitHub(healthy);
    expect(await runWatchdog(env, NOW)).toEqual([]);
    expect(calls.every((c) => c.method === "GET")).toBe(true);
  });

  it("leaves a scheduled scan that is a little late alone", async () => {
    const calls = fakeGitHub({ ...healthy, "ingest.yml": { any: 1.4 } });
    expect(await runWatchdog(env, NOW)).toEqual([]);
    expect(dispatched(calls)).toEqual([]);
  });

  it("restarts an overdue job scan and emails the owner once the timer is 3 h late", async () => {
    const calls = fakeGitHub({ ...healthy, "ingest.yml": { any: 3.4 } });
    const found = await runWatchdog(env, NOW);
    expect(found.map((f) => [f.check.workflow, f.started])).toEqual([["ingest.yml", true]]);
    const dispatch = calls.find((c) => c.url.endsWith("/dispatches"))!;
    expect(dispatch.url).toBe("https://api.github.com/repos/o/r/actions/workflows/ingest.yml/dispatches");
    expect(JSON.parse(dispatch.body!)).toEqual({ ref: "main" });
    const [mail] = mails(calls);
    expect(mail.to).toEqual([{ email: "owner@x.com" }]);
    expect(mail.sender).toEqual({ name: "JobPao", email: "hello@jobpao.app" });
    expect(mail.subject).toContain("Job scan");
  });

  it("restarts before the email threshold without emailing", async () => {
    const calls = fakeGitHub({ ...healthy, "ingest.yml": { any: 2 } });
    await runWatchdog(env, NOW);
    expect(dispatched(calls)).toEqual(["ingest.yml"]);
    expect(mails(calls)).toEqual([]);
  });

  it("still warns when its own restarts keep the scan alive but GitHub's timer is dead", async () => {
    // The watchdog started it 1 h ago; the last scheduled run was 3.5 h ago.
    const calls = fakeGitHub({ ...healthy, "ingest.yml": { any: 1, schedule: 3.5 } });
    const [f] = await runWatchdog(env, NOW);
    expect(f.started).toBe(false);
    expect(dispatched(calls)).toEqual([]);
    expect(mails(calls)[0].htmlContent).toContain("keeps it running");
  });

  it("does not email every hour while the timer stays dead, but repeats daily", async () => {
    let calls = fakeGitHub({ ...healthy, "ingest.yml": { any: 1, schedule: 5.5 } });
    await runWatchdog(env, NOW);
    expect(mails(calls)).toEqual([]);
    calls = fakeGitHub({ ...healthy, "ingest.yml": { any: 1, schedule: 27.5 } });
    await runWatchdog(env, NOW);
    expect(mails(calls).length).toBe(1);
  });

  it("emails what went wrong when GitHub refuses to start the job", async () => {
    const calls = fakeGitHub({ ...healthy, "reminders.yml": { any: 12.2 } }, 403);
    const [f] = await runWatchdog(env, NOW);
    expect(f.started).toBe(false);
    expect(f.error).toContain("403");
    expect(mails(calls)[0].htmlContent).toContain("Start it by hand");
  });

  it("skips a workflow GitHub cannot read instead of guessing", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("rate limited", { status: 403 })));
    expect(await runWatchdog(env, NOW)).toEqual([]);
  });

  it("email rules: first overdue hour, then once a day", () => {
    expect(shouldEmail(3.2, 3)).toBe(true);
    expect(shouldEmail(4.2, 3)).toBe(false);
    expect(shouldEmail(27.5, 3)).toBe(true);
    expect(shouldEmail(2.9, 3)).toBe(false);
    expect(shouldEmail(ageHours(null, NOW), 3)).toBe(true);
  });

  it("limits stay above each workflow's normal gap", () => {
    const c = Object.fromEntries(CHECKS.map((x) => [x.workflow, x]));
    expect(c["ingest.yml"].maxAgeHours).toBeGreaterThan(1);
    expect(c["ingest.yml"].maxAgeHours).toBeLessThanOrEqual(2); // every market's 2 h scan window stays covered
    expect(c["reminders.yml"].maxAgeHours).toBeGreaterThan(9);
    for (const w of ["backup.yml", "sponsors.yml"]) expect(c[w].maxAgeHours).toBeGreaterThan(7 * 24);
    for (const x of CHECKS) expect(x.alertAfterHours).toBeGreaterThanOrEqual(x.maxAgeHours);
  });

  it("writes a short readable email", () => {
    const { subject, html } = emailText([{ check: CHECKS[0], lastRun: new Date(hoursAgo(43)), ageHours: 43, lastScheduled: new Date(hoursAgo(43)), started: true }], "o/r");
    expect(subject).toBe("JobPao watchdog: Job scan (Ingest public job listings) is not running on schedule");
    expect(html).toContain("GitHub's timer last started it 2026-11-09 13:40 UTC");
    expect(html).toContain("started it now");
  });
});
