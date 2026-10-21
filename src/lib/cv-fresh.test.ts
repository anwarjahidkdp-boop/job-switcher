import { describe, expect, it } from "vitest";
import { freshnessQuestions } from "./cv-fresh";

describe("freshnessQuestions", () => {
  it("asks about a 'present' role and what changed when the CV is old", () => {
    const q = freshnessQuestions({ experiences: [{ title: "Accountant", company: "ABC", start: "2021-03", end: null }, { title: "Intern", company: "XYZ", start: "2019-01", end: "2020-12" }], education: [{ year: "2018" }] }, "2026-10-21");
    expect(q.map((x) => x.id)).toEqual(["fresh_role", "fresh_new"]);
    expect(q[0].question).toContain("Accountant at ABC");
    expect(q[1].question).toContain("Mar 2021");
  });
  it("asks nothing for a recent CV", () => {
    expect(freshnessQuestions({ experiences: [{ title: "A", company: "B", start: "2026-02", end: null }] }, "2026-10-21")).toEqual([]);
  });
  it("asks only what changed when no role is current", () => {
    expect(freshnessQuestions({ experiences: [{ title: "A", company: "B", start: "2020-01", end: "2023-05" }] }, "2026-10-21").map((x) => x.id)).toEqual(["fresh_new"]);
  });
});
