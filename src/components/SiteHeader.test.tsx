import { describe, it, expect } from "vitest";
describe("plan chip on narrow phones", () => {
  it("has a short label so the bell always fits", async () => {
    const { shortPlan } = await import("./SiteHeader");
    expect(shortPlan("Pro Trial · 5 days remaining")).toBe("Trial · 5d left");
    expect(shortPlan("Pro Trial · 1 day remaining")).toBe("Trial · 1d left");
    expect(shortPlan("Pro · until 12 Nov")).toBe("Pro · 12 Nov");
    expect(shortPlan("Trial ended")).toBe("Trial ended");
  });
});
