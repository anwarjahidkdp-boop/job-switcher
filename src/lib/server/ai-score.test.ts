import { describe, expect, it } from "vitest";
import { withAiScores, type AiCheck } from "./state";
import type { Scored } from "../matching";

const row = (id: string, score: number, capped = false) => ({ job: { id } as Scored["job"], m: { score, band: "ex", relevant: true, capped } as Scored["m"] });

describe("withAiScores", () => {
  it("uses the AI score and band where the AI checked the job", () => {
    const checks = new Map<string, AiCheck>([["a", { fit: "partial", score: 62, reason: "" }], ["b", { fit: "no", score: 20, reason: "" }]]);
    const [a, b, c] = withAiScores([row("a", 97), row("b", 94), row("c", 90)], checks);
    expect([a.m.score, a.m.band, a.m.relevant]).toEqual([62, "lo", true]);
    expect([b.m.score, b.m.relevant]).toEqual([20, false]);
    expect(c.m.score).toBe(90);
  });
  it("keeps the certification or visa cap", () => {
    const [a] = withAiScores([row("a", 69, true)], new Map([["a", { fit: "strong", score: 88, reason: "" } as AiCheck]]));
    expect(a.m.score).toBe(69);
  });
});
