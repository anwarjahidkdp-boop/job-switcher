import { beforeEach, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
const m = vi.hoisted(() => ({ notify: vi.fn(), load: vi.fn() }));
vi.mock("../ai", () => ({ aiConfigured: () => true }));
vi.mock("../email/send", () => ({ emailProvider: () => false }));
vi.mock("../email/templates", () => ({ newMatchesEmail: vi.fn() }));
vi.mock("./email-outbox", () => ({ deliverEmail: vi.fn() }));
vi.mock("./notify", () => ({ notify: m.notify }));
vi.mock("./state", () => ({ loadState: m.load }));
import { processNewMatches } from "./new-matches";

const H = 3_600_000;
const row = (id: string, score: number) => ({ job_id: id, score, jobs: { title: `Job ${id}`, company: "Co", location: null, active: true } });
function db(rows: unknown[], settled: string[][]) {
  return { from: (table: string) => {
    const result = { data: table === "matches" ? rows : table === "profiles" ? {} : [], error: null };
    const q: Record<string, unknown> = {};
    for (const k of ["select", "eq", "is", "gte", "or", "order", "limit", "update"]) q[k] = () => q;
    q.in = (_k: string, ids: string[]) => { settled.push(ids); return q; };
    q.maybeSingle = async () => result;
    q.then = (resolve: (r: unknown) => unknown) => Promise.resolve(result).then(resolve);
    return q;
  } } as unknown as SupabaseClient;
}
const live = (id: string, score: number, foundAgo = 2 * H) => ({ job: { id, foundAt: new Date(Date.now() - foundAgo).toISOString() }, m: { score, relevant: true, expired: false } });

beforeEach(() => { vi.clearAllMocks(); m.notify.mockResolvedValue(undefined); });
it("rings the bell with the score the page shows, only for Top matches, after the AI has read the post", async () => {
  m.load.mockResolvedValue({
    scored: [live("a", 62), live("b", 82), live("c", 91), live("d", 88, 30 * H)],
    aiCheck: new Map([["a", {}], ["b", {}]]),
  });
  const settled: string[][] = [];
  await processNewMatches(db([row("a", 100), row("b", 79), row("c", 95), row("d", 88)], settled), ["u"], { appUrl: "https://x" });
  const titles = m.notify.mock.calls[0][2].map((n: { title: string }) => n.title);
  // a: the AI lowered it to 62%, so no bell; b: 82% as on the page; c: waits for the AI; d: waited a day, goes out as is.
  expect(titles).toEqual(["New 88% match: Job d", "New 82% match: Job b"]);
  expect(settled.at(-1)).toEqual(["a", "b", "d"]);
});
