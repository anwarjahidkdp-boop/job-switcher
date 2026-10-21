import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("../supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("../supabase/admin", () => ({ createAdminClient: vi.fn() }));
import { apiError, isInternal } from "./api";

describe("apiError", () => {
  it("hides database errors", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const r = apiError({ code: "42703", message: "column profiles.secret does not exist", details: null, hint: null });
    expect(r.status).toBe(500);
    expect(JSON.stringify(await r.json())).not.toContain("profiles");
  });
  it("shows our own messages and database rules written for people", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await apiError(new Error("Choose a date.")).json()).error).toBe("Choose a date.");
    const rule = Object.assign(new Error("You can change the country you live in after your Pro plan ends."), { code: "P0001", details: null, hint: null });
    expect((await apiError(rule).json()).error).toContain("after your Pro plan ends");
    expect(isInternal("boom")).toBe(true);
  });
});
