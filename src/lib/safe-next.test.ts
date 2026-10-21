import { describe, expect, it } from "vitest";
import { safeNext } from "./safe-next";

describe("safeNext", () => {
  it("keeps paths on this site", () => {
    expect(safeNext("/jobs/abc?x=1")).toBe("/jobs/abc?x=1");
    expect(safeNext("/inbox", "/profile")).toBe("/inbox");
  });
  it("refuses other sites and tricks", () => {
    for (const p of ["//evil.com", "/\\evil.com", "/\\/evil.com", "https://evil.com", "evil.com", "/\tevil", "\\evil", "", null, undefined]) {
      expect(safeNext(p as string, "/fallback")).toBe("/fallback");
    }
  });
});
