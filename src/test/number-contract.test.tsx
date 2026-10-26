// Number contract: every number on Home links to a list, and that list must hold exactly that many items.
// Home, /opportunities and /applications read the same state here, so any change that makes a number and its list
// disagree (a new filter, a different rule, a second source) turns this test red before it can ship.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { UserState } from "@/lib/server/state";

const H = 3_600_000, D = 24 * H;
const NOW = Date.now();
const iso = (t: number) => new Date(t).toISOString();
const JOINED = NOW - 30 * H;

const h = vi.hoisted(() => ({ st: null as unknown as UserState, cookie: undefined as string | undefined }));
vi.mock("@/lib/server/page", () => ({ requireAppState: async () => ({ st: h.st, db: {} }), subscriptionOf: async () => ({ data: { plan_code: "free", status: "trialing", trial_ends_at: iso(NOW + 4 * D) } }) }));
// Jobs checked in the database: everything since joining, 4 more than the page loads; 3 added after a later window start.
vi.mock("@/lib/server/state", async (orig) => ({
  ...(await orig<typeof import("@/lib/server/state")>()),
  loadJob: async () => undefined,
  countFoundSince: async (_db: unknown, st: { analysed: number }, since: Date) => (since.getTime() <= JOINED ? st.analysed : 3),
}));
vi.mock("@/lib/server/applications", () => ({ packAllowanceFor: async () => null }));
vi.mock("@/lib/server/notify", () => ({ listNotifications: async () => [] }));
vi.mock("@/lib/server/career-reports", () => ({ latestCareerReports: async () => [] }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));
vi.mock("@/lib/ai", () => ({ aiConfigured: () => true }));
vi.mock("@/app/actions", () => ({ appliedAction: () => undefined, backToStepAction: () => undefined }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh() {}, push() {} }), usePathname: () => "/inbox" }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => (h.cookie ? { value: h.cookie } : undefined) }) }));

function job(id: string, added: number, country = "BD") {
  return { id, country, active: true, title: `Job ${id}`, company: `Co ${id}`, industry: null, category: null, location: "Dhaka", type: null, salaryMin: null, salaryMax: null, minYears: null, maxYears: null, seniority: null, education: null, required: ["IFRS"], preferred: [], certs: [], visa: null, deadline: null, publishedAt: null, apply: { method: "url", target: null }, url: null, source: "test", resp: [], addedAt: iso(added), foundAt: iso(Math.max(added, JOINED)) };
}
function scored(id: string, score: number, added: number, relevant = true) {
  return { job: job(id, added), m: { score, band: score >= 90 ? "ex" : score >= 80 ? "st" : score >= 70 ? "po" : "lo", relevant, expired: false, matched: [], gaps: [], f: { role: 1, skills: 0.5, exp: 1 } } };
}
function app(id: string, job_id: string, status: string, applied: number | null, extra: Record<string, unknown> = {}) {
  return { id, job_id, status, pack: {}, created_at: iso(NOW - 5 * D), updated_at: iso(NOW - H), applied_at: applied == null ? null : iso(applied), reminder_date: null, jobs: { country: "BD" }, application_events: [], ...extra };
}
function state(): UserState {
  // Old jobs (before joining) and new ones (after), every fit group, one outside the field.
  const rows = [scored("a", 96, NOW - 9 * D), scored("b", 91, NOW - 2 * H), scored("c", 85, NOW - 5 * D), scored("d", 82, NOW - H), scored("e", 74, NOW - 3 * D), scored("f", 60, NOW - 2 * H), scored("g", 99, NOW - 4 * D, false), scored("h", 77, NOW - 20 * H)];
  return {
    userId: "u1", country: "BD", homeCountry: "BD", today: iso(NOW).slice(0, 10), analysed: rows.length + 4,
    P: { name: "Rahim Ahmed", titles: ["Accounts Manager"], currentTitle: "Accounts Manager", currentCompany: "Co", industries: [], categories: ["accounting"], education: [], certs: [], skills: [], targetRoles: ["Accounts Manager"], locations: [], country: "BD", salaryMin: null, salaryMax: null, notice: null, years: 8, seniority: "senior" },
    profile: { created_at: iso(JOINED), setup_steps: {}, answer_library: {}, deal_breakers: {}, personal: {}, preferences: null, needs_visa: false },
    master: { content: { improvements: [] } }, cvDoc: { answers: {} },
    scored: rows,
    apps: {
      c: app("1", "c", "applied", NOW - 3 * H),
      e: app("2", "e", "interview", NOW - 20 * H, { interview_at: iso(NOW + D) }),
      h: app("3", "h", "offer", NOW - 25 * H, { application_events: [{ event: "status", status: "interview", actor: "user", created_at: iso(NOW - 10 * H) }] }),
      d: app("4", "d", "ready", null),
      x: app("5", "x", "applied", NOW - 2 * H, { jobs: { country: "GB" } }),
    },
    dismissed: new Set(), aiCheck: new Map(),
  } as unknown as UserState;
}

