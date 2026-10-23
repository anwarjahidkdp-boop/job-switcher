import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
vi.mock("server-only", () => ({}));
vi.mock("../ai", () => ({ runAI: vi.fn(), aiConfigured: () => false }));
vi.mock("./state", () => ({ loadProfile: vi.fn(), loadFacts: vi.fn(), DEFAULT_META: {} }));
import { runAI } from "../ai";
import { loadProfile, loadFacts, type ProfileRow } from "./state";
import { buildMasterCv, setCountry } from "./onboarding";

function fixture(options: { rpcError?: Error; readError?: Error } = {}) {
  const profile = { target_country: "GB", home_country: "BD", billing_country_locked: true, search_country_version: 2, onboarding_step: "prefs" } as ProfileRow;
  vi.mocked(loadProfile).mockResolvedValue(profile);
  const rpc = vi.fn(async () => ({ data: "new-master", error: options.rpcError || null }));
  const from = vi.fn((table: string) => {
    const q = { select: () => q, eq: () => q, update: () => q,
      maybeSingle: async () => ({ data: table === "cv_documents" ? { id: "doc", text_content: "Verified CV" } : { content: { name: "Synthetic", summary: "Improved CV", experience: [] }, flags: [], ai: true, model: "original-model", source_cv_document_id: "doc" }, error: options.readError || null }),
      then: (resolve: (value: unknown) => unknown) => Promise.resolve({ error: null }).then(resolve) };
    return q;
  });
  const db = { from, rpc } as unknown as SupabaseClient;
  return { ctx: { db, admin: db, userId: "user" }, profile, rpc, from };
}
beforeEach(() => vi.clearAllMocks());
describe("destination setup cost and safety", () => {
  it("reuses the already improved current document with zero AI calls or extraction", async () => {
    const x = fixture();
    await expect(buildMasterCv(x.ctx)).resolves.toMatchObject({ reused: true, ai: false });
    expect(runAI).not.toHaveBeenCalled(); expect(loadFacts).not.toHaveBeenCalled();
    expect(x.rpc).toHaveBeenCalledWith("publish_country_master_cv", expect.objectContaining({ p_country: "GB", p_revision: 2, p_complete_setup: true, p_document_id: "doc", p_model: "original-model" }));
  });
  it("surfaces failed reads and does not spend AI credits after a failed read", async () => {
    const x = fixture({ readError: new Error("read failed") });
    await expect(buildMasterCv(x.ctx)).rejects.toThrow("read failed");
    expect(runAI).not.toHaveBeenCalled(); expect(x.rpc).not.toHaveBeenCalled();
  });
  it("rejects a delayed publication after another country change without retrying AI", async () => {
    const x = fixture({ rpcError: new Error("country changed") });
    await expect(buildMasterCv(x.ctx)).rejects.toThrow("country changed");
    expect(runAI).not.toHaveBeenCalled();
  });
  it("does not allow changing the locked subscription country through the onboarding action", async () => {
    const x = fixture();
    await expect(setCountry(x.ctx, "US", true, "US")).rejects.toThrow("fixed");
    expect(x.from).not.toHaveBeenCalled();
  });
});
