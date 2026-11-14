import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fullAdvert } from "./full-advert";

function dbWith(row: Record<string, unknown>) {
  const update = vi.fn(() => ({ eq: async () => ({ error: null }) }));
  const q = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: row }), update };
  return { db: { from: () => q } as unknown as SupabaseClient, update };
}

describe("fullAdvert", () => {
  it("reads a cut-short Reed advert in full once and saves it", async () => {
    const { db, update } = dbWith({ description: "Healthcare Assistants needed. Key Duties Providing personal care Monito...", source_kind: "reed", external_id: "reed:57566808" });
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ jobDescription: "<p>Healthcare Assistants needed.</p><p>Requirements: 6 months care experience, Care Certificate, right to work in the UK.</p>" }))) as unknown as typeof fetch;
    const text = await fullAdvert(db, db, "j1", { REED_API_KEY: "k" }, fetcher);
    expect(text).toMatch(/Care Certificate/);
    expect(update).toHaveBeenCalledOnce();
    expect((fetcher as unknown as { mock: { calls: string[][] } }).mock.calls[0][0]).toBe("https://www.reed.co.uk/api/1.0/jobs/57566808");
  });
  it("leaves full adverts, other sources and failures alone", async () => {
    const fetcher = vi.fn(async () => new Response("", { status: 500 })) as unknown as typeof fetch;
    expect(await fullAdvert(dbWith({ description: "Complete advert.", source_kind: "reed", external_id: "reed:1" }).db, dbWith({}).db, "j", { REED_API_KEY: "k" }, fetcher)).toBe("Complete advert.");
    expect(await fullAdvert(dbWith({ description: "Short...", source_kind: "greenhouse", external_id: "x" }).db, dbWith({}).db, "j", { REED_API_KEY: "k" }, fetcher)).toBe("Short...");
    expect(await fullAdvert(dbWith({ description: "Short...", source_kind: "reed", external_id: "reed:1" }).db, dbWith({}).db, "j", { REED_API_KEY: "k" }, fetcher)).toBe("Short...");
    expect(fetcher).toHaveBeenCalledOnce();
  });
});
