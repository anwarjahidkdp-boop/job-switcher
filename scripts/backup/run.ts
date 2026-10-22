// Weekly copy of the database tables (GitHub Actions: .github/workflows/backup.yml). The workflow encrypts the files
// before storing them, because they hold people's CVs. The UK sponsor register is left out: it is reloaded weekly.
//   npm run backup -- --out <folder>
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { flagValue, scriptAdmin } from "../lib/admin";

export const TABLES = [
  "profiles", "subscriptions", "payments", "plans", "plan_prices", "country_rules", "cv_documents", "career_facts", "master_cvs",
  "applications", "application_events", "reminders", "matches", "notifications", "jobs", "ingestion_sources",
  "forwarding_addresses", "inbound_emails", "ai_usage", "gmail_connections", "email_deliveries",
];
const PAGE = 1000;

async function main() {
  const out = flagValue("out") || "backup";
  mkdirSync(out, { recursive: true });
  const db = scriptAdmin();
  const counts: Record<string, number> = {};
  for (const t of TABLES) {
    const rows: unknown[] = [];
    for (let from = 0; ; from += PAGE) {
      let query = db.from(t).select("*");
      const keys = t === "matches" ? ["user_id", "job_id"] : t === "plan_prices" ? ["plan_code", "country"] : t === "plans" || t === "country_rules" ? ["code"] : t === "gmail_connections" ? ["user_id"] : ["id"];
      for (const key of keys) query = query.order(key);
      const { data, error } = await query.range(from, from + PAGE - 1);
      if (error) throw new Error(`${t}: ${error.message}`);
      rows.push(...(data || []));
      if (!data || data.length < PAGE) break;
    }
    writeFileSync(join(out, `${t}.json`), JSON.stringify(rows));
    counts[t] = rows.length;
  }
  writeFileSync(join(out, "manifest.json"), JSON.stringify({ at: new Date().toISOString(), counts }, null, 2));
  console.log("backup:", Object.entries(counts).map(([t, n]) => `${t}=${n}`).join(" "));
}

main().catch((e) => { console.error(e); process.exit(1); });
