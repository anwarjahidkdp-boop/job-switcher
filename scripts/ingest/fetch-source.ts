// Fetches one ingestion source and returns normalised jobs. Public data only:
//  - jsonld: a public careers page; robots.txt is checked first, our UA is identified, no cookies/login.
//  - greenhouse / lever / ashby / smartrecruiters / workable / recruitee: public job-board JSON that companies
//    publish for job boards to read.
//  - remotive / arbeitnow: free public job APIs. adzuna / jooble / reed (UK): job-search APIs with a free key (env), queried with
//    the roles our users are looking for (`queries`).
import { extractJobPostings, postingToJob } from "../../src/lib/ingest/jsonld";
import { ADZUNA_COUNTRIES, adzunaUrl, arbeitnowUrl, ashbyUrl, joobleLocation, parseAdzuna, parseArbeitnow, parseAshby, parseJooble, parseRecruitee, parseReed, reedDetailsUrl, reedSnippet, type ReedJob, parseRemotive, parseSmartRecruiters, parseWorkable, recruiteeUrl, reedUrl, remotiveUrl, smartRecruitersUrl, workableUrl } from "../../src/lib/ingest/boards";
import { greenhouseUrl, leverUrl, parseGreenhouse, parseLever, type IngestedJob } from "../../src/lib/ingest/ats";
import { BOT_UA, robotsAllows } from "../../src/lib/ingest/robots";
import {BRAC_API,parseBrac} from "../../src/lib/ingest/brac";
import { cc, type CountryCode } from "../../src/lib/countries";

export type SourceKind = "jsonld" | "greenhouse" | "lever" | "ashby" | "smartrecruiters" | "workable" | "recruitee" | "remotive" | "arbeitnow" | "adzuna" | "jooble" | "reed" | "brac" | "bdweb";
export interface SourceRow { id: string; kind: SourceKind; name: string; url: string | null; board_token: string | null; country: string; company: string | null; detail_path?: string | null; cursor_url?: string | null; last_status?: string | null; last_error?: string | null; last_run_at?: string | null; jobs_found?: number | null }
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

