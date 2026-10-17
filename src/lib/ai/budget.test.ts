import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { checkBudget } from "./index";
import { AIError } from "./provider";
import { costMicroUsd } from "./pricing";

describe("AI monthly cap", () => {
  const base = { spent: 0, cap: 500000, plan: "trial", status: "trialing", trialEndsAt: "2099-01-01T00:00:00Z" };
  it("allows calls under the cap", () => expect(() => checkBudget(base)).not.toThrow());
  it("refuses at or over the cap", () => {
    expect(() => checkBudget({ ...base, spent: 500000 })).toThrow(AIError);
    try { checkBudget({ ...base, spent: 600000 }); } catch (e) { expect((e as AIError).code).toBe("over_cap"); }
  });
  it("refuses after the trial ends", () => {
    try { checkBudget({ ...base, trialEndsAt: "2020-01-01T00:00:00Z" }); throw new Error("no"); } catch (e) { expect((e as AIError).code).toBe("trial_expired"); }
  });
  it("refuses without a subscription", () => expect(() => checkBudget(null)).toThrow(AIError));
  it("prices tokens in micro-dollars", () => {
    expect(costMicroUsd("claude-haiku-5-5", 10000, 2000)).toBe(2000); // $0.002
    expect(costMicroUsd("claude-sonnet-5-5", 10000, 2000)).toBe(40000); // $0.04
  });
});
