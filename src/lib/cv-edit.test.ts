import { describe, expect, it } from "vitest";
import { dropRemoved, EditRefused, factRefs, nextRemoved, planFactEdits, type FactOp } from "./cv-edit";
import type { CareerFact } from "./facts";
import type { MasterCV } from "./types";

const facts: CareerFact[] = [
  { id: "a", kind: "experience", data: { title: "Senior Executive, Accounts", company: "ABC Ltd", start: "2021-01", end: null, location: null, industry: null }, provenance: "cv", verified: true },
  { id: "b", kind: "experience", data: { title: "Accounts Officer", company: "XYZ Group", start: "2017-03", end: "2020-12", location: null, industry: null }, provenance: "cv", verified: true },
  { id: "c", kind: "education", data: { degree: "HSC", field: "Commerce", institution: "Dhaka College", year: "2012", level: "hsc", result: "GPA 4.50" }, provenance: "cv", verified: true },
  { id: "d", kind: "skill", data: { name: "tally erp" }, provenance: "cv", verified: true },
  { id: "e", kind: "answer", data: { answer: "team of 4" }, provenance: "answer", verified: true },
];
// f1..f4 in order; answers are not offered to the editor.
const op = (o: Partial<FactOp> & Pick<FactOp, "op" | "kind">): FactOp => ({ ref: null, values: {}, clear: [], ...o });

describe("planning a typed CV change", () => {
  it("gives short refs to every fact except answers", () => {
    expect(factRefs(facts).map((r) => r.ref + r.fact.id)).toEqual(["f1a", "f2b", "f3c", "f4d"]);
  });

  it("removes a fact and remembers it so a rebuild leaves it out", () => {
    const p = planFactEdits(facts, [op({ op: "remove", kind: "skill", ref: "f4" })], "remove the skill tally");
    expect(p.remove).toEqual(["d"]);
    expect(p.removed).toEqual([{ kind: "skill", label: "tally erp" }]);
  });

  it("updates an end date the person states", () => {
    const p = planFactEdits(facts, [op({ op: "update", kind: "experience", ref: "f2", values: { end: "2024-03" } })], "change my job end date at XYZ to March 2024");
    expect(p.update).toEqual([{ id: "b", data: { ...facts[1].data, end: "2024-03" } }]);
  });

  it("updates a result the person states", () => {
    const p = planFactEdits(facts, [op({ op: "update", kind: "education", ref: "f3", values: { result: "GPA 4.00" } })], "update my HSC result to GPA 4.00");
    expect(p.update[0].data.result).toBe("GPA 4.00");
  });

  it("refuses a value the person did not write", () => {
    expect(() => planFactEdits(facts, [op({ op: "update", kind: "education", ref: "f3", values: { result: "GPA 5.00" } })], "fix my HSC result")).toThrow(EditRefused);
    expect(() => planFactEdits(facts, [op({ op: "update", kind: "experience", ref: "f2", values: { end: "2023-06" } })], "change my end date at XYZ")).toThrow(EditRefused);
  });

  it("only shows a job as current when the person says so", () => {
    expect(() => planFactEdits(facts, [op({ op: "update", kind: "experience", ref: "f2", clear: ["end"] })], "remove the end date at XYZ")).toThrow(EditRefused);
    const p = planFactEdits(facts, [op({ op: "update", kind: "experience", ref: "f2", clear: ["end"] })], "I still work at XYZ");
    expect(p.update[0].data.end).toBeNull();
  });

  it("adds a qualification the person states, as their own verified fact", () => {
    const p = planFactEdits(facts, [op({ op: "add", kind: "certification", values: { name: "ACCA F5", status: "qualified" } })], "add that I passed ACCA F5");
    expect(p.add).toEqual([{ kind: "certification", data: { name: "ACCA F5", status: "qualified", detail: null }, provenance: "user", verified: true, evidence: null }]);
  });

  it("refuses to add details the person did not give", () => {
    expect(() => planFactEdits(facts, [op({ op: "add", kind: "certification", values: { name: "ACCA Performance Management" } })], "add that I passed ACCA F5")).toThrow(EditRefused);
    expect(() => planFactEdits(facts, [op({ op: "add", kind: "experience", values: { title: "Finance Manager" } })], "add Finance Manager")).toThrow(EditRefused);
  });

  it("refuses unknown refs and dates without a month", () => {
    expect(() => planFactEdits(facts, [op({ op: "remove", kind: "skill", ref: "f9" })], "remove sap")).toThrow(EditRefused);
    expect(() => planFactEdits(facts, [op({ op: "update", kind: "experience", ref: "f2", values: { end: "2024" } })], "end date at XYZ 2024")).toThrow(EditRefused);
  });

  it("skips a skill that is already on the CV and restores one removed before", () => {
    expect(planFactEdits(facts, [op({ op: "add", kind: "skill", values: { name: "tally erp" } })], "add tally erp").add).toEqual([]);
    const p = planFactEdits(facts, [op({ op: "add", kind: "skill", values: { name: "power bi" } })], "add the skill Power BI", [{ kind: "skill", label: "power bi" }]);
    expect(p.add.map((f) => f.data.name)).toEqual(["power bi"]);
    expect(nextRemoved([{ kind: "skill", label: "power bi" }], p)).toEqual([]);
  });

  it("does not hide another role at the same employer", () => {
    const two = [...facts, { id: "g", kind: "experience" as const, data: { title: "Intern", company: "XYZ Group", start: null, end: null }, provenance: "cv" as const, verified: true }];
    const p = planFactEdits(two, [op({ op: "remove", kind: "experience", ref: "f5" })], "remove the internship at XYZ");
    expect(p.remove).toEqual(["g"]);
    expect(p.removed).toEqual([]);
  });
});

describe("leaving removed items out of a rebuilt CV", () => {
  const m: MasterCV = {
    name: "R", headline: "", contact: "", summary: "",
    experience: [{ title: "Accounts Officer", company: "XYZ Group Ltd.", location: null, start: null, end: null, bullets: [] }, { title: "Senior Executive", company: "ABC Ltd", location: null, start: null, end: null, bullets: [] }],
    education: ["HSC, Dhaka College"], certifications: ["ACCA (partly qualified)"], skills_core: ["Tally ERP", "Excel"], skills_tools: [], languages: ["Bangla", "English"],
  };
  it("drops removed roles, skills and qualifications and keeps the rest", () => {
    const out = dropRemoved(m, [{ kind: "experience", label: "XYZ Group" }, { kind: "skill", label: "tally erp" }, { kind: "certification", label: "ACCA" }]);
    expect(out.experience.map((e) => e.company)).toEqual(["ABC Ltd"]);
    expect(out.skills_core).toEqual(["Excel"]);
    expect(out.certifications).toEqual([]);
    expect(out.education).toEqual(m.education);
  });
});

describe("Bangla instructions", () => {
  it("spots Bangla and reads Bangla digits", async () => {
    const { hasBangla, bnDigits } = await import("./cv-edit");
    expect(hasBangla("আমার রেজাল্ট")).toBe(true);
    expect(hasBangla("remove Tally")).toBe(false);
    expect(bnDigits("জিপিএ ৪.৫০, ২০১৯")).toBe("জিপিএ 4.50, 2019");
  });
});
