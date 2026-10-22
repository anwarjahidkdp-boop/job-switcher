// Sends due "apply later" reminders (GitHub Actions: .github/workflows/reminders.yml).
//   npm run reminders [-- --dry-run]
import { scriptAdmin, hasFlag } from "../lib/admin";
import { sendDueReminders } from "../../src/lib/server/reminders";
import { flushEmailOutbox } from "../../src/lib/server/email-outbox";
import { sendNudges } from "../../src/lib/server/nudges";

async function main() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) throw new Error("Set NEXT_PUBLIC_APP_URL");
  const r = await sendDueReminders(scriptAdmin(), { appUrl, dryRun: hasFlag("dry-run") });
  console.log(`reminders: checked ${r.checked}, sent ${r.sent}, skipped ${r.skipped}, failed ${r.failed}`);
  const n = await sendNudges(scriptAdmin(), { appUrl, dryRun: hasFlag("dry-run") });
  console.log(`nudges: ${n.notified} notification(s), ${n.emailed} email(s), ${n.failed} failed`);
  const outbox = hasFlag("dry-run") ? { failed: 0 } : await flushEmailOutbox(scriptAdmin());
  if (r.failed || n.failed || outbox.failed) process.exitCode = 1;
}

main().catch((e) => { console.error(e); process.exit(1); });
