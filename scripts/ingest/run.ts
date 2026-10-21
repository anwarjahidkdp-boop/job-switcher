// Daily ingestion job (GitHub Actions: .github/workflows/ingest.yml).
//   npm run ingest                 all active sources
//   npm run ingest -- --source <id> --dry-run
import { scriptAdmin, flagValue, hasFlag } from "../lib/admin";
import { fetchSource, staleIds, type SourceRow } from "./fetch-source";
import { jobToRow } from "../../src/lib/jobs";
import { todayStr } from "../../src/lib/dates";
import { refreshMatches } from "../../src/lib/server/matches";
import { processNewMatches } from "../../src/lib/server/new-matches";
import { ADZUNA_COUNTRIES } from "../../src/lib/ingest/boards";
import { cname } from "../../src/lib/countries";

async function main() {
  const db = scriptAdmin();
  const dry = hasFlag("dry-run");
  const only = flagValue("source");
  const today = todayStr("UTC");

  // Job-search APIs are queried with what our users are looking for, per target country.
  const demand = await roleDemand(db);
  // The launch markets get search sources even before anyone there signs up, so their first users find jobs waiting.
  if (!only && !dry) await ensureSearchSources(db, [...new Set([...LAUNCH_MARKETS, ...demand.keys()])]);

  let q = db.from("ingestion_sources").select("id, kind, name, url, board_token, country, company").eq("active", true);
  if (only) q = q.eq("id", only);
  const { data: sources, error } = await q;
  if (error) throw error;
  console.log(`ingest: ${sources?.length || 0} active source(s)${dry ? " (dry run)" : ""}`);

  const touchedCountries = new Set<string>();
  let total = 0, failed = 0;
  for (const src of (sources || []) as SourceRow[]) {
    try {
      const jobs = await fetchSource(src, today, fetch, { queries: demand.get(src.country) || [] });
      total += jobs.length;
      console.log(`  ${src.kind} "${src.name}": ${jobs.length} job(s)`);
      if (dry) { for (const j of jobs.slice(0, 5)) console.log(`    - ${j.title} | ${j.company} | ${j.country}`); continue; }

      const rows = [...new Map(jobs.map((j) => [j.externalId, j])).values()].map((j) => ({ ...jobToRow(j, { owner_id: null, source_kind: src.kind, source_id: src.id, external_id: j.externalId, description: j.description.slice(0, 20000) }), active: true }));
      for (let i = 0; i < rows.length; i += 200) {
        const { error: e } = await db.from("jobs").upsert(rows.slice(i, i + 200), { onConflict: "source_id,external_id" });
        if (e) throw e;
      }
      // Only retire old listings when the fetch returned something (an empty result may be a page change, not "no jobs").
      if (jobs.length) {
        const { data: prev } = await db.from("jobs").select("external_id").eq("source_id", src.id).eq("active", true);
        const stale = staleIds((prev || []).map((r) => r.external_id as string), jobs.map((j) => j.externalId));
        for (let i = 0; i < stale.length; i += 100) await db.from("jobs").update({ active: false, updated_at: new Date().toISOString() }).eq("source_id", src.id).in("external_id", stale.slice(i, i + 100));
      }
      for (const j of jobs) touchedCountries.add(j.country);
      await db.from("ingestion_sources").update({ last_run_at: new Date().toISOString(), last_status: "ok", last_error: null, jobs_found: jobs.length }).eq("id", src.id);
    } catch (e) {
      failed++;
      const msg = errText(e);
      console.error(`  ${src.kind} "${src.name}" failed: ${msg}`);
      if (!dry) await db.from("ingestion_sources").update({ last_run_at: new Date().toISOString(), last_status: "error", last_error: msg.slice(0, 500) }).eq("id", src.id);
    }
  }

  if (!dry) {
    // Expire public listings whose deadline has passed.
    await db.from("jobs").update({ active: false, updated_at: new Date().toISOString() }).is("owner_id", null).eq("active", true).lt("deadline", today);
    console.log(`ingest: pruned ${await pruneOldJobs(db)} closed job(s)`);
    if (touchedCountries.size) {
      const { data: users } = await db.from("profiles").select("id").in("target_country", [...touchedCountries]).eq("onboarding_step", "done");
      let n = 0;
      for (const u of users || []) { try { await refreshMatches(db, u.id as string); n++; } catch (e) { console.error("  match refresh failed", u.id, e); } }
      console.log(`ingest: refreshed matches for ${n} user(s)`);
      const nm = await processNewMatches(db, (users || []).map((u) => u.id as string), { appUrl: process.env.NEXT_PUBLIC_APP_URL || "https://jobpao.app", prepare: !hasFlag("no-prepare") });
      console.log(`ingest: new matches for ${nm.users} user(s): ${nm.notified} job(s), ${nm.prepared} pack(s) prepared, ${nm.emailed} email(s), ${nm.failed} failed`);
    }
  }
  console.log(`ingest: done, ${total} job(s), ${failed} failed source(s)`);
  if (failed && failed === (sources || []).length) process.exitCode = 1;
}

const errText = (e: unknown) => e instanceof Error ? e.message : e && typeof e === "object" ? [(e as { message?: string }).message, (e as { details?: string }).details, (e as { code?: string }).code].filter(Boolean).join(" | ") || JSON.stringify(e) : String(e);

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

/** Public jobs closed for 30+ days are deleted to keep the database small, unless someone started an application. */
async function pruneOldJobs(db: ReturnType<typeof scriptAdmin>): Promise<number> {
  const cutoff = new Date(Date.now() - 30 * 86400_000).toISOString();
  const { data } = await db.from("jobs").select("id").is("owner_id", null).eq("active", false).lt("updated_at", cutoff).limit(2000);
  const ids = (data || []).map((r) => r.id as string);
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
