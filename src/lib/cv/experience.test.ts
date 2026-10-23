import { describe, it, expect } from "vitest";
import { newestExperienceFirst } from "./experience";
import { renderCvHtml } from "./render";
import { cvDocHtml, cvPrintHtml } from "./doc";
import { DEMO_MASTER } from "../demo";
import { manualContent, manualDraft } from "../manual-cv";

const old = { title: "Cost Accountant", company: "Gentle Park", start: "2019-08", end: null, location: null, bullets: ["Prepared cost reports."] };
const recent = { ...old, title: "Accounts Manager", start: "2021-10", bullets: ["Managed accounts."] };
describe("experience chronology after manual date edits", () => {
 it("puts the newest current role first, even when both are marked Present", () => {
  const input = [old, recent];
  expect(newestExperienceFirst(input).map(e => e.title)).toEqual(["Accounts Manager", "Cost Accountant"]);
  expect(input[0]).toBe(old); expect(old.end).toBeNull();
 });
 it("puts current roles first and completed roles in descending end-date order", () => {
  const rows = [{ ...old, end: "2023-01" }, { ...recent, end: "2022-12" }, { ...old, title: "Current role", start: "2022-01" }];
  expect(newestExperienceFirst(rows).map(e => e.title)).toEqual(["Current role", "Cost Accountant", "Accounts Manager"]);
 });
 it("keeps equal and missing dates stable", () => {
  const a = { start: null, end: null, title: "Unknown A" }, b = { ...a, title: "Unknown B" };
  expect(newestExperienceFirst([a,b]).map(e=>e.title)).toEqual(["Unknown A","Unknown B"]);
 });
 it("saves the reordered Master CV and matching facts after an old role is ended", () => {
  const before = { ...DEMO_MASTER, experience: [old, recent] };
  const draft = manualDraft(before, []);
  draft.experience.find(e => e.title === "Cost Accountant")!.end = "2021-09";
  // A new role can also be appended in the editor; save must reorder the payload itself.
  draft.experience.reverse();
  const saved = manualContent(draft, before, []);
  expect(saved.master.experience.map(e => e.title)).toEqual(["Accounts Manager","Cost Accountant"]);
  expect(saved.facts.filter(f=>f.kind==='experience').map(f=>f.data.title)).toEqual(["Accounts Manager","Cost Accountant"]);
  expect(saved.master.experience[1].end).toBe("2021-09");
 });
 it("uses the same order for existing CV previews, PDF printing and Word", () => {
  const input = { master: { ...DEMO_MASTER, experience: [old,recent] }, country: "BD" as const, style: { tpl: "classic" as const } };
  for (const html of [renderCvHtml(input), cvDocHtml(input), cvPrintHtml(input)]) {
   expect(html.indexOf("Accounts Manager")).toBeLessThan(html.indexOf("Cost Accountant"));
  }
 });
});
