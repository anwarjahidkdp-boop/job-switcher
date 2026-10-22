import { describe, expect, it } from "vitest";
import { normSkill, RELATED, VOCAB } from "./taxonomy";

describe("forecasting skill", () => {
  it("stays forecasting, never cash flow forecasting the person did not claim", () => {
    expect(normSkill("Forecasting")).toBe("forecasting");
    expect(normSkill("financial forecasting")).toBe("forecasting");
    expect(normSkill("cash flow forecasting")).toBe("cash flow forecasting");
    expect(VOCAB).toContain("forecasting");
  });
  it("counts budgeting and cash flow forecasting only as related", () => {
    expect(RELATED.forecasting).toEqual(expect.arrayContaining(["budgeting", "cash flow forecasting"]));
    expect(RELATED["cash flow forecasting"]).toContain("forecasting");
  });
});
