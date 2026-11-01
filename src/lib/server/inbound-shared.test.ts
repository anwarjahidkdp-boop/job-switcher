import { describe, expect, it, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
vi.mock("server-only", () => ({}));
vi.mock("./state", () => ({ loadProfile: async () => ({ target_country: "GB", setup_steps: {} }) }));
vi.mock("../ai", () => ({ runAI: async () => { throw new Error("no AI in this test"); } }));
import { processInbound } from "./inbound";

const raw = readFileSync(fileURLToPath(new URL("../inbound/__fixtures__/alerts/bdjobs-synthetic.eml", import.meta.url)), "utf8");

/** Minimal Supabase stand-in: records inserted/upserted jobs and answers every read with an empty or fixed result. */
function fakeDb(email: string, existing: { title: string; company: string; url: string | null }[] = []) {
  const jobs: Record<string, unknown>[] = [];
  const filters: string[] = [];
  const q = (table: string) => {
    const o: Record<string, unknown> = {};
    const self = () => o;
    for (const m of ["select", "eq", "gte", "limit", "update", "order"]) o[m] = (...a: unknown[]) => { if (table === "jobs" && m === "eq") filters.push(`eq:${a[0]}`); return o; };
    o.is = (c: string) => { filters.push(`is:${c}`); return o; };
    o.maybeSingle = async () => (table === "forwarding_addresses" ? { data: { id: "f1", user_id: "owner", active: true, emails_received: 0 } } : { data: null });
    o.single = async () => ({ data: { id: "in1" }, error: null });
    o.insert = (row: Record<string, unknown>) => { if (table === "jobs") { jobs.push(row); return Promise.resolve({ error: null }); } return o; };
    o.upsert = async (row: Record<string, unknown>) => { jobs.push({ ...row, upserted: true }); return { error: null }; };
    o.then = (r: (v: unknown) => void) => r({ data: table === "jobs" ? existing : null, error: null });
    void self;
    return o;
  };
  const db = { from: q, auth: { admin: { getUserById: async () => ({ data: { user: { email, email_confirmed_at: "2026-10-01T00:00:00Z" } } }) } } };
  return { db: db as never, jobs, filters };
}

describe("central Bdjobs alert address", () => {
  beforeEach(() => { vi.stubEnv("ADMIN_EMAILS", "owner@example.org"); });

  it("stores the owner's alert jobs as public Bangladesh listings for every user", async () => {
    const { db, jobs, filters } = fakeDb("owner@example.org");
    const r = await processInbound(db, { alias: "owner1", raw });
    expect(r.status).toBe("processed");
    expect(jobs.length).toBeGreaterThan(0);
    for (const j of jobs) { expect(j.owner_id).toBeNull(); expect(j.country).toBe("BD"); expect(j.source_kind).toBe("email_alert"); expect(j.upserted).toBeUndefined(); }
    expect(filters).toContain("is:owner_id");
  });

  it("skips jobs already shared from an earlier alert", async () => {
    const first = fakeDb("owner@example.org");
    await processInbound(first.db, { alias: "owner1", raw });
    const again = fakeDb("owner@example.org", first.jobs.map((j) => ({ title: "x", company: "y", url: j.url as string })));
    await processInbound(again.db, { alias: "owner1", raw });
    expect(again.jobs.filter((j) => j.url)).toHaveLength(0);
  });

  it("keeps an ordinary user's alert jobs private to them", async () => {
    const { db, jobs } = fakeDb("someone@example.org");
    await processInbound(db, { alias: "user1", raw });
    expect(jobs.length).toBeGreaterThan(0);
    for (const j of jobs) { expect(j.owner_id).toBe("owner"); expect(j.country).toBe("GB"); }
  });
});
