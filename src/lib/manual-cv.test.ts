import { describe, it, expect } from "vitest";
import { manualContent, manualDraft, ManualCvSchema } from "./manual-cv";
import { DEMO_MASTER } from "./demo";
import type { CareerFact } from "./facts";

const master = { ...DEMO_MASTER, experience: [
 { title: "Cost Accountant", company: "Gentle Park", start: "2018-01", end: "2021-10", location: "Dhaka", bullets: ["Prepared cost reports."] },
 { title: "Accounts Manager", company: "Gentle Park", start: "2021-11", end: null, location: "Dhaka", bullets: ["Managed accounting."] },
] };
const facts: CareerFact[] = [{ kind: "education", data: { degree: "BBA", field: "Accounting", institution: "Test University", year: "2012", level: "bachelors", result: "3.50" }, verified: true, provenance: "cv" }];
describe("manual CV editing without AI", () => {
 it("saves promotion dates separately for two roles at one employer", () => {
  const input = manualDraft(master, facts);
  input.experience[0].start = "2021-11";
  input.experience[0].bullets = ["Monitored team activities.", "Prepared monthly budgets."];
  const out = manualContent(ManualCvSchema.parse(input), master, facts);
  expect(out.master.experience[1].end).toBe("2021-10");
  expect(out.facts.filter(f => f.kind === "experience").map(f => f.data.start)).toEqual(["2021-11", "2018-01"]);
  expect(out.master.experience[0].bullets).toContain("Monitored team activities.");
  expect(out.master.education).toEqual(master.education);
 });
 it("syncs changes to education, certification status and skills with matching facts", () => {
  const input = manualDraft(master, facts); input.education[0].result = "4.00";
  input.certifications = [{ name: "ACCA", status: "partly", detail: "F5 passed" }];
  input.skills_core = ["Excel"]; input.skills_tools = ["Excel", "Power BI"];
  const out = manualContent(input, master, facts);
  expect(out.master.education[0]).toContain("4.00"); expect(out.master.certifications[0]).toContain("partly qualified");
  expect(out.facts.filter(f => f.kind === "certification")[0].data.status).toBe("partly");
  expect(out.facts.filter(f => f.kind === "skill").map(f => f.data.name)).toEqual(["advanced excel", "power bi"]);
  expect(out.master.suggestions).toEqual([]);
 });
 it("keeps deletions out of both the CV and matching profile", () => {
  const input = manualDraft(master, facts); input.experience = []; input.education = []; input.certifications = []; input.skills_core = []; input.skills_tools = []; input.languages = [];
  const out = manualContent(input, master, facts);
  expect(out.facts).toEqual([]); expect(out.master.experience).toEqual([]); expect(out.master.education).toEqual([]);
 });
 it("validates month values, reversed dates and required role fields", () => {
  const input = manualDraft(master, facts); input.experience[1].start = "2021-13";
  expect(ManualCvSchema.safeParse(input).success).toBe(false);
  input.experience[1].start = "2024-01"; input.experience[1].end = "2023-01";
  expect(ManualCvSchema.safeParse(input).success).toBe(false);
  input.experience[1].end = null; input.experience[1].company = "";
  expect(ManualCvSchema.safeParse(input).success).toBe(false);
 });
});
