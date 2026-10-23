// Fetches one ingestion source and returns normalised jobs. Public data only:
//  - jsonld: a public careers page; robots.txt is checked first, our UA is identified, no cookies/login.
//  - greenhouse / lever / ashby / smartrecruiters / workable / recruitee: public job-board JSON that companies
//    publish for job boards to read.
//  - remotive / arbeitnow: free public job APIs. adzuna / jooble / reed (UK): job-search APIs with a free key (env), queried with
//    the roles our users are looking for (`queries`).
import { extractJobPostings, postingToJob } from "../../src/lib/ingest/jsonld";
import { ADZUNA_COUNTRIES, adzunaUrl, arbeitnowUrl, ashbyUrl, joobleLocation, parseAdzuna, parseArbeitnow, parseAshby, parseJooble, parseRecruitee, parseReed, parseRemotive, parseSmartRecruiters, parseWorkable, recruiteeUrl, reedUrl, remotiveUrl, smartRecruitersUrl, workableUrl } from "../../src/lib/ingest/boards";
import { greenhouseUrl, leverUrl, parseGreenhouse, parseLever, type IngestedJob } from "../../src/lib/ingest/ats";
import { BOT_UA, robotsAllows } from "../../src/lib/ingest/robots";
import {BRAC_API,parseBrac} from "../../src/lib/ingest/brac";
import { cc } from "../../src/lib/countries";

export type SourceKind = "jsonld" | "greenhouse" | "lever" | "ashby" | "smartrecruiters" | "workable" | "recruitee" | "remotive" | "arbeitnow" | "adzuna" | "jooble" | "reed" | "brac" | "bdweb";
export interface SourceRow { id: string; kind: SourceKind; name: string; url: string | null; board_token: string | null; country: string; company: string | null; detail_path?: string | null; cursor_url?: string | null }
export type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

const MAX_PAGE_BYTES = 15_000_000; // big boards (hundreds of jobs with full descriptions) run to several MB

async function get(fetcher: Fetcher, url: string, accept: string): Promise<Response> {
  return fetcher(url, { headers: { "user-agent": BOT_UA, accept }, redirect: "follow", signal: AbortSignal.timeout(20_000) });
}

async function readCapped(res: Response): Promise<string> {
 const len=Number(res.headers.get("content-length")||0);
 if(len>MAX_PAGE_BYTES)throw new Error("Response too large");
 if(!res.body)return "";
 const reader=res.body.getReader();const chunks:Uint8Array[]=[];let size=0;
 try {for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;
  if(size>MAX_PAGE_BYTES){await reader.cancel();throw new Error("Response too large");}chunks.push(value);
 }}finally{reader.releaseLock();}
 return Buffer.concat(chunks).toString("utf8");
}

/** Only configured, same-origin job links; no guessing tokens or following arbitrary links. */
export function detailLinks(html:string,pageUrl:string,path:string) {
 const page=new URL(pageUrl);const urls=new Set<string>();
 for(const m of html.matchAll(/<a\b[^>]*\bhref\s*=\s*["']([^"']+)["']/gi)){
  try {const u=new URL(m[1].replace(/&amp;/g,"&"),page);u.hash="";
   if(u.protocol==="https:"&&u.origin===page.origin&&u.pathname.startsWith(path)&&u.href!==page.href&&!u.username&&!u.password)urls.add(u.href);
  }catch{/* not a URL */}
 }
 if(urls.size>MAX_DETAILS)throw new Error(`Listing exceeds ${MAX_DETAILS} detail pages; configure a paginated adapter`);
 return [...urls];
}

