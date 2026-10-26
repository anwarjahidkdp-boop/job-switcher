import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { UserState } from "@/lib/server/state";

const h = vi.hoisted(() => ({ st: null as unknown as UserState }));
vi.mock("@/lib/server/page", () => ({ requireAppState: async () => ({ st: h.st, db: {} }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh() {}, push() {} }) }));

const NOW = new Date().toISOString(), OLD = "2026-01-01T00:00:00Z";
const row = (id: string, score: number, addedAt: string, relevant = true) => ({
  job: { id, country: "BD", title: `Job ${id}`, company: `Co ${id}`, location: "Dhaka", deadline: null, addedAt, required: [], preferred: [] },
  m: { score, band: score >= 90 ? "ex" : score >= 80 ? "st" : score >= 70 ? "po" : "lo", relevant, expired: false, matched: [], gaps: [] },
});
h.st = { country: "BD", today: "2026-10-25", analysed: 10, apps: {}, dismissed: new Set(), aiCheck: new Map(),
  scored: [row("a", 94, NOW), row("b", 76, NOW), row("c", 85, OLD), row("d", 60, NOW), row("e", 99, NOW, false)] } as unknown as UserState;

const render = async (q: Record<string, string>) => {
  const { default: Page } = await import("./page");
  return renderToStaticMarkup(await Page({ searchParams: Promise.resolve(q) }));
};

describe("opportunities filtered from the home summary", () => {
  it("lists exactly the jobs behind a fit card", async () => {
    const html = await render({ fit: "ex", when: "today" });
    expect(html).toContain("Strong Fit · Today");
    expect(html).toContain("1 job.");
    expect(html).toContain("Job a");
    expect(html).not.toContain("Job c");
  });
  it("lists every job found, and says how many were checked but not listed", async () => {
    const html = await render({ fit: "found" });
    for (const id of ["a", "b", "c", "d", "e"]) expect(html).toContain(`Job ${id}`);
    expect(html).toContain("5 jobs.");
    expect(html).toContain("5 more jobs outside your target roles");
  });
  it("puts irrelevant and low scores under Stretch & others", async () => {
    const html = await render({ fit: "rest", when: "today" });
    expect(html).toContain("Job d");
    expect(html).toContain("Job e");
    expect(html).not.toContain("Job a");
  });
  it("turns an empty fit group into a next step: career guide button, and all-time when that has jobs", async () => {
    const html = await render({ fit: "st", when: "today" });
    if (process.env.DUMP_OPP) (await import("node:fs")).writeFileSync(process.env.DUMP_OPP, html);
    expect(html).toContain("How to get more Best Fit roles");
    expect(html).toContain('href="/insights#career-guidance"');
    expect(html).toContain("See all-time Best Fit");
    expect(await render({ fit: "rest", when: "today" })).not.toContain("career-guidance");
  });
});
