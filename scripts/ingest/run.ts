// Job collection (GitHub Actions: .github/workflows/ingest.yml). The scheduled run is hourly and scans only the markets
// whose local update is due next (src/lib/scan-schedule.ts); a manual or push run scans everything.
//   npm run ingest                 all active sources
//   npm run ingest -- --source <id> --dry-run
import { scriptAdmin, flagValue, hasFlag } from "../lib/admin";
import { fetchSource, FULL_BOARDS, staleIds, UNSEEN_CLOSE_DAYS, UNWATCHED_PRUNE_DAYS, watchedCountry, type SourceRow } from "./fetch-source";
import { guessCategory, jobToRow, parseSalary } from "../../src/lib/jobs";
import { extractEligibility, normaliseEligibility } from "../../src/lib/eligibility";
import { todayStr } from "../../src/lib/dates";
import { refreshMatches } from "../../src/lib/server/matches";
import { processNewMatches } from "../../src/lib/server/new-matches";
import { checkTopMatches } from "../../src/lib/server/match-check";
import { ADZUNA_COUNTRIES } from "../../src/lib/ingest/boards";
import { cname } from "../../src/lib/countries";
import { fetchBangladesh, type BangladeshBatch } from "./bd/fetch";
import { ensureBangladeshSources, persistBangladeshJobs, persistBangladeshBatch } from "./bd/persist";
import { readHeldCirculars } from "./bd/circulars";
import { discoverCareerPages } from "./bd/discover";
import { getProvider } from "../../src/lib/ai";
import { dueMarkets } from "../../src/lib/scan-schedule";
import { retireDuplicateJobs } from "./dedupe";

