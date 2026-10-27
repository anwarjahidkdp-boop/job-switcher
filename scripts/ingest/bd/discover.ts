// Career-page detector for the employer directory (companies.ts). For each company it opens the home page, follows the
// careers link on the same site, and works out how the jobs are published:
//   - a public job board (SmartRecruiters, Workable, Lever, Greenhouse, Recruitee, Ashby) linked or redirected to: read
//     through that board's public API, like every other board source;
//   - schema.org JobPosting data on the careers page or its job pages: read as a "jsonld" source;
//   - anything else is recorded with the reason (no public feed, jobs only on Bdjobs, site unreachable or blocked), so the
//     owner can see which employers need another route. Nothing is guessed: robots.txt is honoured on every page.
import type { SupabaseClient } from '@supabase/supabase-js';
import { BOT_UA, robotsAllows } from '../../../src/lib/ingest/robots';
import { extractJobPostings } from '../../../src/lib/ingest/jsonld';
import { BD_COMPANIES, BD_EMPLOYER_BOARDS, type BdCompany } from './companies';

export type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;
export type BoardKind = 'smartrecruiters' | 'workable' | 'lever' | 'greenhouse' | 'recruitee' | 'ashby';
export type Discovery =
  | { status: 'board'; kind: BoardKind; token: string; via: string }
  | { status: 'jsonld'; url: string; detailPath: string | null }
  | { status: 'no_public_feed' | 'lists_on_bdjobs' | 'unreachable'; note: string; url?: string };

const BOARDS: [BoardKind, RegExp, Set<string>][] = [
  ['smartrecruiters', /^https?:\/\/(?:jobs|careers)\.smartrecruiters\.com\/([A-Za-z0-9][\w-]*)/i, new Set(['sr-jobs', 'oneclick-ui', 'static', 'search'])],
  ['workable', /^https?:\/\/apply\.workable\.com\/([a-z0-9][a-z0-9-]*)/i, new Set(['api', 'j', 'static'])],
  ['lever', /^https?:\/\/jobs\.(?:eu\.)?lever\.co\/([A-Za-z0-9][\w.-]*)/i, new Set([])],
  ['greenhouse', /^https?:\/\/(?:boards|job-boards)(?:\.eu)?\.greenhouse\.io\/(?:embed\/job_board(?:\/js)?\?for=)?([A-Za-z0-9][\w-]*)/i, new Set(['embed'])],
  ['recruitee', /^https?:\/\/([a-z0-9][a-z0-9-]*)\.recruitee\.com/i, new Set(['www', 'api', 'app', 'careers', 'support'])],
  ['ashby', /^https?:\/\/jobs\.ashbyhq\.com\/([A-Za-z0-9][\w.%-]*)/i, new Set(['api'])],
];

/** A public job board named by a URL, e.g. https://jobs.smartrecruiters.com/ShebaPlatformLimited/123 -> smartrecruiters/ShebaPlatformLimited. */
export function boardFromUrl(url: string): { kind: BoardKind; token: string } | null {
  for (const [kind, re, skip] of BOARDS) { const m = url.match(re); if (m && !skip.has(m[1].toLowerCase())) return { kind, token: decodeURIComponent(m[1]) }; }
  return null;
}

const urls = (html: string, base: string) => {
  const out: { url: URL; text: string }[] = [];
  const add = (raw: string, text: string) => { try { const u = new URL(raw.replace(/&amp;/g, '&'), base); if (/^https?:$/.test(u.protocol) && !u.username && !u.password) out.push({ url: u, text }); } catch { /* not a URL */ } };
  for (const m of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) { const h = m[1].match(/\bhref\s*=\s*["']([^"']+)["']/i); if (h) add(h[1], m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200)); }
  for (const m of html.matchAll(/<(?:iframe|script)\b[^>]*?\bsrc\s*=\s*["']([^"']+)["']/gi)) add(m[1], '');
  return out;
};

