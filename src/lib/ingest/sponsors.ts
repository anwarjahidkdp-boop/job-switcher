// The GOV.UK register of licensed sponsors (workers): employers allowed to sponsor UK work visas.
// Published as a CSV under the Open Government Licence; refreshed weekly by scripts/sponsors/run.ts.

const SUFFIX = /\b(ltd|limited|plc|llp|llc|inc|incorporated|uk|the)\b/g;

/** A company name reduced to a matching key: "The Acme (UK) Ltd." and "ACME" both become "acme". */
export function normCompany(name: string): string {
  return name.toLowerCase().replace(/&/g, " and ").replace(/\bt\/a\b.*$/, "").replace(/[^a-z0-9/ ]+/g, " ")
    .replace(SUFFIX, " ").replace(/\s+/g, " ").trim();
}

/** Minimal RFC 4180 CSV reader (quoted fields, doubled quotes, CRLF). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], f = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; }
      else f += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(f); f = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(f); f = "";
      if (row.some((x) => x !== "")) rows.push(row);
      row = [];
    } else f += c;
  }
  row.push(f);
  if (row.some((x) => x !== "")) rows.push(row);
  return rows;
}

export interface Sponsor { name_norm: string; name: string; town: string | null; routes: string[] }

/** Register rows -> one entry per normalised employer name, with every visa route it holds. */
export function parseSponsors(csv: string): Sponsor[] {
  const [head, ...rows] = parseCsv(csv.replace(/^﻿/, ""));
  if (!head) return [];
  const col = (re: RegExp) => head.findIndex((h) => re.test(h.trim()));
  const iName = col(/^organi[sz]ation name$/i), iTown = col(/^town/i), iRoute = col(/^route$/i);
  if (iName < 0) throw new Error(`Sponsor register: no "Organisation Name" column in ${head.join(" | ")}`);
  const out = new Map<string, Sponsor>();
  for (const r of rows) {
    const name = (r[iName] || "").trim();
    const key = normCompany(name);
    if (!key) continue;
    const s = out.get(key) || { name_norm: key, name, town: iTown >= 0 ? (r[iTown] || "").trim() || null : null, routes: [] };
    const route = iRoute >= 0 ? (r[iRoute] || "").trim() : "";
    if (route && !s.routes.includes(route)) s.routes.push(route);
    out.set(key, s);
  }
  return [...out.values()];
}