async function main() {
  const db = scriptAdmin();
  const dry = hasFlag("dry-run");
  const only = flagValue("source");
  const today = todayStr("UTC");

  // Job-search APIs are queried with what our users are looking for, per target country.
  const demand = await roleDemand(db);
  // The launch markets get search sources even before anyone there signs up, so their first users find jobs waiting.
  if (!only && !dry) await ensureSearchSources(db, [...new Set([...LAUNCH_MARKETS, ...demand.keys()])]);
  if (!only && !dry) await ensureBangladeshSources(db);
  // Bangladesh employers' own career pages: a few per run are checked (and rechecked weekly) for a public job board or
  // structured job data, which then becomes a source of its own (scripts/ingest/bd/discover.ts).
  if (!only && !dry) {
    try {
      const d = await discoverCareerPages(db, { max: 25, maxMs: 5 * 60_000 });
      console.log(`ingest: checked ${d.checked} Bangladesh career page(s) ${JSON.stringify(d.tally)}; ${d.boardsAdded} confirmed board(s) added`);
    } catch (e) { console.error(`  career page check failed: ${errText(e)}`); }
  }

  let q = db.from("ingestion_sources").select("id, kind, name, url, board_token, country, company, detail_path, cursor_url").eq("active", true);
  if (only) q = q.eq("id", only);
  const { data: all, error } = await q;
  if (error) throw error;
  // Hourly schedule: only the markets whose fresh-jobs update is due. Remote (XX) boards ride along with the launch markets.
  const scheduled = !only && process.env.GITHUB_EVENT_NAME === "schedule";
  const markets = [...new Set([...LAUNCH_MARKETS, ...demand.keys(), ...(all || []).map((s) => s.country as string)])].filter((c) => c && c !== "XX");
  const due = new Set(scheduled ? dueMarkets(markets, Date.now()) : markets);
  if (LAUNCH_MARKETS.some((c) => due.has(c))) due.add("XX");
  const sources = (all || []).filter((s) => !scheduled || due.has(s.country as string));
  if (scheduled) console.log(`ingest: update due for ${[...due].join(", ") || "no market"}`);
  if (!sources.length && scheduled) return;
  console.log(`ingest: ${sources.length} active source(s)${dry ? " (dry run)" : ""}`);

  const touchedCountries = new Set<string>();
  let total = 0, failed = 0;
  // Bangladesh collection must not wait behind the much larger international employer boards.
  for (const src of (sources as SourceRow[]).sort((a, b) => Number(b.country === "BD") - Number(a.country === "BD"))) {
    try {
      let batch: BangladeshBatch | null = null;
      if (src.kind === "bdweb") {
        const { data: retry, error } = await db.from("source_documents").select("url").eq("source_id", src.id).eq("state", "fetch_failed").order("last_seen_at").limit(20);
        if (error) throw error;
        batch = await fetchBangladesh(src.board_token || "", today, { cursor: src.cursor_url, retryUrls: (retry || []).map(r => r.url) });
      }
      const jobs = batch ? batch.jobs : await fetchSource(src, today, fetch, { queries: demand.get(src.country) || [] });
      total += jobs.length;
      console.log(`  ${src.kind} "${src.name}": ${jobs.length} job(s)`);
      if (dry) { for (const j of jobs.slice(0, 5)) console.log(`    - ${j.title} | ${j.company} | ${j.country}`); continue; }

      if (src.country === "BD") await persistBangladeshJobs(db, src, jobs, today);
      if (batch) await persistBangladeshBatch(db, src, batch);
      const rows = src.country === "BD" ? [] : [...new Map(jobs.map((j) => [j.externalId, j])).values()].map((j) => ({ ...jobToRow(j, { owner_id: null, source_kind: src.kind, source_id: src.id, external_id: j.externalId, description: j.description.slice(0, 20000) }), active: true }));
      for (let i = 0; i < rows.length; i += 200) {
        const { error: e } = await db.from("jobs").upsert(rows.slice(i, i + 200), { onConflict: "source_id,external_id" });
        if (e) throw e;
      }
      // Only retire old listings when the fetch returned something (an empty result may be a page change, not "no jobs").
      // Search APIs and paginated feeds are not authoritative full-board snapshots.
      if (jobs.length && FULL_BOARDS.includes(src.kind)) {
        const { data: prev } = await db.from("jobs").select("external_id").eq("source_id", src.id).eq("active", true);
        const stale = staleIds((prev || []).map((r) => r.external_id as string), jobs.map((j) => j.externalId));
        for (let i = 0; i < stale.length; i += 100) await db.from("jobs").update({ active: false, updated_at: new Date().toISOString() }).eq("source_id", src.id).in("external_id", stale.slice(i, i + 100));
      }
      for (const j of jobs) touchedCountries.add(j.country);
      const detail = batch?.failures ? `${batch.failures} detail page fetch(es) failed; saved for retry` : batch?.documents.length ? `${batch.documents.length} circular(s) need extraction/review before matching` : null;
      await db.from("ingestion_sources").update({ last_run_at: new Date().toISOString(), last_status: batch?.failures ? "error" : "ok", last_error: detail, jobs_found: jobs.length }).eq("id", src.id);
      if (batch?.failures) failed++;
    } catch (e) {
      failed++;
      const msg = errText(e);
      console.error(`  ${src.kind} "${src.name}" failed: ${msg}`);
      if (!dry) await db.from("ingestion_sources").update({ last_run_at: new Date().toISOString(), last_status: "error", last_error: msg.slice(0, 500) }).eq("id", src.id);
    }
  }

  // Held image/newspaper circulars: read free with OCR first; AI reads only what OCR could not confirm, until the
  // day's AI budget is spent (BD_CIRCULAR_AI_BUDGET_USD, default $0.50 per Bangladesh day across all scans; 0 = free reading only).
  // BD_CIRCULAR_AI_LIMIT caps how many circulars one run looks at (default 200, 0 turns circular reading off).
  const ai = getProvider();
  const circularLimit = Math.max(0, Math.min(1000, Number(process.env.BD_CIRCULAR_AI_LIMIT ?? 200) || 0));
  const circularBudget = Math.max(0, Math.min(20, Number(process.env.BD_CIRCULAR_AI_BUDGET_USD ?? 0.5) || 0));
  if (!dry && !only && circularLimit && due.has("BD")) {
    try {
      // The budget is per Bangladesh day, shared by the day's scans: each run spends only what earlier runs left.
      const day = todayStr("Asia/Dhaka");
      const { data: spentRows, error: spentErr } = await db.from("ai_usage").select("cost_micro_usd").eq("feature", CIRCULAR_FEATURE).gte("created_at", `${day}T00:00:00+06:00`);
      if (spentErr) throw spentErr;
      const left = Math.max(0, circularBudget * 1e6 - (spentRows || []).reduce((n, r) => n + Number(r.cost_micro_usd || 0), 0));
      const c = await readHeldCirculars(db, left > 0 ? ai : null, day, { limit: circularLimit, maxCostMicroUsd: left, maxMs: 30 * 60_000 });
      if (c.costMicroUsd > 0) {
        const { error } = await db.from("ai_usage").insert({ user_id: null, feature: CIRCULAR_FEATURE, provider: "anthropic", model: "circulars", input_tokens: 0, output_tokens: 0, cost_micro_usd: Math.round(c.costMicroUsd), ok: true });
        if (error) console.error(`  circular AI spend not recorded: ${errText(error)}`);
      }
      console.log(`ingest: circulars read free ${c.freeRead}, with AI ${c.read}; published ${c.published} job(s); AI cost about $${(c.costMicroUsd / 1e6).toFixed(3)} (left today before this run $${(left / 1e6).toFixed(3)})`);
      if (c.published) { touchedCountries.add("BD"); total += c.published; }
    } catch (e) { failed++; console.error(`  circular reading failed: ${errText(e)}`); }
  }

  if (!dry) {
    const maintenance = await db.rpc("prune_match_assessments");
    if (maintenance.error) throw maintenance.error;
    const expired=await db.rpc("expire_ai_reservations");
    if(expired.error)throw expired.error;
    // Expire public listings whose deadline has passed everywhere: a day's grace, because during the early scans it is still
    // yesterday in the Americas, where a job closing "today" UTC-wise is open until the end of the local day.
    const yesterday = new Date(Date.parse(today + "T12:00:00Z") - 86_400_000).toISOString().slice(0, 10);
    await db.from("jobs").update({ active: false, updated_at: new Date().toISOString() }).is("owner_id", null).eq("active", true).lt("deadline", yesterday);
    console.log(`ingest: closed ${await retireUnseen(db)} job(s) their feed stopped showing`);
    // Before matches are refreshed, so nobody is matched or notified twice for one vacancy.
    try { console.log(`ingest: hid ${await retireDuplicateJobs(db)} duplicate listing(s)`); } catch (e) { console.error(`  duplicate check failed: ${errText(e)}`); }
    console.log(`ingest: pruned ${await pruneOldJobs(db)} closed job(s)`);
    console.log(`ingest: re-categorised ${await recategorise(db)} job(s)`);
    const facts = await refreshBdFacts(db);
    if (facts) touchedCountries.add("BD");
    console.log(`ingest: re-read salary and pay grade for ${facts} Bangladesh job(s)`);
    if (touchedCountries.size) {
      const { data: users } = await db.from("profiles").select("id").in("target_country", [...touchedCountries]).eq("onboarding_step", "done");
      let n = 0;
      for (const u of users || []) { try { await refreshMatches(db, u.id as string); n++; } catch (e) { console.error("  match refresh failed", u.id, e); } }
      console.log(`ingest: refreshed matches for ${n} user(s)`);
      let checked = 0;
      for (const u of users || []) {
        try {
          const c = await checkTopMatches(db, u.id as string);
          checked += c;
          // The AI's reading changes the score people see: store it, and bring earlier match notifications in line.
          if (c) await refreshMatches(db, u.id as string);
        } catch (e) { console.error("  AI match check failed", u.id, errText(e)); }
      }
      console.log(`ingest: AI-checked ${checked} top match(es)`);
      const nm = await processNewMatches(db, (users || []).map((u) => u.id as string), { appUrl: process.env.NEXT_PUBLIC_APP_URL || "https://jobpao.app" });
      console.log(`ingest: new matches for ${nm.users} user(s): ${nm.notified} job(s), ${nm.prepared} pack(s) prepared, ${nm.emailed} email(s), ${nm.failed} failed`);
    }
  }
  console.log(`ingest: done, ${total} job(s), ${failed} failed source(s)`);
  if (failed) process.exitCode = 1; // partial outages must also alert, even while other sources work
}