/** The first public job board a page links to or embeds. */
export function boardOnPage(html: string, pageUrl: string) {
  for (const { url } of urls(html, pageUrl)) { const b = boardFromUrl(url.href); if (b) return b; }
  const inline = html.match(/https?:\/\/(?:jobs\.smartrecruiters\.com|apply\.workable\.com|jobs\.lever\.co|(?:job-)?boards\.greenhouse\.io|[a-z0-9-]+\.recruitee\.com|jobs\.ashbyhq\.com)\/?[^\s"'<>)]*/i);
  return inline ? boardFromUrl(inline[0]) : null;
}

const site = (host: string, root: string) => { const h = host.replace(/^www\./, ''); return h === root || h.endsWith('.' + root); };
const CAREER = /career|\bjobs?\b|vacanc|join[\s-]*(?:us|our)|work[\s-]*with[\s-]*us|recruit|opportunit|ক্যারিয়ার|কর্মসংস্থান|নিয়োগ|চাকরি/i;

/** Links to the company's careers pages on its own site (subdomains count: career.grameenphone.com), best first. */
export function careerLinks(html: string, pageUrl: string, root: string): string[] {
  const scored = urls(html, pageUrl).filter(({ url }) => site(url.hostname, root) && !/\.(pdf|jpe?g|png|docx?)$/i.test(url.pathname))
    .map(({ url, text }) => { url.hash = ''; const inPath = CAREER.test(url.hostname.split('.')[0] + ' ' + url.pathname); const inText = CAREER.test(text); return { href: url.href, score: (inPath ? 2 : 0) + (inText ? 1 : 0) + (/career/i.test(url.hostname + url.pathname + text) ? 1 : 0) }; })
    .filter((x) => x.score >= 2 && x.href !== pageUrl);
  return [...new Map(scored.sort((a, b) => b.score - a.score).map((x) => [x.href, x])).keys()].slice(0, 3);
}

/** Job pages linked from a careers page: same host, under a jobs-like path one level deeper than the listing. */
export function jobPageLinks(html: string, pageUrl: string): { prefix: string; links: string[] } | null {
  const page = new URL(pageUrl);
  const groups = new Map<string, string[]>();
  for (const { url } of urls(html, pageUrl)) {
    if (url.origin !== page.origin) continue;
    url.hash = '';
    const parts = url.pathname.split('/').filter(Boolean);
    const at = parts.findIndex((p) => /^(?:jobs?|careers?|vacanc(?:y|ies)|openings?|positions?|circulars?)$/i.test(p));
    if (at < 0 || parts.length <= at + 1 || url.href === page.href) continue;
    const prefix = '/' + parts.slice(0, at + 1).join('/') + '/';
    groups.set(prefix, [...new Set([...(groups.get(prefix) || []), url.href])]);
  }
  const best = [...groups.entries()].sort((a, b) => b[1].length - a[1].length)[0];
  return best ? { prefix: best[0], links: best[1] } : null;
}

/** Reads public pages of one company: robots.txt per origin, our bot name, redirects checked hop by hop. */
export class SiteReader {
  private rules = new Map<string, string>();
  constructor(private root: string, private fetcher: Fetcher = fetch, private timeout = 15_000) {}
  private async robots(origin: string) {
    if (!this.rules.has(origin)) {
      const r = await this.fetcher(origin + '/robots.txt', { headers: { 'user-agent': BOT_UA }, redirect: 'follow', signal: AbortSignal.timeout(this.timeout) });
      if (!r.ok && ![404, 410].includes(r.status)) { await r.body?.cancel(); throw Error(`robots.txt returned ${r.status}`); }
      this.rules.set(origin, r.ok ? (await r.text()).slice(0, 200_000) : '');
    }
    return this.rules.get(origin)!;
  }
  /** The page's HTML, or the job board a redirect lands on (many careers links forward straight to the board). */
  async read(url: string): Promise<{ html: string; url: string } | { board: { kind: BoardKind; token: string }; url: string }> {
    let target = new URL(url);
    for (let hop = 0; hop < 4; hop++) {
      const board = boardFromUrl(target.href);
      if (board) return { board, url: target.href };
      if (target.protocol !== 'https:' && target.protocol !== 'http:') throw Error('Unsupported link');
      if (!site(target.hostname, this.root)) throw Error('Careers link leaves the company site');
      if (!robotsAllows(await this.robots(target.origin), target.pathname + target.search)) throw Error('robots.txt disallows this page');
      const r = await this.fetcher(target.href, { headers: { 'user-agent': BOT_UA, accept: 'text/html' }, redirect: 'manual', signal: AbortSignal.timeout(this.timeout) });
      if ([301, 302, 303, 307, 308].includes(r.status)) { const loc = r.headers.get('location'); await r.body?.cancel(); if (!loc) throw Error('Redirect without Location'); target = new URL(loc, target); continue; }
      if (!r.ok) { await r.body?.cancel(); throw Error(`HTTP ${r.status}`); }
      const type = r.headers.get('content-type') || '';
      if (type && !/html|text/.test(type)) { await r.body?.cancel(); throw Error('Not a web page'); }
      return { html: (await r.text()).slice(0, 3_000_000), url: target.href };
    }
    throw Error('Too many redirects');
  }
}

const reason = (e: unknown) => String(e instanceof Error ? (e.cause instanceof Error ? e.cause.message : e.message) : e).slice(0, 200);

export async function discoverCompany(company: BdCompany, fetcher: Fetcher = fetch): Promise<Discovery> {
  const root = company.site.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '').toLowerCase();
  const reader = new SiteReader(root, fetcher);
  let home;
  try { home = await reader.read(`https://${company.site.replace(/^https?:\/\//, '')}/`); } catch (e) { return { status: 'unreachable', note: `Home page: ${reason(e)}` }; }
  if ('board' in home) return { status: 'board', ...home.board, via: home.url };
  const onHome = boardOnPage(home.html, home.url);
  if (onHome) return { status: 'board', ...onHome, via: home.url };
  if (extractJobPostings(home.html).length) return { status: 'jsonld', url: home.url, detailPath: null };
  const links = careerLinks(home.html, home.url, root);
  let bdjobs = /bdjobs\.com/i.test(home.html), lastErr = '', career: string | undefined;
  for (const link of links.slice(0, 2)) {
    let page;
    try { page = await reader.read(link); } catch (e) { lastErr = `${link}: ${reason(e)}`; continue; }
    if ('board' in page) return { status: 'board', ...page.board, via: link };
    career ??= page.url;
    const board = boardOnPage(page.html, page.url);
    if (board) return { status: 'board', ...board, via: page.url };
    if (extractJobPostings(page.html).length) return { status: 'jsonld', url: page.url, detailPath: null };
    const jobs = jobPageLinks(page.html, page.url);
    if (jobs) {
      // One job page is opened to confirm it carries JobPosting data before the source is switched on.
      try { const first = await reader.read(jobs.links[0]); if ('html' in first && extractJobPostings(first.html).length) return { status: 'jsonld', url: page.url, detailPath: jobs.prefix }; } catch { /* treated as no feed */ }
    }
    bdjobs ||= /bdjobs\.com/i.test(page.html);
  }
  if (bdjobs) return { status: 'lists_on_bdjobs', note: 'Its jobs are posted on Bdjobs, which does not allow automated reading', url: career };
  if (!links.length) return { status: 'no_public_feed', note: 'No careers link found on the home page' };
  return { status: 'no_public_feed', note: lastErr || 'Careers page has no job board or structured job data', url: career };
}

const dirToken = (c: BdCompany) => `dir:${c.site}${c.mnc ? '@bd' : ''}`;
const RECHECK_DAYS = 7;

/** Checks the companies that are new or due a recheck, a few per run, and records what was found. */
export async function discoverCareerPages(db: SupabaseClient, opts: { max?: number; maxMs?: number; fetcher?: Fetcher; companies?: BdCompany[]; now?: number } = {}) {
  const now = opts.now ?? Date.now(), started = Date.now();
  const companies = opts.companies || BD_COMPANIES;
  const { data: rows, error } = await db.from('ingestion_sources').select('id, kind, board_token, active, last_run_at').eq('country', 'BD');
  if (error) throw error;
  const dir = new Map((rows || []).filter((r) => r.kind === 'jsonld' && String(r.board_token || '').startsWith('dir:')).map((r) => [r.board_token as string, r]));
  const boards = new Set((rows || []).filter((r) => r.kind !== 'jsonld').map((r) => `${r.kind}:${String(r.board_token).toLowerCase()}`));
  // Never-checked companies first, then the longest unchecked; active JSON-LD sources are read by the normal ingest.
  const due = companies.map((c) => ({ c, row: dir.get(dirToken(c)) }))
    .filter(({ row }) => !row || (!row.active && (!row.last_run_at || now - Date.parse(row.last_run_at) > RECHECK_DAYS * 86_400_000)))
    .sort((a, b) => (a.row?.last_run_at ? Date.parse(a.row.last_run_at) : 0) - (b.row?.last_run_at ? Date.parse(b.row.last_run_at) : 0))
    .slice(0, opts.max ?? 25);
  const tally: Record<string, number> = {};
  // Confirmed boards are registered once; a later switch-off by the administrator is kept.
  const fresh = BD_EMPLOYER_BOARDS.filter((b) => !boards.has(`${b.kind}:${b.token.toLowerCase()}`));
  if (fresh.length) {
    const { error: e } = await db.from('ingestion_sources').insert(fresh.map((b) => ({ kind: b.kind, board_token: b.token, name: b.name, company: b.name.replace(/ \(.*\)$/, ''), country: 'BD', source_type: 'employer', active: true, last_status: 'pending' })));
    if (e) throw e;
    for (const b of fresh) boards.add(`${b.kind}:${b.token.toLowerCase()}`);
  }
  for (const { c, row } of due) {
    if (opts.maxMs && Date.now() - started > opts.maxMs) break;
    const d = await discoverCompany(c, opts.fetcher);
    tally[d.status] = (tally[d.status] || 0) + 1;
    const base = { kind: 'jsonld', board_token: dirToken(c), name: `${c.name} careers`, company: c.name, country: 'BD', source_type: 'employer', last_run_at: new Date().toISOString(), jobs_found: 0 };
    let entry: Record<string, unknown>;
    if (d.status === 'board') {
      const token = d.token + (c.mnc ? '@bd' : '');
      if (!boards.has(`${d.kind}:${token.toLowerCase()}`)) {
        const { error: e } = await db.from('ingestion_sources').insert({ kind: d.kind, board_token: token, name: c.name, company: c.name, country: 'BD', source_type: 'employer', active: true, last_status: 'pending' });
        if (e) throw e;
        boards.add(`${d.kind}:${token.toLowerCase()}`);
      }
      entry = { ...base, url: d.via, detail_path: null, active: false, last_status: 'uses_board', last_error: `Jobs are read from its ${d.kind} board (${d.token})` };
    } else if (d.status === 'jsonld') entry = { ...base, url: d.url, detail_path: d.detailPath, active: true, last_status: 'pending', last_error: null };
    else entry = { ...base, url: d.url || `https://${c.site}/`, detail_path: null, active: false, last_status: d.status, last_error: d.note };
    const { error: e } = row ? await db.from('ingestion_sources').update(entry).eq('id', row.id) : await db.from('ingestion_sources').insert(entry);
    if (e) throw e;
  }
  return { checked: Object.values(tally).reduce((a, b) => a + b, 0), tally, boardsAdded: fresh.length };
}
