import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { GET, POST } from "./route";

const verifyOtp = vi.fn(), getUser = vi.fn();
beforeEach(() => {
  verifyOtp.mockReset(); getUser.mockReset();
  vi.mocked(createClient).mockResolvedValue({ auth: { verifyOtp, getUser, exchangeCodeForSession: vi.fn() } } as never);
});
const post = (f: Record<string, string>) => {
  const body = new URLSearchParams(f);
  return POST(new NextRequest("https://jobpao.app/auth/confirm", { method: "POST", body, headers: { "content-type": "application/x-www-form-urlencoded" } }));
};

describe("email link landing", () => {
  it("does not spend the token on open: it shows the Continue page", async () => {
    const r = await GET(new NextRequest("https://jobpao.app/auth/confirm?next=%2Fonboarding&token_hash=abc&type=email"));
    expect(verifyOtp).not.toHaveBeenCalled();
    const to = new URL(r.headers.get("location")!);
    expect(to.pathname).toBe("/auth/continue");
    expect(to.searchParams.get("token_hash")).toBe("abc");
    expect(to.searchParams.get("next")).toBe("/onboarding");
  });
  it("Continue verifies the token and goes to the next page", async () => {
    verifyOtp.mockResolvedValue({ error: null });
    const r = await post({ token_hash: "abc", type: "email", next: "/onboarding" });
    expect(verifyOtp).toHaveBeenCalledWith({ type: "email", token_hash: "abc" });
    expect(r.status).toBe(303);
    expect(r.headers.get("location")).toBe("https://jobpao.app/onboarding");
  });
  it("a used token still continues when this browser is already signed in", async () => {
    verifyOtp.mockResolvedValue({ error: { message: "otp_expired" } });
    getUser.mockResolvedValue({ data: { user: { id: "u" } } });
    const r = await post({ token_hash: "abc", type: "email", next: "/onboarding" });
    expect(r.headers.get("location")).toBe("https://jobpao.app/onboarding");
  });
  it("a used token without a session goes to log in, and never to another site", async () => {
    verifyOtp.mockResolvedValue({ error: { message: "otp_expired" } });
    getUser.mockResolvedValue({ data: { user: null } });
    expect((await post({ token_hash: "abc", type: "email", next: "/x" })).headers.get("location")).toBe("https://jobpao.app/login?error=link");
    getUser.mockResolvedValue({ data: { user: { id: "u" } } });
    expect((await post({ token_hash: "abc", type: "email", next: "//evil.com" })).headers.get("location")).toBe("https://jobpao.app/onboarding");
  });
  it("ignores unknown token types", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    await post({ token_hash: "abc", type: "weird", next: "/onboarding" });
    expect(verifyOtp).not.toHaveBeenCalled();
  });
});