const errText = (e: unknown) => e instanceof Error ? e.message : e && typeof e === "object" ? [(e as { message?: string }).message, (e as { details?: string }).details, (e as { code?: string }).code].filter(Boolean).join(" | ") || JSON.stringify(e) : String(e);

/** Board jobs keep the category their title gives under the current rules (rules improve; rows written earlier do not). */
async function recategorise(db: ReturnType<typeof scriptAdmin>): Promise<number> {
  const moves = new Map<string, string[]>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("jobs").select("id, title, category, required_skills, preferred_skills").is("owner_id", null).eq("active", true)
      .not("source_kind", "in", "(paste,email_alert,curated,sample)").order("id").range(from, from + 999);
    if (error) throw error;
    for (const j of data || []) {
      const cat = guessCategory(j.title as string, [...((j.required_skills as string[]) || []), ...((j.preferred_skills as string[]) || [])]);
      if (cat !== j.category) moves.set(cat, [...(moves.get(cat) || []), j.id as string]);
    }
    if (!data || data.length < 1000) break;
  }
  let n = 0;
  for (const [cat, ids] of moves) for (let i = 0; i < ids.length; i += 200) {
    const { error } = await db.from("jobs").update({ category: cat }).in("id", ids.slice(i, i + 200));
    if (error) throw error;
    n += Math.min(200, ids.length - i);
  }
  return n;
}

