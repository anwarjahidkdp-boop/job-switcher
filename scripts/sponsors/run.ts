// Refreshes the GOV.UK register of licensed visa sponsors (GitHub Actions: .github/workflows/sponsors.yml).
//   npm run sponsors [-- --dry-run]
import { scriptAdmin, hasFlag } from "../lib/admin";
import { parseSponsors } from "../../src/lib/ingest/sponsors";

const PAGE = "https://www.gov.uk/api/content/government/publications/register-of-licensed-sponsors-workers";

async function main() {
  const meta = await (await fetch(PAGE)).json() as { details?: { attachments?: { url: string; content_type?: string; title?: string }[] } };
  const csv = (meta.details?.attachments || []).find((a) => /csv/i.test(a.content_type || "") || /\.csv$/i.test(a.url));
  if (!csv) throw new Error("Sponsor register: no CSV attachment on the GOV.UK page");
  const res = await fetch(csv.url);
  if (!res.ok) throw new Error(`Sponsor register download failed: ${res.status}`);
  const sponsors = parseSponsors(await res.text());
  console.log(`sponsors: ${sponsors.length} employers from ${csv.url}`);
  if (sponsors.length < 1000) throw new Error("Sponsor register looks incomplete; not updating");
  if (hasFlag("dry-run")) return;
  const admin = scriptAdmin();
  const stamp = new Date().toISOString();
  for (let i = 0; i < sponsors.length; i += 1000) {
    const { error } = await admin.from("uk_sponsors").upsert(sponsors.slice(i, i + 1000).map((s) => ({ ...s, updated_at: stamp })), { onConflict: "name_norm" });
    if (error) throw new Error(error.message);
  }
  // Employers removed from the register lose the mark.
  const { error } = await admin.from("uk_sponsors").delete().lt("updated_at", stamp);
  if (error) throw new Error(error.message);
  console.log("sponsors: saved");
}

main().catch((e) => { console.error(e); process.exit(1); });
