import { describe, expect, it } from "vitest";
import { applySuggestion, cleanSuggestions, dismissSuggestion } from "./suggestions";
import { DEMO_MASTER } from "../demo";
import type { MasterCV } from "../types";

const m = (): MasterCV => JSON.parse(JSON.stringify(DEMO_MASTER));

describe("CV suggestions", () => {
  it("keeps only suggestions whose text is on the CV and that offer a change", () => {
    const cv = m();
    const cert = cv.certifications[0];
    const s = cleanSuggestions(cv, [
      { section: "Qualifications", current: cert, options: [cert, "ACCA, Professional level in progress"], reason: "Status may be out of date" },
      { section: "Summary", current: "text that is not on the CV", options: ["x"] },
      { section: "Summary", current: cert, options: [] },
      "junk",
    ]);
    expect(s).toEqual([{ id: "s1", section: "Qualifications", current: cert, options: ["ACCA, Professional level in progress"], reason: "Status may be out of date" }]);
  });
  it("applies the chosen option in place and records the person's edit", () => {
    const cv = m();
    const bullet = cv.experience[0].bullets[0];
    cv.suggestions = cleanSuggestions(cv, [{ section: "Experience", current: bullet, options: ["A", "B"], reason: "" }]);
    const out = applySuggestion(cv, "s1", 1)!;
    expect(out.master.experience[0].bullets[0]).toBe("B");
    expect(out.master.suggestions).toEqual([]);
    expect(out.edit).toContain('to "B"');
    expect(cv.experience[0].bullets[0]).toBe(bullet);
  });
  it("refuses an unknown id or option and dismisses without changing the CV", () => {
    const cv = m();
    cv.suggestions = cleanSuggestions(cv, [{ section: "Summary", current: cv.summary.slice(0, 20), options: ["X"], reason: "" }]);
    expect(applySuggestion(cv, "s9", 0)).toBeNull();
    expect(applySuggestion(cv, "s1", 2)).toBeNull();
    const d = dismissSuggestion(cv, "s1");
    expect(d.suggestions).toEqual([]);
    expect(d.summary).toBe(cv.summary);
  });
});