/** Bangladesh jobs keep the salary and government pay grade their text gives under the current rules: salary only where none is
 *  stored, the grade into raw.eligibility, which list views read (they do not load the description). */
async function refreshBdFacts(db: ReturnType<typeof scriptAdmin>): Promise<number> {
  let n = 0;
  for (let from = 0; ; from += 500) {
    const { data, error } = await db.from("jobs").select("id, description, salary_min, salary_max, raw").is("owner_id", null).eq("active", true).eq("country", "BD").order("id").range(from, from + 499);
    if (error) throw error;
    for (const j of data || []) {
      const text = String(j.description || "");
      const raw = j.raw && typeof j.raw === "object" && !Array.isArray(j.raw) ? j.raw as Record<string, unknown> : {};
      const stored = normaliseEligibility(raw.eligibility), read = extractEligibility(text);
      const patch: Record<string, unknown> = {};
      if (stored.payGrade !== read.payGrade || !!stored.govPost !== !!read.govPost)
        patch.raw = { ...raw, eligibility: { ...(raw.eligibility && typeof raw.eligibility === "object" ? raw.eligibility : {}), payGrade: read.payGrade ?? null, govPost: read.govPost ?? null } };
      if (j.salary_min == null && j.salary_max == null) {
        const pay = parseSalary(text);
        if (pay) { patch.salary_min = pay.min; patch.salary_max = pay.max; }
      }
      if (!Object.keys(patch).length) continue;
      const { error: e } = await db.from("jobs").update(patch).eq("id", j.id);
      if (e) throw e;
      n++;
    }
    if (!data || data.length < 500) break;
  }
  return n;
}

/** ai_usage rows that carry the day's circular-reading AI spend (no user: it is the app's own cost). */
const CIRCULAR_FEATURE = "bd_circular";

const LAUNCH_MARKETS = ["GB", "BD"];

/** Every country a user targets gets a Jooble (and, where covered, Adzuna; Reed for the UK) search source once that API key exists. */
async function ensureSearchSources(db: ReturnType<typeof scriptAdmin>, countries: string[]) {
  const rows: Record<string, unknown>[] = [];
  for (const c of countries.filter((x) => x && x !== "XX")) {
    if (process.env.JOOBLE_API_KEY) rows.push({ kind: "jooble", name: `Jooble ${cname(c)}`, board_token: `jooble-${c.toLowerCase()}`, country: c, active: true });
    if (process.env.REED_API_KEY && c === "GB") rows.push({ kind: "reed", name: "Reed UK", board_token: "reed-gb", country: "GB", active: true });
    if (process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY && ADZUNA_COUNTRIES[c]) rows.push({ kind: "adzuna", name: `Adzuna ${cname(c)}`, board_token: c, country: c, active: true });
  }
  if (!rows.length) return;
  // The (kind, board_token) unique index is partial, so PostgREST cannot upsert on it: insert the missing rows instead.
  // Existing rows are left as they are (an admin may have switched one off on purpose).
  const { data: have } = await db.from("ingestion_sources").select("kind, board_token").in("kind", ["jooble", "adzuna", "reed"]);
  const known = new Set((have || []).map((r) => `${r.kind}:${r.board_token}`));
  const missing = rows.filter((r) => !known.has(`${r.kind}:${r.board_token}`));
  if (!missing.length) return;
  const { error } = await db.from("ingestion_sources").insert(missing);
  if (error) console.error("  search sources:", errText(error));
  else console.log(`ingest: added ${missing.length} search source(s) for new target countries`);
}

