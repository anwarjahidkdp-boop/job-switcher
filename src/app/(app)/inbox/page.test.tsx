import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { writeFileSync } from "node:fs";
import type { UserState } from "@/lib/server/state";

const h = vi.hoisted(() => ({ st: null as unknown as UserState, sub: null as Record<string, unknown> | null, allowance: null as unknown }));
vi.mock("@/lib/server/page", () => ({ requireAppState: async () => ({ st: h.st, db: {} }), subscriptionOf: async () => ({ data: h.sub }) }));
vi.mock("@/lib/server/state", async (orig) => ({ ...(await orig<typeof import("@/lib/server/state")>()), loadJob: async () => undefined }));
vi.mock("@/lib/server/applications", () => ({ packAllowanceFor: async () => h.allowance }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));
vi.mock("@/lib/ai", () => ({ aiConfigured: () => true }));
vi.mock("@/app/actions", () => ({ appliedAction: () => undefined, backToStepAction: () => undefined }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh() {}, push() {} }) }));
vi.mock("@/lib/career-safety", async (orig) => ({ ...(await orig<typeof import("@/lib/career-safety")>()), applicationSafety: () => ({ safe: true, issues: [] }) }));

const TODAY = "2026-10-25";
const NOW = new Date().toISOString(), OLD = "2026-01-01T00:00:00Z";
function job(id: string, title: string, company: string, extra: Record<string, unknown> = {}) {
  return { id, country: "BD", active: true, title, company, industry: null, category: null, location: "Dhaka", type: null, salaryMin: null, salaryMax: null, minYears: null, maxYears: null, seniority: null, education: null, required: ["SAP FICO", "IFRS"], preferred: ["Power BI"], certs: [], visa: null, deadline: "2026-11-05", publishedAt: "2026-10-23T00:00:00Z", apply: { method: "url", target: null }, url: null, source: "test", resp: [], addedAt: NOW, ...extra };
}
function scored(j: ReturnType<typeof job>, score: number) {
  const band = score >= 90 ? "ex" : score >= 80 ? "st" : score >= 70 ? "po" : "lo";
  return { job: j, m: { score, band, relevant: true, expired: false, matched: ["8 years in accounts", "IFRS reporting"], gaps: [{ t: "SAP FICO" }] } };
}
function state(): UserState {
  return {
    userId: "u1", country: "BD", homeCountry: "BD", today: TODAY, analysed: 1248,
    P: { name: "Md. Rahim Ahmed", skills: [{ name: "IFRS", src: "cv" }], targetRoles: ["Accounts Manager"], locations: [], salaryMin: null, notice: null, years: 8, seniority: "senior" },
    profile: { setup_steps: {}, answer_library: {}, deal_breakers: {}, personal: {}, preferences: null, needs_visa: false },
    master: { content: { improvements: [] } }, cvDoc: { answers: {} },
    scored: [
      scored(job("a", "Senior Accounts Manager", "Square Pharmaceuticals", { deadline: "2026-10-26" }), 94),
      scored(job("b", "Finance & Accounts Manager", "BSRM Group"), 91),
      scored(job("c", "Accounts Manager", "Pran-RFL Group"), 87),
      scored(job("d", "Head of Accounts", "Walton Hi-Tech", { required: ["VAT"] }), 76),
      scored(job("e", "Accounts Executive", "DBL Group", { addedAt: OLD }), 62),
    ],
    apps: { a: { id: "1", job_id: "a", status: "ready", pack: {}, created_at: "2026-10-24T00:00:00Z", updated_at: "2026-10-24T00:00:00Z", applied_at: null, reminder_date: null } },
    dismissed: new Set(), aiCheck: new Map(),
  } as unknown as UserState;
}

describe("career home", () => {
  beforeEach(() => { h.st = state(); h.sub = { plan_code: "pro", status: "active", current_period_end: "2026-11-12T00:00:00Z" }; h.allowance = { limits: { day: 2, week: 10, month: 40 }, used: { day: 1, week: 4, month: 11 }, left: 1, reason: null }; });

  it("shows fit bands in order, progress, best match and career guide", async () => {
    const { default: Inbox } = await import("./page");
    const html = renderToStaticMarkup(await Inbox());
    if (process.env.DUMP_HOME) writeFileSync(process.env.DUMP_HOME, html);
    expect(html).not.toContain("Your best opportunity right now");
    expect(html).not.toContain("Today we found");
    const order = ["Today", "Strong Fit", "Best Fit", "Good Fit", "Stretch &amp; others", "See your best match", "Career guide", "All time", "Ready to apply"].map((l) => html.indexOf(l));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((x, y) => x - y)).toEqual(order);
    for (const t of ["Welcome back", "Rahim", "Ready to apply", "Applied", "Interviewed", "Job offer", "Senior Accounts Manager", "Grow your matches", "SAP FICO", "AI applications left", "1 of 2", "Deadlines &amp; queue", "Jobs found", "Matched", ">1,248<", ">4<", ">1,244<", "100%"]) expect(html).toContain(t);
  });

  it("counts trial applications instead of AI packs when not on Pro", async () => {
    h.sub = { plan_code: "trial", status: "trialing", trial_ends_at: "2026-10-28T00:00:00Z" };
    const { default: Inbox } = await import("./page");
    const html = renderToStaticMarkup(await Inbox());
    expect(html).toContain("Free trial");
    expect(html).toContain("In trial");
    expect(html).toContain("5 of 5");
    expect(html).not.toContain("AI applications left");
  });

  it("counts the summary from the same scores as the opportunities list", async () => {
    const { default: Inbox } = await import("./page");
    const html = renderToStaticMarkup(await Inbox());
    const today = html.slice(html.indexOf("today-h"), html.indexOf("all-h"));
    expect(today).toMatch(/Good Fit<\/span><span[^>]*>70–79%<\/span><\/span><span[^>]*><b[^>]*>1<\/b>/);
    expect(today).toMatch(/<b>4<\/b>Jobs found/);
    expect(html).toMatch(/Good Fit<\/span><span[^>]*>1 job/);
    expect(html).toMatch(/Strong Fit<\/span><span[^>]*>2 jobs/);
  });
  it("leaves applications from an earlier search country out of the dashboard", async () => {
    const st = h.st as unknown as { apps: Record<string, unknown> };
    st.apps = { ...st.apps, old: { id: "9", job_id: "old", status: "interview", pack: {}, created_at: "2026-10-01T00:00:00Z", updated_at: "2026-10-01T00:00:00Z", applied_at: "2026-10-02T00:00:00Z", reminder_date: null, jobs: { country: "GB" } } };
    const { default: Inbox } = await import("./page");
    const html = renderToStaticMarkup(await Inbox());
    expect(html).toMatch(/Interviewed<\/span><span[^>]*>[^<]*<\/span><\/span><b[^>]*>0<\/b>/);
    expect(html).toMatch(/<b>0<\/b>Applied/);
  });
});
