import { afterEach, describe, expect, it, vi } from "vitest";
import { ageHours, CHECKS, emailText, runWatchdog, shouldEmail, type Env } from "./watchdog";

const NOW = new Date("2026-11-11T08:40:00Z");
const env: Env = { REPO: "o/r", WATCHDOG_GITHUB_TOKEN: "t", BREVO_API_KEY: "b", EMAIL_FROM: "JobPao <hello@jobpao.app>", ADMIN_EMAILS: "owner@x.com, other@x.com" };
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000).toISOString();

function fakeGitHub(lastRuns: Record<string, string | null>, dispatchStatus = 204) {
  const calls: { url: string; method: string; body?: string }[] = [];
  const f = vi.fn(async (url: string, init: RequestInit = {}) => {
    calls.push({ url, method: init.method ?? "GET", body: init.body as string | undefined });
    if (url.includes("api.brevo.com")) return new Response("{}", { status: 201 });
    const wf = url.match(/workflows\/([^/]+)\//)?.[1] ?? "";
    if (url.endsWith("/dispatches")) return new Response(null, { status: dispatchStatus });
    const at = lastRuns[wf];
    return Response.json({ workflow_runs: at ? [{ created_at: at }] : [] });
  });
  vi.stubGlobal("fetch", f);
  return calls;
}
afterEach(() => vi.unstubAllGlobals());

describe("watchdog", () => {
  it("does nothing while every schedule is on time", async () => {
    const calls = fakeGitHub({ "ingest.yml": hoursAgo(0.5), "reminders.yml": hoursAgo(8), "backup.yml": hoursAgo(6 * 24), "sponsors.yml": hoursAgo(7 * 24) });
    expect(await runWatchdog(env, NOW)).toEqual([]);
    expect(calls.every((c) => c.method === "GET")).toBe(true);
  });

  it("restarts an overdue job scan and emails the owner once", async () => {
    const calls = fakeGitHub({ "ingest.yml": hoursAgo(3.4), "reminders.yml": hoursAgo(1), "backup.yml": hoursAgo(1), "sponsors.yml": hoursAgo(1) });
    const found = await runWatchdog(env, NOW);
    expect(found.map((f) => [f.check.workflow, f.started])).toEqual([["ingest.yml", true]]);
    const dispatch = calls.find((c) => c.method === "POST" && c.url.includes("/dispatches"))!;
    expect(dispatch.url).toBe("https://api.github.com/repos/o/r/actions/workflows/ingest.yml/dispatches");
    expect(JSON.parse(dispatch.body!)).toEqual({ ref: "main" });
    const mail = JSON.parse(calls.find((c) => c.url.includes("brevo"))!.body!);
    expect(mail.to).toEqual([{ email: "owner@x.com" }]);
    expect(mail.sender).toEqual({ name: "JobPao", email: "hello@jobpao.app" });
    expect(mail.subject).toContain("Job scan");
  });

  it("keeps restarting but does not email again every hour", async () => {
    const calls = fakeGitHub({ "ingest.yml": hoursAgo(5.5), "reminders.yml": hoursAgo(1), "backup.yml": hoursAgo(1), "sponsors.yml": hoursAgo(1) });
    expect((await runWatchdog(env, NOW)).length).toBe(1);
    expect(calls.some((c) => c.url.includes("/dispatches"))).toBe(true);
    expect(calls.some((c) => c.url.includes("brevo"))).toBe(false);
  });

  it("emails what went wrong when GitHub refuses to start the job", async () => {
    const calls = fakeGitHub({ "ingest.yml": hoursAgo(1), "reminders.yml": hoursAgo(12.2), "backup.yml": hoursAgo(1), "sponsors.yml": hoursAgo(1) }, 403);
    const [f] = await runWatchdog(env, NOW);
    expect(f.started).toBe(false);
    expect(f.error).toContain("403");
    expect(JSON.parse(calls.find((c) => c.url.includes("brevo"))!.body!).htmlContent).toContain("Start it by hand");
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
    const max = Object.fromEntries(CHECKS.map((c) => [c.workflow, c.maxAgeHours]));
    expect(max["ingest.yml"]).toBeGreaterThan(1);
    expect(max["reminders.yml"]).toBeGreaterThan(9);
    expect(max["backup.yml"]).toBeGreaterThan(7 * 24);
    expect(max["sponsors.yml"]).toBeGreaterThan(7 * 24);
  });

  it("writes a short readable email", () => {
    const { subject, html } = emailText([{ check: CHECKS[0], lastRun: new Date(hoursAgo(43)), ageHours: 43, started: true }], "o/r");
    expect(subject).toBe("JobPao watchdog: Job scan (Ingest public job listings) was not running");
    expect(html).toContain("last ran 43 hours ago");
    expect(html).toContain("started it again");
  });
});
