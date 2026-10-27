import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import type { Scored } from "@/lib/matching";
import type { ApplicationRow } from "./state";
import { metricsFromState } from "./report-metrics";
import { jobTotals } from "./search-summary";
import { appliedFor } from "../applied-history";

const row = (id: string, score: number, foundAt: string, relevant = true) => ({ job: { id, foundAt, active: true, deadline: "2026-11-10" }, m: { score, relevant, expired: false, f: {} } }) as unknown as Scored;
const SCORED = [row("a", 95, "2026-10-21T05:00:00Z"), row("b", 84, "2026-10-22T05:00:00Z"), row("c", 72, "2026-10-23T05:00:00Z"), row("d", 99, "2026-10-23T06:00:00Z", false), row("e", 40, "2026-10-24T05:00:00Z"), row("z", 91, "2026-10-28T05:00:00Z")];
const app = (job: string, x: Partial<ApplicationRow>) => ({ id: job, job_id: job, status: "applied", pack: null, created_at: "2026-10-22T00:00:00Z", applied_at: null, application_events: [], jobs: { country: "BD" }, ...x }) as unknown as ApplicationRow;
const APPS = {
  a: app("a", { applied_at: "2026-10-22T08:00:00Z", status: "interview", application_events: [{ event: "status", status: "interview", actor: "user", created_at: "2026-10-23T08:00:00Z" }] }),
  b: app("b", { status: "ready", pack: {} as never }),
  x: app("x", { applied_at: "2026-10-22T08:00:00Z", jobs: { country: "GB" } }),
};
const START = new Date("2026-10-21T00:00:00Z"), END = new Date("2026-10-26T00:00:00Z");

describe("career report numbers", () => {
  it("are the numbers Home shows for the same window", () => {
    const m = metricsFromState({ scored: SCORED, apps: APPS, country: "BD", today: "2026-10-26" }, START, END, 30);
    const home = jobTotals(SCORED.filter((x) => Date.parse(x.job.foundAt!) < END.getTime()), START, 30);
    expect(m).toMatchObject({ v: 2, jobs_analysed: home.found, relevant: home.matched, strong: home.ex });
    expect(m).toMatchObject({ jobs_analysed: 30, relevant: 3, strong: 1 });
  });
  it("count applications like the Applied page: current country only, inside the window", () => {
    const m = metricsFromState({ scored: SCORED, apps: APPS, country: "BD", today: "2026-10-26" }, START, END, 30);
    expect(m.applied).toBe(appliedFor({ a: APPS.a, b: APPS.b }, "new", START.getTime()).length);
    expect(m).toMatchObject({ applied: 1, interviews: 1, offers: 0, prepared: 1, next_deadline: "2026-11-10" });
  });
  it("leave out jobs found after the window ends", () => {
    const m = metricsFromState({ scored: SCORED, apps: {}, country: "BD", today: "2026-10-26" }, START, END, 0);
    expect(m.strong).toBe(1);
    expect(m.jobs_analysed).toBe(5);
  });
});
