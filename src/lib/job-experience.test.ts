import { describe, it, expect } from "vitest";
import { normaliseJobText } from "./jobs";

const years = (text: string) => { const j = normaliseJobText({ title: "Officer", company: "Example Ltd", text, country: "BD", source: "test", today: "2026-10-27" }); return [j.minYears, j.maxYears]; };

describe("experience years in a job text", () => {
  it("never reads an age limit as experience", () => {
    expect(years("- Age limit maximum 30 years.\n- Minimum 4/5 Years of experience in Corporate Sales")).toEqual([4, 5]);
    expect(years("- Age limit maximum 25 years.\n- At least 1/2 year(s) in relevant field.")).toEqual([1, 2]);
    expect(years("Candidates must be under 35 years of age. 3 years experience in accounts.")).toEqual([3, null]);
    expect(years("Age: 22-28 years")).toEqual([null, null]);
  });
  it("ignores a company's age and prefers the count written next to experience", () => {
    expect(years("Our 12 year old company has reached unicorn status.\n- Minimum of 3 years of experience in a similar role.")).toEqual([3, null]);
    expect(years("This is a 2 years contract. You need 5+ years of work experience.")).toEqual([5, null]);
  });
  it("keeps plain experience lines as before", () => {
    expect(years("Experience: 2 to 4 years")).toEqual([2, 4]);
    expect(years("3-5 years")).toEqual([3, 5]);
    expect(years("No experience needed")).toEqual([null, null]);
  });
});
