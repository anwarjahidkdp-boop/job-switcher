import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { orderKeys, TABLES } from "./tables";

// Every column each table is created or altered with, read from the migrations.
const dir = join(__dirname, "../../supabase/migrations");
const sql = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort().map((f) => readFileSync(join(dir, f), "utf8")).join("\n");
function columns(t: string): Set<string> {
  const cols = new Set<string>();
  const create = new RegExp(`create table (?:if not exists )?public\\.${t}\\s*\\(([\\s\\S]*?)\\n\\s*\\);`, "gi");
  for (const m of sql.matchAll(create)) for (const line of m[1].split(/[,\n]/)) { const c = line.trim().match(/^([a-z_]+)\s/i); if (c) cols.add(c[1].toLowerCase()); }
  const add = new RegExp(`alter table (?:if exists )?public\\.${t}\\b[^;]*?add column (?:if not exists )?([a-z_]+)`, "gi");
  for (const m of sql.matchAll(add)) cols.add(m[1].toLowerCase());
  return cols;
}

describe("weekly backup tables", () => {
  it.each(TABLES)("%s is read in an order made of columns it has", (t) => {
    const cols = columns(t);
    expect(cols.size, `no create table for ${t} in migrations`).toBeGreaterThan(0);
    for (const k of orderKeys(t)) expect(cols.has(k), `${t} has no column ${k}`).toBe(true);
  });
  it("match_assessments, which has no id, is read by its primary key (the 24 Oct failure)", () => {
    expect(orderKeys("match_assessments")).toEqual(["user_id", "job_id", "computed_at"]);
  });
});
