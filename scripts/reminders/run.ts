// Sends due "apply later" reminders (GitHub Actions: .github/workflows/reminders.yml).
//   npm run reminders [-- --dry-run]
import { scriptAdmin, hasFlag } from "../lib/admin";
import { sendDueReminders } from "../../src/lib/server/reminders";

async function main() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) throw new Error("Set NEXT_PUBLIC_APP_URL");
  const r = await sendDueReminders(scriptAdmin(), { appUrl, dryRun: hasFlag("dry-run") });
  console.log(`reminders: checked ${r.checked}, sent ${r.sent}, skipped ${r.skipped}, failed ${r.failed}`);
  if (r.failed && !r.sent) process.exitCode = 1;
}

main().catch((e) => { console.error(e); process.exit(1); });
