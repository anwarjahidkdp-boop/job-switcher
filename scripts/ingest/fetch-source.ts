// Fetches one ingestion source and returns normalised jobs. Public data only:
//  - jsonld: a public careers page; robots.txt is checked first, our UA is identified, no cookies/login.
//  - greenhouse / lever: their documented public job-board JSON endpoints.
import { extractJobPostings, postingToJob } from "../../src/lib/ingest/jsonld";
import { greenhouseUrl, leverUrl, parseGreenhouse, parseLever, type IngestedJob } from "../../src/lib/ingest/ats";
import { BOT_UA, robotsAllows } from "../../src/lib/ingest/robots";
import { cc } from "../../src/lib/countries";

export interface SourceRow { id: string; kind: "jsonld" | "greenhouse" | "lever"; name: string; url: string | null; board_token: string | null; country: string; company: string | null }
export type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

const MAX_PAGE_BYTES = 3_000_000;

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

export async function fetchSource(src: SourceRow, today: string, fetcher: Fetcher = fetch): Promise<IngestedJob[]> {
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
  const url = src.kind === "greenhouse" ? greenhouseUrl(token) : leverUrl(token);
  const res = await get(fetcher, url, "application/json");
  if (!res.ok) throw new Error(`${src.kind} returned ${res.status}`);
  const json = JSON.parse(await readCapped(res));
  const ctx = { country, company: src.company || src.name, sourceLabel, today };
  return src.kind === "greenhouse" ? parseGreenhouse(json, ctx) : parseLever(json, ctx);
}

/** External ids that were active before but are no longer listed. */
export function staleIds(previous: string[], current: string[]): string[] {
  const now = new Set(current);
  return previous.filter((id) => !now.has(id));
}
