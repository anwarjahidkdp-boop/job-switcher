import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
vi.mock("server-only", () => ({}));
vi.mock("./state", () => ({ loadState: vi.fn() }));
vi.mock("./applications", () => ({
  assertCanApply: vi.fn(), SUBMITTED: ["applied", "interview", "offer", "closed", "withdrawn"],
  ApplicationSafetyError: class extends Error {},
}));
vi.mock("../gmail/crypto", () => ({ openToken: vi.fn().mockResolvedValue("refresh"), sealToken: vi.fn() }));
vi.mock("../cv/doc", () => ({ cvDocHtml: () => "<html>CV</html>", safeFileName: () => "CV" }));
import { loadState } from "./state";
import { assertCanApply } from "./applications";
import { openToken } from "../gmail/crypto";
import { sendApplication } from "./gmail";

// In-memory conditional updates simulate PostgREST's compare-and-set boundary, not an always-success stub.
function fixture(opts: { claimError?: string; statusError?: boolean; receiptError?: boolean } = {}) {
  const row = { sending_at: null as string | null, status: "ready" };
  const events: unknown[] = [];
  const job = { country:"US",salary_min:70000,salary_max:90000,id: "job", company: "Synthetic Employer", title: "Accountant", apply_method: "email", apply_target: "hr@example.invalid", deadline: null };
  const db = { rpc: async () => {
    if (opts.claimError) return { data: null, error: { code: opts.claimError } };
    if (row.sending_at) return { data: null, error: new Error("A previous send attempt is unresolved") };
    row.sending_at = new Date().toISOString();
    return { data: row.sending_at, error: null };
  }, from(table: string) {
    let patch: Record<string, unknown> | undefined;
    const filters: [string, unknown][] = [];
    const q = {
      select: () => q, delete: () => q,
      eq: (k: string, v: unknown) => { filters.push([k, v]); return q; },
      is: (k: string, v: unknown) => { filters.push([k, v]); return q; },
      not: () => q,
      update: (p: Record<string, unknown>) => { patch = p; return q; },
      insert: (p: unknown) => { events.push(p); return q; },
      maybeSingle: () => q,
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => Promise.resolve().then(() => {
        if (table === "gmail_connections") return { data: { google_email: "sender@example.invalid", refresh_token_enc: "sealed" }, error: null };
        if (table === "jobs") return { data: job, error: null };
        if (table === "application_events") return { data: null, error: opts.receiptError ? { message: "receipt failed" } : null };
        if (table !== "applications" || !patch) return { data: null, error: null };
        if (patch.sending_at && opts.claimError) return { data: null, error: { code: opts.claimError } };
        if (patch.status && opts.statusError) return { data: null, error: { message: "status failed" } };
        if (filters.some(([k, v]) => k === "sending_at" && row.sending_at !== v)) return { data: null, error: null };
        Object.assign(row, patch);
        return { data: { id: "app" }, error: null };
      }).then(resolve, reject),
    };
    return q;
  } } as unknown as SupabaseClient;
  const state = {P:{salaryMin:70000,salaryConfirmed:true,workAuthorization:"yes"}, today: "2026-10-23", profile: { preferences: null, deal_breakers: {}, answer_library: {}, needs_visa: false }, master: { content: { name: "Synthetic User" } }, apps: { job: { id: "app", status: "ready", pack: { email_body: "Synthetic test", email_subject: "Application", cover_letter: "Letter" } } } };
  vi.mocked(loadState).mockResolvedValue(state as unknown as Awaited<ReturnType<typeof loadState>>);
  return { row, events, job, state, ctx: { db, admin: db, userId: "user" } };
}
const response = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
function google(send: () => Promise<Response> = async () => response(200, { id: "gmail-id" })) {
  const f = vi.fn(async (url: string | URL | Request) => String(url).includes("/token") ? response(200, { access_token: "access" }) : send());
  vi.stubGlobal("fetch", f);
  return f;
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("GOOGLE_CLIENT_ID", "test"); vi.stubEnv("GOOGLE_CLIENT_SECRET", "test"); vi.stubEnv("GMAIL_TOKEN_KEY", "test");
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("Gmail send delivery boundary (no external requests)", () => {
  it("sends once under concurrent requests and keeps its claim after acceptance", async () => {
    const x = fixture(), f = google();
    const results = await Promise.allSettled([sendApplication(x.ctx, "job"), sendApplication(x.ctx, "job")]);
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
    expect(f.mock.calls.filter(([u]) => String(u).includes("messages/send"))).toHaveLength(1);
    expect(x.row.sending_at).not.toBeNull(); expect(x.row.status).toBe("applied");
    expect(x.events).toEqual(expect.arrayContaining([expect.objectContaining({ event: expect.stringContaining("gmail-id") })]));
  });
  it("never reclaims an old ambiguous attempt", async () => {
    const x = fixture(); x.row.sending_at = "2020-01-01T00:00:00Z"; const f = google();
    await expect(sendApplication(x.ctx, "job")).rejects.toThrow("unresolved"); expect(f).not.toHaveBeenCalled();
  });
  it.each(["PGRST204", "42703", "42501"])("fails closed for claim errors %s", async code => {
    const x = fixture({ claimError: code }), f = google();
    await expect(sendApplication(x.ctx, "job")).rejects.toMatchObject({ code }); expect(f).not.toHaveBeenCalled();
  });
  it.each([400, 401, 403, 429])("allows a user retry after explicit Gmail rejection %s", async status => {
    const x = fixture(); google(async () => response(status, { error: { message: "rejected" } }));
    await expect(sendApplication(x.ctx, "job")).rejects.toThrow(); expect(x.row.sending_at).toBeNull();
    google(); await expect(sendApplication(x.ctx, "job")).resolves.toMatchObject({ to: "hr@example.invalid" });
  });
  it.each([408, 500, 502, 503])("blocks retries after ambiguous Gmail response %s", async status => {
    const x = fixture(); const f = google(async () => response(status, { error: { message: "uncertain" } }));
    await expect(sendApplication(x.ctx, "job")).rejects.toThrow("unresolved"); expect(x.row.sending_at).not.toBeNull();
    await expect(sendApplication(x.ctx, "job")).rejects.toThrow("unresolved"); expect(f).toHaveBeenCalledTimes(2);
  });
  it("keeps the claim after a network timeout", async () => {
    const x = fixture(); google(async () => { throw new DOMException("timed out", "TimeoutError"); });
    await expect(sendApplication(x.ctx, "job")).rejects.toThrow("unresolved"); expect(x.row.sending_at).not.toBeNull();
  });
  it("keeps the claim for a success without a usable receipt", async () => {
    const x = fixture(); google(async () => new Response("not json", { status: 200 }));
    await expect(sendApplication(x.ctx, "job")).rejects.toThrow("unresolved"); expect(x.row.sending_at).not.toBeNull();
  });
  it("releases when token refresh fails before sending", async () => {
    const x = fixture(); vi.stubGlobal("fetch", vi.fn(async () => response(401, { error: "invalid_grant" })));
    await expect(sendApplication(x.ctx, "job")).rejects.toThrow(); expect(x.row.sending_at).toBeNull();
  });
  it("releases when token decryption fails before sending", async () => {
    const x = fixture(), f = google(); vi.mocked(openToken).mockRejectedValueOnce(new Error("bad token"));
    await expect(sendApplication(x.ctx, "job")).rejects.toThrow("connect"); expect(x.row.sending_at).toBeNull(); expect(f).not.toHaveBeenCalled();
  });
  it("retains claim and provider receipt when the applied status update fails", async () => {
    const x = fixture({ statusError: true }), f = google();
    await expect(sendApplication(x.ctx, "job")).rejects.toThrow("was sent");
    expect(x.row.sending_at).not.toBeNull(); expect(x.events).toHaveLength(1);
    await expect(sendApplication(x.ctx, "job")).rejects.toThrow("unresolved"); expect(f).toHaveBeenCalledTimes(2);
  });
  it("does not release the claim if recording the receipt fails", async () => {
    const x = fixture({ receiptError: true }); google();
    await sendApplication(x.ctx, "job"); expect(x.row.sending_at).not.toBeNull();
  });
  it("rechecks current Career Safety before sending an older prepared pack", async () => {
    const x = fixture(), f = google(); x.state.profile.deal_breakers = { excludedCompanies: ["Synthetic Employer"] };
    await expect(sendApplication(x.ctx, "job")).rejects.toThrow(); expect(f).not.toHaveBeenCalled(); expect(x.row.sending_at).toBeNull();
  });
  it("does not send when application allowance refuses", async () => {
    const x = fixture(), f = google(); vi.mocked(assertCanApply).mockRejectedValueOnce(new Error("limit"));
    await expect(sendApplication(x.ctx, "job")).rejects.toThrow("limit"); expect(f).not.toHaveBeenCalled();
  });
});
