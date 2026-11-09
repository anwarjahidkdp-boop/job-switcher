import { describe, expect, it } from "vitest";
import { capUnwatchedRows, fetchSource, starterQueries, UK_STARTER_ROLES, staleIds, watchedCountry, type SourceRow } from "./fetch-source";

const page = `<html><script type="application/ld+json">{"@context":"https://schema.org","@type":"JobPosting","title":"Senior Accountant","hiringOrganization":{"name":"Example Ltd."},"jobLocation":{"address":{"addressLocality":"Dhaka","addressCountry":"BD"}},"description":"<p>3+ years. Skills: Excel, VAT, IFRS.</p>","datePosted":"2026-10-01","validThrough":"2026-11-01","identifier":{"value":"A-1"}}</script></html>`;
const src: SourceRow = { id: "s1", kind: "jsonld", name: "Example careers", url: "https://example.com/careers", board_token: null, country: "BD", company: "Example Ltd." };

function fakeFetch(map: Record<string, [number, string]>) {
  const seen: { url: string; ua: string | null }[] = [];
  const f = async (url: string, init?: RequestInit) => {
    seen.push({ url, ua: new Headers(init?.headers).get("user-agent") });
    const [status, body] = map[url] || [404, ""];
    return new Response(body, { status });
  };
  return { f, seen };
}

describe("fetchSource", () => {
  it("reads JSON-LD when robots.txt allows, with our UA", async () => {
    const { f, seen } = fakeFetch({ "https://example.com/robots.txt": [200, "User-agent: *\nDisallow: /admin"], "https://example.com/careers": [200, page] });
    const jobs = await fetchSource(src, "2026-10-17", f);
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({ title: "Senior Accountant", company: "Example Ltd.", country: "BD", externalId: "A-1", deadline: "2026-11-01" });
    expect(seen.every((s) => s.ua?.startsWith("JobPaoBot"))).toBe(true);
  });
  it("refuses pages disallowed by robots.txt", async () => {
    const { f, seen } = fakeFetch({ "https://example.com/robots.txt": [200, "User-agent: *\nDisallow: /careers"], "https://example.com/careers": [200, page] });
    await expect(fetchSource(src, "2026-10-17", f)).rejects.toThrow(/robots/);
    expect(seen.map((s) => s.url)).not.toContain("https://example.com/careers");
  });
  it("skips when robots.txt errors", async () => {
    const { f } = fakeFetch({ "https://example.com/robots.txt": [503, ""] });
    await expect(fetchSource(src, "2026-10-17", f)).rejects.toThrow(/503/);
  });
  it("uses the public Greenhouse endpoint", async () => {
    const gh = { jobs: [{ id: 7, title: "Data Analyst", absolute_url: "https://boards.greenhouse.io/x/jobs/7", location: { name: "Dhaka, Bangladesh" }, content: "&lt;p&gt;SQL and Excel&lt;/p&gt;" }] };
    const { f, seen } = fakeFetch({ "https://boards-api.greenhouse.io/v1/boards/x/jobs?content=true": [200, JSON.stringify(gh)] });
    const jobs = await fetchSource({ ...src, kind: "greenhouse", url: null, board_token: "x" }, "2026-10-17", f);
    expect(seen[0].url).toContain("boards-api.greenhouse.io");
    expect(jobs[0]).toMatchObject({ title: "Data Analyst", externalId: "gh:7" });
  });
  it("finds stale ids", () => {
    expect(staleIds(["a", "b", "c"], ["b"])).toEqual(["a", "c"]);
  });
});

it("discovers only configured same-origin job pages and drops expired postings",async()=>{
 const {f,seen}=fakeFetch({"https://example.com/robots.txt":[404,""],"https://example.com/careers":[200,'<a href="/jobs/one">one</a><a href="https://other.invalid/jobs/two">two</a><a href="/admin">admin</a><a href="/jobs/old">old</a>'],"https://example.com/jobs/one":[200,page],"https://example.com/jobs/old":[200,page.replace('2026-11-01','2026-10-01')]});
 const jobs=await fetchSource({...src,detail_path:"/jobs/"},"2026-10-22",f);
 expect(jobs).toHaveLength(1);expect(jobs[0].url).toBe("https://example.com/jobs/one");expect(seen).toHaveLength(4);
});
it("fails closed on a malformed success payload",async()=>{
 const {f}=fakeFetch({"https://boards-api.greenhouse.io/v1/boards/x/jobs?content=true":[200,'{"error":"unknown company"}']});
 await expect(fetchSource({...src,kind:"greenhouse",board_token:"x"},"2026-10-22",f)).rejects.toThrow("Invalid greenhouse payload");
});
it("does not publish a partial listing when one detail page fails",async()=>{
 const {f}=fakeFetch({"https://example.com/robots.txt":[404,""],"https://example.com/careers":[200,'<a href="/jobs/broken">broken</a>'],"https://example.com/jobs/broken":[503,""]});
 await expect(fetchSource({...src,detail_path:"/jobs/"},"2026-10-22",f)).rejects.toThrow("503");
});

describe("database clean-up", () => {
  it("keeps closed jobs in searched countries and remote jobs, and lets the rest go early", () => {
    const targeted = new Set(["BD", "GB"]);
    expect(watchedCountry("BD", targeted)).toBe(true);
    expect(watchedCountry("XX", targeted)).toBe(true);
    expect(watchedCountry("US", targeted)).toBe(false);
  });
});

describe("open jobs in countries nobody searches", () => {
  const watched = (c: string) => watchedCountry(c, new Set(["BD", "GB"]));
  const row = (country: string, external_id: string) => ({ country, external_id });
  it("always saves searched countries and remote jobs", () => {
    const rows = [row("GB", "a"), row("XX", "b"), row("BD", "c")];
    expect(capUnwatchedRows(rows, watched, new Map([["GB", 5000]]), new Set(), 1)).toEqual(rows);
  });
  it("adds new listings only up to the cap and keeps refreshing stored ones", () => {
    const stored = new Map([["US", 1]]);
    const out = capUnwatchedRows([row("US", "old"), row("US", "n1"), row("US", "n2"), row("DE", "d1"), row("DE", "d2")], watched, stored, new Set(["old"]), 2);
    expect(out.map((r) => r.external_id)).toEqual(["old", "n1", "d1", "d2"]);
    expect(stored.get("US")).toBe(2);
    expect(stored.get("DE")).toBe(2);
  });
});

describe("UK starter searches on Reed", () => {
  const hour = 3_600_000, day = 24 * hour;
  it("covers every role across the UK morning, midday and evening scans", () => {
    for (const d of [20400, 20401, 20500]) {
      const seen = new Set<string>();
      for (const h of [6, 11, 20]) starterQueries(UK_STARTER_ROLES, d * day + h * hour).forEach((r) => seen.add(r));
      expect(seen.size).toBe(UK_STARTER_ROLES.length);
    }
    expect(starterQueries(UK_STARTER_ROLES, 0)).toHaveLength(8);
    expect(starterQueries([], 0)).toEqual([]);
  });
});
