import { describe, expect, it } from "vitest";
import { answerSkillFacts, appearsIn, groundExtraction, verifiedOnly } from "./facts";
import { DEMO_CV_TEXT, DEMO_EXTRACT } from "./demo";

describe("grounding AI extraction against the CV", () => {
  const facts = groundExtraction(DEMO_EXTRACT, DEMO_CV_TEXT);
  it("tags every fact with provenance cv", () => {
    expect(facts.every((f) => f.provenance === "cv")).toBe(true);
  });
  it("verifies facts that appear in the CV", () => {
    const v = verifiedOnly(facts);
    expect(v.filter((f) => f.kind === "experience").length).toBe(2);
    expect(v.filter((f) => f.kind === "education").length).toBe(2);
    expect(v.find((f) => f.kind === "certification")).toBeTruthy();
  });
  it("does not verify an invented employer and drops dates that are not in the CV", () => {
    const x = { ...DEMO_EXTRACT, experiences: [...DEMO_EXTRACT.experiences, { title: "Finance Manager", company: "Padma Oil Company", start: "2012-01", end: "2014-05", industry: "energy" }], skills: [...DEMO_EXTRACT.skills, "power bi"] };
    const f = groundExtraction(x, DEMO_CV_TEXT);
    const invented = f.find((e) => e.kind === "experience" && (e.data as { company: string }).company === "Padma Oil Company")!;
    expect(invented.verified).toBe(false);
    expect((invented.data as { start: string | null }).start).toBeNull();
    expect(f.find((e) => e.kind === "skill" && (e.data as { name: string }).name === "power bi")!.verified).toBe(false);
  });
  it("only accepts answer skills that the answers actually mention", () => {
    const got = answerSkillFacts(["budgeting", "sap", "vat & tax"], "Monthly VAT return and TDS. Only Tally ERP 9", new Set(["vat & tax"]));
    expect(got.map((g) => (g.data as { name: string }).name)).toEqual([]);
    const got2 = answerSkillFacts(["payroll"], "I run payroll for 200 staff", new Set());
    expect(got2[0].provenance).toBe("answer");
  });
  it("appearsIn is case- and punctuation-insensitive", () => {
    expect(appearsIn("Meghna Textile Mills Ltd.", "meghna textile mills ltd (jan 2021)")).toBe(true);
    expect(appearsIn("Imaginary Corp", DEMO_CV_TEXT)).toBe(false);
  });
});

describe("placeholder values from the CV reader", () => {
  it("treats 'not specified in CV' as blank", async () => {
    const { real } = await import("./facts");
    expect(real("not specified in CV")).toBe("");
    expect(real("N/A")).toBe("");
    expect(real("Northern Trust")).toBe("Northern Trust");
  });
});
