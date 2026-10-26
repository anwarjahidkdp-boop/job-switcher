import { describe, it, expect, vi, afterEach } from "vitest";
import { patientPost } from "./patient-post";

const res = (status: number, body: unknown) => ({ ok: status < 400, status, json: async () => { if (body === null) throw new Error("html"); return body; } });
afterEach(() => vi.unstubAllGlobals());
const noSleep = async () => {};

describe("patientPost", () => {
  it("retries a held AI step and a cut-off request, showing progress, then succeeds", async () => {
    const f = vi.fn().mockResolvedValueOnce(res(502, { error: "x", code: "unresolved" })).mockResolvedValueOnce(res(503, null)).mockResolvedValueOnce(res(200, { ok: true }));
    vi.stubGlobal("fetch", f);
    const seen: string[] = [];
    expect(await patientPost("/api/cv/build", {}, (m) => seen.push(m), noSleep)).toEqual({ ok: true });
    expect(f).toHaveBeenCalledTimes(3);
    expect(seen).toEqual(["AI is writing your new CV…", "Polishing every line in a professional style…"]);
  });
  it("does not retry a real refusal", async () => {
    const f = vi.fn().mockResolvedValue(res(402, { error: "Your free trial has ended.", code: "trial_expired" }));
    vi.stubGlobal("fetch", f);
    await expect(patientPost("/api/cv/build", {}, undefined, noSleep)).rejects.toThrow("Your free trial has ended.");
    expect(f).toHaveBeenCalledTimes(1);
  });
  it("gives up after about four minutes with the last message", async () => {
    const f = vi.fn().mockResolvedValue(res(502, { error: "Still busy", code: "unresolved" }));
    vi.stubGlobal("fetch", f);
    await expect(patientPost("/x", {}, undefined, noSleep)).rejects.toThrow("Still busy");
    expect(f).toHaveBeenCalledTimes(9);
  });
});
