import { describe, expect, it } from "vitest";
import { destinationMaster, destinationProse } from "./destination";
import { renderCvHtml } from "./render";
import { DEMO_MASTER } from "../demo";
import { rule } from "../countries";

describe("destination CV adaptation without AI", () => {
  it("localises prose while retaining names, titles, qualifications, facts and the original CV", () => {
    const m = { ...DEMO_MASTER, summary: "Analyzed 25 reports and optimized operations.",
      experience: [{ ...DEMO_MASTER.experience[0], title: "Specialized Analyst", company: "Organized Systems Ltd", bullets: ["Organized 25 reports for 3 organizations."] }] };
    const out = destinationMaster(m, "GB");
    expect(out.summary).toBe("Analysed 25 reports and optimised operations.");
    expect(out.experience[0]).toMatchObject({ title: "Specialized Analyst", company: "Organized Systems Ltd", bullets: ["Organised 25 reports for 3 organisations."] });
    expect(out.education).toEqual(m.education);
    expect(out.certifications).toEqual(m.certifications);
    expect(m.summary).toContain("Analyzed");
    expect(destinationProse(out.summary, "US")).toBe(m.summary);
  });
  it("does not translate prose for destinations without an explicit spelling mapping", () => {
    expect(destinationProse("Organized 25 reports", "BD")).toBe("Organized 25 reports");
  });
  it("changes structure, references, personal fields and destination style for BD, UK and US", () => {
    const personal = { fatherName: "Father", dob: "1990", references: [{ name: "Referee", phone: "123" }], visa: "Requires sponsorship" };
    const input = { master: DEMO_MASTER, personal, photoUrl: "data:image/jpeg;base64,AAAA" };
    const bd = renderCvHtml({ ...input, country: "BD", style: { tpl: rule("BD").tpl } });
    const gb = renderCvHtml({ ...input, country: "GB", style: { tpl: rule("GB").tpl } });
    const us = renderCvHtml({ ...input, country: "US", style: { tpl: rule("US").tpl } });
    expect(bd).toContain("t-modern"); expect(bd).toContain("Referee"); expect(bd).toContain("Declaration");
    expect(gb).toContain("t-classic"); expect(gb).not.toContain("Father"); expect(gb).not.toContain("Referee"); expect(gb).not.toContain("<img");
    expect(gb).toContain("Available on request"); expect(us).not.toContain("References");
    expect(gb).not.toContain("Open to relocate");
  });
});
