// Weekly copy of the database tables (GitHub Actions: .github/workflows/backup.yml). The workflow encrypts the files
// before storing them, because they hold people's CVs. The UK sponsor register is left out: it is reloaded weekly.
//   npm run backup -- --out <folder>
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {fullBackup,restoreBackup} from "./full";
import { flagValue, scriptAdmin } from "../lib/admin";

export const TABLES = [
  "profiles", "subscriptions", "payments", "plans", "plan_prices", "country_rules", "cv_documents", "career_facts", "master_cvs",
  "applications", "application_events", "reminders", "matches", "notifications", "jobs", "ingestion_sources",
  "forwarding_addresses", "inbound_emails", "ai_usage", "gmail_connections", "email_deliveries", "career_reports", "match_assessments", "ingestion_source_quarantine",
];
const PAGE = 1000;

async function main() {
  const out = flagValue("out") || "backup";
  mkdirSync(out, { recursive: true });
  const db = scriptAdmin();
  const uri=process.env.SUPABASE_DB_URL;
  const project=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL||process.env.SUPABASE_URL!).hostname.split('.')[0];
  if(flagValue("restore")){
   if(!uri)throw new Error("SUPABASE_DB_URL required for restore");
   await restoreBackup(db,flagValue("restore")!,uri,project);console.log("Isolated recovery verified");return;
  }
  if(uri){const m=await fullBackup(db,out,uri,project);console.log(`Complete backup: ${m.objects.length} verified files`);return;}
  if(process.argv.includes("--require-full"))throw new Error("SUPABASE_DB_URL required for full database/Auth backup");
  console.warn("PARTIAL backup: Auth credentials and private files are not included; configure SUPABASE_DB_URL for full backup");
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
  writeFileSync(join(out, "manifest.json"), JSON.stringify({ complete:false, at: new Date().toISOString(), counts }, null, 2));
  console.log("backup:", Object.entries(counts).map(([t, n]) => `${t}=${n}`).join(" "));
}

main().catch((e) => { console.error(e); process.exit(1); });
