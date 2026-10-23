vi.mock("./matches",()=>({refreshCareerMatches:vi.fn().mockResolvedValue(true)}));
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
vi.mock("server-only", () => ({}));
vi.mock("../ai", () => ({ runAI: vi.fn(), aiConfigured: () => false }));
vi.mock("./state", () => ({ loadProfile: vi.fn(), loadFacts: vi.fn(), DEFAULT_META: {} }));
import { runAI } from "../ai";
import { loadProfile, loadFacts, type ProfileRow } from "./state";
import { buildMasterCv, setCountry } from "./onboarding";

function fixture(options: { rpcError?: Error; readError?: Error } = {}) {
  const profile = {preferences:{salaryMin:60000},answer_library:{workAuthorization:"yes",sponsorshipRequired:false,willingToRelocate:false}, target_country: "GB", home_country: "BD", billing_country_locked: true, search_country_version: 2, onboarding_step: "prefs" } as ProfileRow;
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

it('refuses incomplete matching preferences before any profile mutation',async()=>{
 const {savePreferences}=await import('./onboarding');const x=fixture();
 await expect(savePreferences(x.ctx,{roles:'Accountant',salaryMin:null},null,{country:'GB',revision:2})).rejects.toThrow('Expected salary');
 expect(x.from).not.toHaveBeenCalled();expect(runAI).not.toHaveBeenCalled();
});
it('does not require birth date for ordinary UK setup and rechecks valid saved preferences without AI',async()=>{
 const {savePreferences}=await import('./onboarding');const {refreshCareerMatches}=await import('./matches');const x=fixture();
 await expect(savePreferences(x.ctx,{roles:'Accountant',salaryMin:70000},null,{country:'GB',revision:2})).resolves.toBeUndefined();
 expect(refreshCareerMatches).toHaveBeenCalled();expect(runAI).not.toHaveBeenCalled();
});
it('requires an actual birth date for Bangladesh setup even if all other answers are present',async()=>{
 const {savePreferences}=await import('./onboarding');const x=fixture();x.profile.target_country='BD';
 await expect(savePreferences(x.ctx,{roles:'Accountant',salaryMin:70000},null,{country:'BD',revision:2})).rejects.toThrow('Date of birth');
 expect(x.from).not.toHaveBeenCalled();
});

it('saves blank references for a completed Bangladesh profile without blocking or rebuilding the CV',async()=>{
 const {savePreferences}=await import('./onboarding');const x=fixture();
 Object.assign(x.profile,{target_country:'BD',home_country:'BD',onboarding_step:'done',personal:{dob:'1987-12-05'},answer_library:{}});
 await expect(savePreferences(x.ctx,{salaryMin:70000},{dob:'1987-12-05',references:[]},{country:'BD',revision:2})).resolves.toBeUndefined();
 expect(x.from).toHaveBeenCalledWith('profiles');expect(runAI).not.toHaveBeenCalled();expect(x.rpc).not.toHaveBeenCalled();
});
