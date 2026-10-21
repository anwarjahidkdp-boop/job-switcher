// Daily ingestion job (GitHub Actions: .github/workflows/ingest.yml).
//   npm run ingest                 all active sources
//   npm run ingest -- --source <id> --dry-run
import { scriptAdmin, flagValue, hasFlag } from "../lib/admin";
import { fetchSource, staleIds, type SourceRow } from "./fetch-source";
import { jobToRow } from "../../src/lib/jobs";
import { todayStr } from "../../src/lib/dates";
import { refreshMatches } from "../../src/lib/server/matches";
import { processNewMatches } from "../../src/lib/server/new-matches";

async function main() {
  const db = scriptAdmin();
  const dry = hasFlag("dry-run");
  const only = flagValue("source");
  const today = todayStr("UTC");

  let q = db.from("ingestion_sources").select("id, kind, name, url, board_token, country, company").eq("active", true);
  if (only) q = q.eq("id", only);
  const { data: sources, error } = await q;
  if (error) throw error;
  console.log(`ingest: ${sources?.length || 0} active source(s)${dry ? " (dry run)" : ""}`);

  // Job-search APIs are queried with what our users are looking for, per target country.
  const demand = await roleDemand(db);
  const touchedCountries = new Set<string>();
  let total = 0, failed = 0;
  for (const src of (sources || []) as SourceRow[]) {
    try {
      const jobs = await fetchSource(src, today, fetch, { queries: demand.get(src.country) || [] });
      total += jobs.length;
      console.log(`  ${src.kind} "${src.name}": ${jobs.length} job(s)`);
      if (dry) { for (const j of jobs.slice(0, 5)) console.log(`    - ${j.title} | ${j.company} | ${j.country}`); continue; }

      const rows = jobs.map((j) => ({ ...jobToRow(j, { owner_id: null, source_kind: src.kind, source_id: src.id, external_id: j.externalId, description: j.description.slice(0, 20000) }), active: true }));
      for (let i = 0; i < rows.length; i += 200) {
        const { error: e } = await db.from("jobs").upsert(rows.slice(i, i + 200), { onConflict: "source_id,external_id" });
        if (e) throw e;
      }
      // Only retire old listings when the fetch returned something (an empty result may be a page change, not "no jobs").
      if (jobs.length) {
        const { data: prev } = await db.from("jobs").select("external_id").eq("source_id", src.id).eq("active", true);
        const stale = staleIds((prev || []).map((r) => r.external_id as string), jobs.map((j) => j.externalId));
        for (let i = 0; i < stale.length; i += 100) await db.from("jobs").update({ active: false }).eq("source_id", src.id).in("external_id", stale.slice(i, i + 100));
      }
      for (const j of jobs) touchedCountries.add(j.country);
      await db.from("ingestion_sources").update({ last_run_at: new Date().toISOString(), last_status: "ok", last_error: null, jobs_found: jobs.length }).eq("id", src.id);
    } catch (e) {
      failed++;
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`  ${src.kind} "${src.name}" failed: ${msg}`);
      if (!dry) await db.from("ingestion_sources").update({ last_run_at: new Date().toISOString(), last_status: "error", last_error: msg.slice(0, 500) }).eq("id", src.id);
    }
  }

  if (!dry) {
    // Expire public listings whose deadline has passed.
    await db.from("jobs").update({ active: false }).is("owner_id", null).eq("active", true).lt("deadline", today);
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
