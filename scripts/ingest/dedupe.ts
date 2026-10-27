// The same vacancy can arrive more than once: an employer posts it twice on one board (two Reed ids, one text), or several
// Bangladesh job sites copy the same circular. Every run keeps one copy of each vacancy visible and retires the rest, so a
// person never sees the same job twice. Only public listings are compared; a person's own pasted jobs are left alone.
import type { scriptAdmin } from "../lib/admin";

export interface DedupeRow { id: string; country: string; title: string; company: string | null; source_id: string | null; deadline: string | null; created_at: string; description?: string | null }

const LEGAL = /\b(?:plc|ltd|limited|inc|llc|llp|co|company|corp|corporation|gmbh|pvt|private)\b/g;
const words = (s: string | null | undefined) => String(s || "").toLowerCase().normalize("NFKC").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
/** Same title at the same employer in the same country: only these listings are compared further. */
export const vacancyKey = (r: Pick<DedupeRow, "country" | "title" | "company">) => `${r.country}|${words(r.title)}|${words(r.company).replace(LEGAL, " ").replace(/\s+/g, " ").trim()}`;
const text = (s: string | null | undefined) => words(s).replace(/\s+/g, "");

/**
 * Ids to retire among listings that share a vacancyKey. Two listings are the same vacancy when their descriptions are the
 * same text, or (Bangladesh) when two different job sites carry the same title at the same employer: aggregator copies of
 * one circular, each rewritten in its own words. Same-titled listings on one site with different texts (one agency hiring
 * for several branches) stay separate. The copy kept is the one someone already applied to or prepared, then the one open
 * longest, then the fullest description, then the first collected, so the choice does not change from run to run.
 */
export function duplicateIds(rows: DedupeRow[], applied: Set<string> = new Set()): string[] {
  const parent = rows.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const join = (a: number, b: number) => { parent[find(a)] = find(b); };
  for (let i = 0; i < rows.length; i++) for (let j = i + 1; j < rows.length; j++) {
    const a = rows[i], b = rows[j], same = text(a.description), other = text(b.description);
    if (vacancyKey(a) !== vacancyKey(b)) continue;
    if ((same && same === other) || (a.country === "BD" && a.source_id !== b.source_id)) join(i, j);
  }
  const groups = new Map<number, DedupeRow[]>();
  rows.forEach((r, i) => groups.set(find(i), [...(groups.get(find(i)) || []), r]));
  const rank = (r: DedupeRow) => [applied.has(r.id) ? 0 : 1, r.deadline ? -Date.parse(r.deadline) : 0, -(r.description || "").length, Date.parse(r.created_at), r.id] as const;
  const before = (a: DedupeRow, b: DedupeRow) => { const x = rank(a), y = rank(b); for (let k = 0; k < x.length; k++) if (x[k] !== y[k]) return x[k] < y[k] ? -1 : 1; return 0; };
  const out: string[] = [];
  for (const g of groups.values()) {
    if (g.length < 2) continue;
    const [, ...rest] = [...g].sort(before);
    // A copy someone already applied to or prepared stays open, so their application keeps working.
    out.push(...rest.filter((r) => !applied.has(r.id)).map((r) => r.id));
  }
  return out;
}

/** Retires duplicate public listings across every market; returns how many were hidden. */
export async function retireDuplicateJobs(db: ReturnType<typeof scriptAdmin>): Promise<number> {
  const all: DedupeRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("jobs").select("id, country, title, company, source_id, deadline, created_at").is("owner_id", null).eq("active", true).order("id").range(from, from + 999);
    if (error) throw error;
    all.push(...((data || []) as DedupeRow[]));
    if (!data || data.length < 1000) break;
  }
  const byKey = new Map<string, DedupeRow[]>();
  for (const r of all) byKey.set(vacancyKey(r), [...(byKey.get(vacancyKey(r)) || []), r]);
  const groups = [...byKey.values()].filter((g) => g.length > 1);
  const ids = groups.flat().map((r) => r.id);
  const desc = new Map<string, string>(), applied = new Set<string>();
  for (let i = 0; i < ids.length; i += 100) {
    const batch = ids.slice(i, i + 100);
    const [{ data: d, error: e1 }, { data: a, error: e2 }] = await Promise.all([
      db.from("jobs").select("id, description").in("id", batch),
      db.from("applications").select("job_id").in("job_id", batch),
    ]);
    if (e1) throw e1;
    if (e2) throw e2;
    for (const r of d || []) desc.set(r.id as string, (r.description as string) || "");
    for (const r of a || []) applied.add(r.job_id as string);
  }
  const retire = groups.flatMap((g) => duplicateIds(g.map((r) => ({ ...r, description: desc.get(r.id) ?? null })), applied));
  for (let i = 0; i < retire.length; i += 100) {
    const { error } = await db.from("jobs").update({ active: false, updated_at: new Date().toISOString() }).in("id", retire.slice(i, i + 100));
    if (error) throw error;
  }
  return retire.length;
}
