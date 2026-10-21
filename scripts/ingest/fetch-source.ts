// Fetches one ingestion source and returns normalised jobs. Public data only:
//  - jsonld: a public careers page; robots.txt is checked first, our UA is identified, no cookies/login.
//  - greenhouse / lever / ashby / smartrecruiters / workable / recruitee: public job-board JSON that companies
//    publish for job boards to read.
//  - remotive / arbeitnow: free public job APIs. adzuna / jooble: job-search APIs with a free key (env), queried with
//    the roles our users are looking for (`queries`).
import { extractJobPostings, postingToJob } from "../../src/lib/ingest/jsonld";
import { ADZUNA_COUNTRIES, adzunaUrl, arbeitnowUrl, ashbyUrl, joobleLocation, parseAdzuna, parseArbeitnow, parseAshby, parseJooble, parseRecruitee, parseRemotive, parseSmartRecruiters, parseWorkable, recruiteeUrl, remotiveUrl, smartRecruitersUrl, workableUrl } from "../../src/lib/ingest/boards";
import { greenhouseUrl, leverUrl, parseGreenhouse, parseLever, type IngestedJob } from "../../src/lib/ingest/ats";
import { BOT_UA, robotsAllows } from "../../src/lib/ingest/robots";
import { cc } from "../../src/lib/countries";

export type SourceKind = "jsonld" | "greenhouse" | "lever" | "ashby" | "smartrecruiters" | "workable" | "recruitee" | "remotive" | "arbeitnow" | "adzuna" | "jooble";
export interface SourceRow { id: string; kind: SourceKind; name: string; url: string | null; board_token: string | null; country: string; company: string | null }
export type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

const MAX_PAGE_BYTES = 15_000_000; // big boards (hundreds of jobs with full descriptions) run to several MB

async function get(fetcher: Fetcher, url: string, accept: string): Promise<Response> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 20_000);
  try {
    return await fetcher(url, { headers: { "user-agent": BOT_UA, accept }, redirect: "follow", signal: ctl.signal });
  } finally { clearTimeout(t); }
}

async function readCapped(res: Response): Promise<string> {
  const len = Number(res.headers.get("content-length") || 0);
  if (len > MAX_PAGE_BYTES) throw new Error(`Response too large (${len} bytes)`);
  const text = await res.text();
  if (text.length > MAX_PAGE_BYTES) throw new Error("Response too large");
  return text;
}

export async function fetchSource(src: SourceRow, today: string, fetcher: Fetcher = fetch, opts: { queries?: string[]; env?: Record<string, string | undefined> } = {}): Promise<IngestedJob[]> {
  const country = cc(src.country);
  const sourceLabel = src.name;
  if (src.kind === "jsonld") {
    if (!src.url || !/^https:\/\//i.test(src.url)) throw new Error("jsonld source needs an https URL");
    const u = new URL(src.url);
    const robots = await get(fetcher, `${u.origin}/robots.txt`, "text/plain");
    if (robots.ok) {
      if (!robotsAllows(await readCapped(robots), u.pathname + u.search)) throw new Error("robots.txt disallows this page");
    } else if (robots.status !== 404 && robots.status !== 410) throw new Error(`robots.txt returned ${robots.status}; skipping to be safe`);
    const res = await get(fetcher, src.url, "text/html");
    if (!res.ok) throw new Error(`Page returned ${res.status}`);
    const html = await readCapped(res);
    return extractJobPostings(html)
      .map((p) => postingToJob(p, { country, companyFallback: src.company, sourceLabel, pageUrl: src.url!, today }))
      .filter((j): j is NonNullable<typeof j> => !!j);
  }
  const token = src.board_token || "";
  if (!token) throw new Error("board_token is required");
  const ctx = { country, company: src.company || src.name, sourceLabel, today };
  const json = async (url: string, init?: RequestInit) => {
    const res = init ? await fetcher(url, { ...init, headers: { "user-agent": BOT_UA, accept: "application/json", "content-type": "application/json" } }) : await get(fetcher, url, "application/json");
    if (!res.ok) throw new Error(`${src.kind} returned ${res.status}`);
    return JSON.parse(await readCapped(res));
  };
  const env = opts.env || process.env;
  const queries = [...new Set((opts.queries || []).map((q) => q.trim()).filter(Boolean))].slice(0, MAX_QUERIES);
  switch (src.kind) {
    case "greenhouse": return parseGreenhouse(await json(greenhouseUrl(token)), ctx);
    case "lever": return parseLever(await json(leverUrl(token)), ctx);
    case "ashby": return parseAshby(await json(ashbyUrl(token)), ctx);
    case "workable": return parseWorkable(await json(workableUrl(token)), ctx);
    case "recruitee": return parseRecruitee(await json(recruiteeUrl(token)), ctx);
    case "smartrecruiters": {
      const list = await json(smartRecruitersUrl(token));
      const ids: string[] = ((list?.content || []) as { id: string }[]).map((p) => p.id).slice(0, MAX_DETAILS);
      const details: Record<string, unknown> = {};
      for (const id of ids) { try { details[id] = await json(`https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(token)}/postings/${encodeURIComponent(id)}`); } catch { /* listing data is enough */ } }
      return parseSmartRecruiters(list, details, ctx);
    }
    case "remotive": return parseRemotive(await json(remotiveUrl(token === "all" ? "" : token)), ctx);
    case "arbeitnow": {
      const out: IngestedJob[] = [];
      for (let page = 1; page <= 3; page++) out.push(...parseArbeitnow(await json(arbeitnowUrl(page)), ctx));
      return out;
    }
    case "adzuna": {
      const id = env.ADZUNA_APP_ID, key = env.ADZUNA_APP_KEY, where = ADZUNA_COUNTRIES[country];
      if (!id || !key) throw new Error("ADZUNA_APP_ID / ADZUNA_APP_KEY not set");
      if (!where) throw new Error(`Adzuna does not cover ${country}`);
      const out: IngestedJob[] = [];
      for (const q of queries.length ? queries : [""]) for (let page = 1; page <= (q ? 1 : 3); page++) out.push(...parseAdzuna(await json(adzunaUrl(where, id, key, page, q)), ctx));
      return dedupe(out);
    }
    case "jooble": {
      const key = env.JOOBLE_API_KEY;
      if (!key) throw new Error("JOOBLE_API_KEY not set");
      const out: IngestedJob[] = [];
      for (const q of queries.length ? queries : [""]) out.push(...parseJooble(await json(`https://jooble.org/api/${encodeURIComponent(key)}`, { method: "POST", body: JSON.stringify({ keywords: q, location: joobleLocation(country), page: 1 }) }), ctx));
      return dedupe(out);
    }
    default: throw new Error(`Unknown source kind ${src.kind}`);
  }
}

const MAX_QUERIES = 12;
const MAX_DETAILS = 60;
const dedupe = (jobs: IngestedJob[]) => [...new Map(jobs.map((j) => [j.externalId, j])).values()];

/** External ids that were active before but are no longer listed. */
export function staleIds(previous: string[], current: string[]): string[] {
  const now = new Set(current);
  return previous.filter((id) => !now.has(id));
}