export async function fetchSource(src: SourceRow, today: string, fetcher: Fetcher = fetch, opts: { queries?: string[]; maxQueries?: number; env?: Record<string, string | undefined>; reedKnown?: ReedKnown } = {}): Promise<IngestedJob[]> {
  const country = cc(src.country);
  const sourceLabel = src.name;
  // "Company@bd" reads a global employer's board for its jobs in one country only (e.g. a multinational's Bangladesh office).
  // Those jobs are placed by their own stated location, never by the source's country, so a remote or foreign role is not let in.
  const [token, onlyIn = ""] = (src.board_token || "").split("@");
  const only = onlyIn ? cc(onlyIn) : null;
  if (onlyIn && only !== onlyIn.toUpperCase()) throw new Error(`Unknown country filter "${onlyIn}"`);
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
    const jobs=pages.flatMap(p=>extractJobPostings(p.html).map(posting=>postingToJob(posting,{country:only?"XX":country,companyFallback:src.company,sourceLabel,pageUrl:p.url,today}))).filter((j):j is NonNullable<typeof j>=>!!j&&(!only||j.country===only));
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
  if (!token) throw new Error("board_token is required");
  const ctx = { country: only ? "XX" as CountryCode : country, company: src.company || src.name, sourceLabel, today };
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
  const queries = [...new Set((opts.queries || []).map((q) => q.trim()).filter(Boolean))].slice(0, opts.maxQueries ?? MAX_QUERIES);
  const jobs = await readBoard();
  return only ? jobs.filter((j) => j.country === only) : jobs;
  async function readBoard(): Promise<IngestedJob[]> {
  switch (src.kind) {
    case "greenhouse": return parseGreenhouse(await json(greenhouseUrl(token)), ctx);
    case "lever": return parseLever(await json(leverUrl(token)), ctx);
    case "ashby": return parseAshby(await json(ashbyUrl(token)), ctx);
    case "workable": return parseWorkable(await json(workableUrl(token)), ctx);
    case "recruitee": return parseRecruitee(await json(recruiteeUrl(token)), ctx);
    case "smartrecruiters": {
      const list = await json(smartRecruitersUrl(token) + (only ? `&country=${only.toLowerCase()}` : ""));
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
      const found = new Map<string, ReedJob>();
      for (const q of queries.length ? queries : [""]) {
        for (let skip = 0; skip < (q ? 100 : 300); skip += 100) {
          const res = await fetcher(reedUrl(q, skip), auth);
          if (!res.ok) throw new Error(`reed returned ${res.status}`);
          const page = ((JSON.parse(await readCapped(res)) as { results?: ReedJob[] })?.results || []).filter((j) => j && j.jobTitle);
          for (const j of page) found.set(String(j.jobId), j);
          if (page.length < 100) break;
        }
      }
      // Search results carry only the first lines of each advert, so requirements went unread and documents were written
      // from a summary. Reuse full text already stored; fetch the rest one by one, a capped number per run.
      const results = [...found.values()];
      const known = opts.reedKnown ? await opts.reedKnown(results.map((j) => "reed:" + j.jobId)) : new Map<string, string>();
      let fetched = 0;
      for (const j of results) {
        const stored = known.get("reed:" + j.jobId);
        if (stored && !reedSnippet(stored)) { j.jobDescription = stored; continue; }
        if (!reedSnippet(j.jobDescription) || fetched >= REED_DETAILS_PER_RUN) continue;
        fetched++;
        try {
          const res = await fetcher(reedDetailsUrl(j.jobId), auth);
          if (!res.ok) { if (res.status === 429) fetched = REED_DETAILS_PER_RUN; continue; }
          const full = (JSON.parse(await readCapped(res)) as { jobDescription?: string })?.jobDescription;
          if (full && full.length > (j.jobDescription || "").length) j.jobDescription = full;
        } catch { /* the summary is still usable */ }
      }
      return dedupe(parseReed({ results }, ctx));
    }
    default: throw new Error(`Unknown source kind ${src.kind}`);
  }
  }
}

export const MAX_QUERIES = 12;
/** Reed adverts read in full per run (one API call each). Hourly runs cover a day's new UK jobs. */
export const REED_DETAILS_PER_RUN = 150;
/** Descriptions already stored for these external ids (full ones are reused instead of fetched again). */
export type ReedKnown = (externalIds: string[]) => Promise<Map<string, string>>;
const MAX_DETAILS = 60;
const dedupe = (jobs: IngestedJob[]) => [...new Map(jobs.map((j) => [j.externalId, j])).values()];

/** External ids that were active before but are no longer listed. */
/** Sources that list a company's whole board on every fetch: a job missing from the list has closed. */
export const FULL_BOARDS = ["greenhouse", "lever", "ashby", "workable", "recruitee"];
/** Feeds and search APIs only show recent posts and never say a job closed: unseen this long, a job without a deadline counts as closed. */
export const UNSEEN_CLOSE_DAYS = 10;
/** Closed jobs in a country nobody searches (remote "XX" jobs excepted) are no use to anyone and are deleted after this many days. */
export const UNWATCHED_PRUNE_DAYS = 2;
/**
 * Closed jobs everywhere else are deleted after this many days. Users only ever see open jobs, so no list or count moves;
 * a job someone started an application for is never deleted. 7 days keeps the database at a steady size (~1,000 new jobs a day).
 */
export const CLOSED_KEEP_DAYS = 7;
/** Country codes from PAUSED_MARKETS ("BD", "BD, IN"); "none" or empty pauses nothing. */
export const pausedMarkets = (v: string | undefined): Set<string> =>
  new Set((v || "").split(",").map((c) => c.trim().toUpperCase()).filter((c) => /^[A-Z]{2}$/.test(c)));
