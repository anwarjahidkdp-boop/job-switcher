// The tables the weekly partial backup copies, and the order each one is read in.
export const TABLES = [
  "profiles", "subscriptions", "payments", "plans", "plan_prices", "country_rules", "cv_documents", "career_facts", "master_cvs",
  "applications", "application_events", "reminders", "matches", "notifications", "jobs", "ingestion_sources",
  "forwarding_addresses", "inbound_emails", "ai_usage", "gmail_connections", "email_deliveries", "career_reports", "match_assessments", "ingestion_source_quarantine", "source_documents", "job_source_occurrences", "job_canonical_keys",
];

/** Each table's primary key, so pages are read in a stable order. A table without an `id` column must be listed here,
 *  or the copy fails ("column id does not exist"), as it did from 24 Oct 2026 for match_assessments. */
const KEYS: Record<string, string[]> = {
  matches: ["user_id", "job_id"], plan_prices: ["plan_code", "country"], plans: ["code"], country_rules: ["code"],
  gmail_connections: ["user_id"], match_assessments: ["user_id", "job_id", "computed_at"], ingestion_source_quarantine: ["source_id"],
};
export const orderKeys = (t: string) => KEYS[t] || ["id"];
