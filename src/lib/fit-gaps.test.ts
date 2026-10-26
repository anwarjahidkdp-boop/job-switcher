import { describe, expect, it } from "vitest";
import type { Scored } from "./matching";
import { strongFitGaps } from "./fit-gaps";

const row = (score: number, f: Record<string, number | null>, extra: Partial<Scored["m"]> = {}) => ({ job: { id: String(Math.random()) }, m: { score, relevant: true, expired: false, f, ...extra } }) as unknown as Scored;

describe("why no Strong Fit yet", () => {
  it("names the biggest reasons across near matches, biggest first, in plain words", () => {
    const rows = [
      row(84, { role: 1, skills: 0.5, exp: 0.7, ind: 1 }),
      row(78, { role: 1, skills: 0.6, exp: 1, ind: 0.3 }),
      row(72, { role: 0.8, skills: 0.4, exp: 0.4, ind: 1 }),
      row(95, { role: 1, skills: 0.2 }), // already a Strong Fit
      row(60, { role: 1, skills: 0 }), // too far off to be a near match
      row(80, { skills: 0 }, { relevant: false }),
    ];
    const r = strongFitGaps(rows, ["Power BI", "SAP FICO", "VAT"]);
    expect(r.near).toBe(3);
    expect(r.gaps.map((g) => g.factor)).toEqual(["skills", "exp", "role"]);
    expect(r.gaps[0].text).toBe("Skills: 3 of 3 jobs ask for skills your profile does not show yet, mostly Power BI and SAP FICO. Learn one, or add it if you already have it.");
    expect(r.gaps[1].text).toMatch(/^Experience: 2 of 3 jobs want more years/);
  });
  it("has nothing to say without near matches", () => {
    expect(strongFitGaps([row(95, { skills: 1 })])).toEqual({ near: 0, gaps: [] });
  });
});