const query = (href: string) => Object.fromEntries(new URL(href.replace(/&amp;/g, "&"), "https://jobpao.app").searchParams);
async function listSize(href: string): Promise<number> {
  const path = new URL(href.replace(/&amp;/g, "&"), "https://jobpao.app").pathname;
  if (path === "/opportunities") {
    const { default: Page } = await import("@/app/(app)/opportunities/page");
    const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve(query(href)) }));
    const shown = (html.match(/class="opp"/g) || []).length;
    const more = Number((html.match(/We also checked ([\d,]+) more/) || [, "0"])[1]!.replace(/,/g, ""));
    const head = Number((html.match(/([\d,]+) jobs?\./) || [, "-1"])[1]!.replace(/,/g, ""));
    expect(head, `${href}: page header`).toBe(shown + more);
    return shown + more;
  }
  if (path === "/applications") {
    const { default: Page } = await import("@/app/(app)/applications/page");
    const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve(query(href)) }));
    const list = html.split("Earlier search country")[0];
    return (list.match(/class="applied-job-card"/g) || []).length;
  }
  throw new Error(`no list check for ${href}`);
}

/** Every Home link that carries a number: [href, number]. */
function numberLinks(html: string): [string, number][] {
  const out: [string, number][] = [];
  for (const m of html.matchAll(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)) {
    const n = m[2].match(/<b[^>]*>([\d,]+)<\/b>/);
    if (n && /^\/(opportunities|applications)\b/.test(m[1])) out.push([m[1], Number(n[1].replace(/,/g, ""))]);
  }
  return out;
}

describe("every number on Home equals the list it opens", () => {
  beforeEach(() => { h.st = state(); h.cookie = undefined; });
  const check = async () => {
    const { default: Inbox } = await import("@/app/(app)/inbox/page");
    const links = numberLinks(renderToStaticMarkup(await Inbox()));
    expect(links.length).toBeGreaterThanOrEqual(14);
    for (const [href, n] of links) expect(await listSize(href), href).toBe(n);
    return links;
  };
  it("on a new account's first visit (briefing = everything since joining = lifetime)", async () => {
    const links = await check();
    const found = links.filter(([href]) => href.includes("fit=found")).map(([, n]) => n);
    expect(found).toEqual([12, 12]);
    // The list's "Opportunity Briefing" switch opens the very same window as Home's briefing numbers.
    const { default: Page } = await import("@/app/(app)/opportunities/page");
    const list = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ fit: "found" }) }));
    const sw = list.match(/href="([^"]+)"[^>]*>Opportunity Briefing</)?.[1];
    expect(links.map(([href]) => href)).toContain(sw);
  });
  it("on a later visit (briefing = only what was found since then)", async () => {
    const prev = NOW - 6 * H, last = NOW - 5 * H;
    h.cookie = `${prev}.${last}.u1`;
    const links = await check();
    expect(links.find(([href]) => href.includes("fit=found") && href.includes("since="))?.[1]).toBe(3);
  });
});

describe("every number on Insights equals the list it opens", () => {
  beforeEach(() => { h.st = state(); h.cookie = undefined; });
  it("fit tiles match Home's lifetime cards and their lists", async () => {
    const { default: Insights } = await import("@/app/(app)/insights/page");
    const html = renderToStaticMarkup(await Insights());
    const tiles = [...html.matchAll(/aria-label="(\d+) [^"]+: see the jobs" href="([^"]+)"/g)].map((m) => [m[2], Number(m[1])] as const);
    expect(tiles.length).toBe(5);
    for (const [href, n] of tiles) expect(await listSize(href), href).toBe(n);
  });
});

describe("a list row's label agrees with the group it is counted in", () => {
  beforeEach(() => { h.st = state(); h.cookie = undefined; });
  it("a 99% job outside the field sits in Stretch & others and is not called Strong Fit", async () => {
    const { default: Page } = await import("@/app/(app)/opportunities/page");
    const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ fit: "rest" }) }));
    const g = html.slice(html.indexOf('href="/jobs/g"'));
    expect(g.slice(0, g.indexOf("</a>"))).toContain("Outside your field");
    expect(g.slice(0, g.indexOf("</a>"))).not.toContain("Strong Fit");
  });
});
