import { describe, expect, it, vi } from "vitest";
import type { UserState } from "./state";

vi.mock("./state", () => ({ countFoundSince: async (_db: unknown, st: { scored: { job: { foundAt: string } }[] }, since: Date) => st.scored.filter((x) => Date.parse(x.job.foundAt) >= since.getTime()).length }));
const { briefingWindow } = await import("./briefing");

const H = 3_600_000;
const NOW = Date.parse("2026-10-26T12:00:00Z"); // 6 pm in Dhaka; the latest update was 3 pm
const iso = (t: number) => new Date(t).toISOString();
function st(joined: number, found: number[], apps: Record<string, unknown> = {}): UserState {
  return { country: "BD", analysed: found.length, profile: { created_at: iso(joined) }, apps,
    scored: found.map((t, i) => ({ job: { id: String(i), country: "BD", foundAt: iso(t), addedAt: iso(t) }, m: { score: 80, relevant: true, expired: false } })) } as unknown as UserState;
}
const run = (s: UserState) => briefingWindow({} as never, s, undefined, NOW);

describe("fresh-jobs window", () => {
  it("gives a new account everything since it joined", async () => {
    const b = await run(st(NOW - 30 * H, []));
    expect(b.kind).not.toBe("joined");
    const n = await run(st(NOW - 20 * H, [NOW - 20 * H]));
    expect(n).toMatchObject({ kind: "joined", since: new Date(NOW - 20 * H), checked: 1 });
  });
  it("covers the 24 hours up to the latest update, with the market's update times", async () => {
    const b = await run(st(NOW - 9 * 24 * H, [NOW - 2 * H, NOW - 19 * H, NOW - 28 * H]));
    expect(b.kind).toBe("day");
    expect(b.updated.toISOString()).toBe("2026-10-26T09:00:00.000Z"); // 3 pm in Dhaka
    expect(b.next.toISOString()).toBe("2026-10-26T16:00:00.000Z"); // 10 pm
    expect(b.since.toISOString()).toBe("2026-10-25T09:00:00.000Z");
    expect(b.checked).toBe(2); // the job 28 hours ago is older than the window
  });
  it("keeps the same window until the next update", async () => {
    const s = st(NOW - 9 * 24 * H, [NOW - 2 * H]);
    const a = await briefingWindow({} as never, s, undefined, NOW), later = await briefingWindow({} as never, s, undefined, NOW + 3 * H);
    expect(later.since).toEqual(a.since);
  });
  it("drops jobs older than the window (they stay in Lifetime)", async () => {
    const old = await run(st(NOW - 9 * 24 * H, [NOW - 5 * 24 * H]));
    expect(old).toMatchObject({ kind: "day", checked: 0 });
  });
});