/** Feed and search jobs without a deadline that their source has not shown for UNSEEN_CLOSE_DAYS are closed
 * (updated_at moves on every sighting, through the upsert and the touch trigger). Full boards close by snapshot above. */
async function retireUnseen(db: ReturnType<typeof scriptAdmin>): Promise<number> {
  const cutoff = new Date(Date.now() - UNSEEN_CLOSE_DAYS * 86400_000).toISOString();
  const { data, error } = await db.from("jobs").update({ active: false }).is("owner_id", null).eq("active", true).is("deadline", null)
    .neq("country", "BD").not("source_kind", "in", `(${FULL_BOARDS.join(",")})`).lt("updated_at", cutoff).select("id");
  if (error) { console.error(`  closing unseen jobs failed: ${errText(error)}`); return 0; }
  return (data || []).length;
}

/**
 * Closed public jobs are deleted to keep the database small, unless someone started an application: after 30 days, or
 * after UNWATCHED_PRUNE_DAYS in a country nobody searches (no one was matched to them, so no count on any page moves).
 */
async function pruneOldJobs(db: ReturnType<typeof scriptAdmin>): Promise<number> {
  const day = 86400_000;
  const { data: prof } = await db.from("profiles").select("target_country").limit(10000);
  const targeted = new Set((prof || []).map((p) => p.target_country as string).filter(Boolean));
  const { data: old } = await db.from("jobs").select("id").is("owner_id", null).eq("active", false).lt("updated_at", new Date(Date.now() - 30 * day).toISOString()).limit(2000);
  const { data: recent } = await db.from("jobs").select("id, country").is("owner_id", null).eq("active", false).lt("updated_at", new Date(Date.now() - UNWATCHED_PRUNE_DAYS * day).toISOString()).limit(5000);
  const ids = [...new Set([...(old || []).map((r) => r.id as string), ...(recent || []).filter((r) => !watchedCountry(r.country as string, targeted)).map((r) => r.id as string)])];
  let n = 0;
  for (let i = 0; i < ids.length; i += 100) {
    const batch = ids.slice(i, i + 100);
    const { data: apps } = await db.from("applications").select("job_id").in("job_id", batch);
    const keep = new Set((apps || []).map((a) => a.job_id as string));
    const del = batch.filter((id) => !keep.has(id));
    if (!del.length) continue;
    const { error } = await db.from("jobs").delete().in("id", del);
    if (!error) n += del.length;
  }
  return n;
}

/** Target roles of onboarded users, grouped by target country, most wanted first. */
async function roleDemand(db: ReturnType<typeof scriptAdmin>): Promise<Map<string, string[]>> {
  const { data } = await db.from("profiles").select("target_country, career_meta, preferences").eq("onboarding_step", "done").limit(5000);
  const counts = new Map<string, Map<string, number>>();
  for (const p of (data || []) as { target_country: string; career_meta: { target_roles?: string[] } | null; preferences: { roles?: string } | null }[]) {
    const roles = [...(p.career_meta?.target_roles || []), ...String(p.preferences?.roles || "").split(/[,;\n]/)].map((r) => r.trim().toLowerCase()).filter((r) => r.length > 2 && r.length < 60);
    const m = counts.get(p.target_country) || new Map<string, number>();
    for (const r of new Set(roles)) m.set(r, (m.get(r) || 0) + 1);
    counts.set(p.target_country, m);
  }
  return new Map([...counts].map(([c, m]) => [c, [...m].sort((a, b) => b[1] - a[1]).map(([r]) => r)]));
}

main().catch((e) => { console.error(e); process.exit(1); });