export const watchedCountry = (country: string, targeted: Set<string>) => country === "XX" || targeted.has(country);
/**
 * Everyday UK roles searched on Reed beside what users ask for, so a UK visitor in any career finds jobs from day one
 * (UK-first launch, owner 2026-11-11: every category of user must get plenty of jobs). A third of them are searched per
 * run (starterQueries): the UK scans fall in different eight-hour blocks of the day (morning, midday, evening), so every
 * role is searched once a day, one page (100 newest) each.
 */
export const UK_STARTER_ROLES = [
  // Office, finance and business
  "accountant", "finance assistant", "payroll", "credit controller", "administrator", "office manager",
  "customer service", "sales executive", "account manager", "marketing executive", "HR advisor", "recruitment consultant",
  "project manager", "operations manager", "business analyst", "data analyst", "procurement", "logistics coordinator",
  "compliance officer", "legal assistant", "receptionist", "personal assistant", "underwriter", "mortgage adviser",
  // Health and care
  "care assistant", "support worker", "registered nurse", "healthcare assistant", "dental nurse", "pharmacy assistant",
  "social worker", "mental health", "physiotherapist", "senior carer",
  // Education
  "teaching assistant", "teacher", "nursery practitioner", "SEN",
  // Retail, hospitality and customer-facing
  "retail assistant", "retail manager", "chef", "kitchen porter", "waiter", "bar staff", "hotel", "housekeeper",
  "call centre", "barista",
  // Trades, engineering and construction
  "electrician", "plumber", "maintenance engineer", "mechanical engineer", "civil engineer", "quantity surveyor",
  "site manager", "labourer", "vehicle technician", "gas engineer",
  // Driving, warehouse and facilities
  "HGV driver", "delivery driver", "warehouse operative", "forklift driver", "cleaner", "security officer",
  "solicitor", "paralegal", "software developer", "IT support", "graduate", "apprentice",
];
export const STARTER_QUERIES_PER_RUN = 24;
/** The slice of `roles` for this run: it moves on every eight hours, so the morning, midday and evening scans differ. */
export function starterQueries(roles: string[], now: number, n = STARTER_QUERIES_PER_RUN): string[] {
  if (!roles.length) return [];
  const start = (Math.floor(now / (8 * 3_600_000)) * n) % roles.length;
  return Array.from({ length: Math.min(n, roles.length) }, (_, i) => roles[(start + i) % roles.length]);
}

/**
 * Users' roles (most wanted first) to search in one run. When they fit, all are searched. When there are more, the most
 * wanted half is searched every run and the rest take turns, so every user's role, however rare, is searched regularly.
 */
export function userQueries(wanted: string[], now: number, max = MAX_QUERIES): string[] {
  if (wanted.length <= max) return wanted;
  const fixed = Math.ceil(max / 2);
  return [...wanted.slice(0, fixed), ...starterQueries(wanted.slice(fixed), now, max - fixed)];
}

/** Open jobs kept per country nobody searches yet (a sample for visitors' pre-signup preview). A launched market joins LAUNCH_MARKETS. */
export const UNWATCHED_COUNTRY_CAP = 300;

/**
 * The rows to save from one fetch. Searched countries and remote jobs are always saved. In a country nobody searches, a
 * listing already stored is refreshed, and a new one is added only while the country holds fewer than the cap of open jobs.
 * `stored` (open jobs per country) is updated in place, so later sources in the same run see the rows added here.
 */
export function capUnwatchedRows<T extends { country: string; external_id?: string | null }>(rows: T[], watched: (country: string) => boolean, stored: Map<string, number>, existing: Set<string>, cap = UNWATCHED_COUNTRY_CAP): T[] {
  return rows.filter((r) => {
    if (watched(r.country) || existing.has(r.external_id ?? "")) return true;
    const n = stored.get(r.country) ?? 0;
    if (n >= cap) return false;
    stored.set(r.country, n + 1);
    return true;
  });
}

export function staleIds(previous: string[], current: string[]): string[] {
  const now = new Set(current);
  return previous.filter((id) => !now.has(id));
}
