import { describe, expect, it, vi } from "vitest";
import type { UserState } from "./state";

vi.mock("./state", () => ({ countFoundSince: async (_db: unknown, st: { scored: { job: { foundAt: string } }[] }, since: Date) => st.scored.filter((x) => Date.parse(x.job.foundAt) >= since.getTime()).length }));
const { briefingWindow } = await import("./briefing");

const H = 3_600_000;
const NOW = Date.parse("2026-10-26T12:00:00Z"); // 6 pm in Dhaka; local midnight was 2026-10-25T18:00Z
const iso = (t: number) => new Date(t).toISOString();
function st(joined: number, found: number[], apps: Record<string, unknown> = {}): UserState {
  return { country: "BD", analysed: found.length, profile: { created_at: iso(joined) }, apps,
    scored: found.map((t, i) => ({ job: { id: String(i), country: "BD", foundAt: iso(t), addedAt: iso(t) }, m: { score: 80, relevant: true, expired: false } })) } as unknown as UserState;
}
const run = (s: UserState) => briefingWindow({} as never, s, undefined, NOW);

describe("Today's Fresh Jobs window", () => {
  it("gives a new account everything since it joined", async () => {
    const b = await run(st(NOW - 30 * H, []));
    expect(b.kind).not.toBe("joined");
    const n = await run(st(NOW - 20 * H, [NOW - 20 * H]));
    expect(n).toMatchObject({ kind: "joined", since: new Date(NOW - 20 * H), checked: 1 });
  });
  it("counts today from local midnight, with the market's update times", async () => {
    const b = await run(st(NOW - 9 * 24 * H, [NOW - 2 * H, NOW - 17 * H, NOW - 19 * H]));
    expect(b.kind).toBe("today");
    expect(b.since.toISOString()).toBe("2026-10-25T18:00:00.000Z");
    expect(b.checked).toBe(2); // the job 19 hours ago was yesterday in Dhaka
    expect(b.updated.toISOString()).toBe("2026-10-26T09:00:00.000Z"); // 3 pm
    expect(b.next.toISOString()).toBe("2026-10-26T16:00:00.000Z"); // 10 pm
  });
  it("counts an application sent today even when no job was found today", async () => {
    const b = await run(st(NOW - 9 * 24 * H, [NOW - 30 * H], { a: { job_id: "0", status: "applied", applied_at: iso(NOW - H), jobs: { country: "BD" } } }));
    expect(b.kind).toBe("today");
  });
  it("falls back to yesterday before the day's first jobs, then to the latest scan", async () => {
    expect((await run(st(NOW - 9 * 24 * H, [NOW - 30 * H]))).kind).toBe("yesterday");
    const old = await run(st(NOW - 9 * 24 * H, [NOW - 5 * 24 * H]));
    expect(old).toMatchObject({ kind: "scan", shownAt: new Date(NOW - 5 * 24 * H), checked: 1 });
  });
});