export async function fetchSource(src: SourceRow, today: string, fetcher: Fetcher = fetch, opts: { queries?: string[]; env?: Record<string, string | undefined> } = {}): Promise<IngestedJob[]> {
  const country = cc(src.country);
  const sourceLabel = src.name;
  if (src.kind === "jsonld") {
    if (!src.url || !/^https:\/\//i.test(src.url)) throw new Error("jsonld source needs an https URL");
    const u = new URL(src.url);
    const robots = await get(fetcher, `${u.origin}/robots.txt`, "text/plain");
    let rules="";
    if(robots.ok)rules=await readCapped(robots);
    else if(robots.status!==404&&robots.status!==410)throw new Error(`robots.txt returned ${robots.status}; skipping to be safe`);
    const readPage=async(url:string)=>{
      const target=new URL(url);
      if(!robotsAllows(rules,target.pathname+target.search))throw new Error("robots.txt disallows this page");
      const res=await get(fetcher,url,"text/html");
      if(!res.ok)throw new Error(`Page returned ${res.status}`);
      if(res.url&&new URL(res.url).origin!==u.origin)throw new Error("Career page redirected off origin");
      return readCapped(res);
    };
    const html=await readPage(src.url);
    const pages=[{url:src.url,html}];
    if(src.detail_path)for(const url of detailLinks(html,src.url,src.detail_path))pages.push({url,html:await readPage(url)});
    const jobs=pages.flatMap(p=>extractJobPostings(p.html).map(posting=>postingToJob(posting,{country,companyFallback:src.company,sourceLabel,pageUrl:p.url,today}))).filter((j):j is NonNullable<typeof j>=>!!j);
    return dedupe(jobs.filter(j=>!j.deadline||j.deadline>=today));
  }

  if(src.kind==="brac"){
    const out:IngestedJob[]=[];let next:string|null=`${BRAC_API}?limit=100&offset=0`;
    for(let page=0;next;page++){
      if(page>=20)throw new Error("BRAC listing exceeds safe page limit");
      if(!next.startsWith(BRAC_API))throw new Error("BRAC pagination left the public listing API");
      const res=await get(fetcher,next,"application/json");if(!res.ok)throw new Error(`BRAC returned ${res.status}`);
      const data=JSON.parse(await readCapped(res));out.push(...parseBrac(data,today));
      next=data.next?String(data.next):null;
    }
    return dedupe(out);
  }
  const token = src.board_token || "";
  if (!token) throw new Error("board_token is required");
  const ctx = { country, company: src.company || src.name, sourceLabel, today };
  const json = async (url: string, init?: RequestInit) => {
    const res = init ? await fetcher(url, { ...init, headers: { "user-agent": BOT_UA, accept: "application/json", "content-type": "application/json" } }) : await get(fetcher, url, "application/json");
    if (!res.ok) throw new Error(`${src.kind} returned ${res.status}`);
    const data=JSON.parse(await readCapped(res));
    const field=({greenhouse:"jobs",ashby:"jobs",workable:"jobs",recruitee:"offers",smartrecruiters:"content",remotive:"jobs",arbeitnow:"data",adzuna:"results",jooble:"jobs"} as Record<string,string>)[src.kind];
    if(src.kind==="lever"&&!Array.isArray(data))throw new Error("Invalid lever payload");
    if(field&&!Array.isArray(data?.[field])&&!(src.kind==="smartrecruiters"&&url.includes("/postings/")))throw new Error(`Invalid ${src.kind} payload: missing ${field}`);
    return data;
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
    case "reed": {
      const key = env.REED_API_KEY;
      if (!key) throw new Error("REED_API_KEY not set");
      const auth = { headers: { authorization: "Basic " + Buffer.from(key + ":").toString("base64"), "user-agent": BOT_UA, accept: "application/json" } };
      const out: IngestedJob[] = [];
      for (const q of queries.length ? queries : [""]) {
        for (let skip = 0; skip < (q ? 100 : 300); skip += 100) {
          const res = await fetcher(reedUrl(q, skip), auth);
          if (!res.ok) throw new Error(`reed returned ${res.status}`);
          const page = parseReed(JSON.parse(await readCapped(res)), ctx);
          out.push(...page);
          if (page.length < 100) break;
        }
      }
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
