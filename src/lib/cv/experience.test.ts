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

import { closeEarlierRoles } from "./experience";
describe("automatic role end dates", () => {
 it("ends a previous Present role in the month before the new role, across employers", () => {
  const rows = closeEarlierRoles([old, { ...recent, company: "Different Company" }]);
  expect(rows[0]).toMatchObject({ end: "2021-09", autoEnd: true });
  expect(rows[1].end).toBeNull(); expect(old.end).toBeNull();
 });
 it("closes each preceding role across three employers, even for identical job titles", () => {
  const rows = closeEarlierRoles([old, { ...old, company: "Second", start: "2021-01" }, { ...old, company: "Third", start: "2024-04" }]);
  expect(rows.map(e=>e.end)).toEqual(["2020-12", "2024-03", null]);
 });
 it("updates automatic end dates when the successor's start date changes", () => {
  const rows = closeEarlierRoles(closeEarlierRoles([old,recent]).map(e => e.title === recent.title ? { ...e, start: "2022-01" } : e));
  expect(rows[0].end).toBe("2021-12");
 });
 it("restores Present when an automatically closing successor is removed", () => {
  const rows = closeEarlierRoles(closeEarlierRoles([old,recent]).filter(e=>e.title===old.title));
  expect(rows[0]).toMatchObject({ end: null, autoEnd: false });
 });
 it("preserves explicitly entered end dates, concurrent roles and unknown or equal starts", () => {
  expect(closeEarlierRoles([{ ...old, end: "2020-03" },recent])[0].end).toBe("2020-03");
  expect(closeEarlierRoles([{ ...old, concurrent: true },recent])[0].end).toBeNull();
  expect(closeEarlierRoles([{ ...old, start: null },recent])[0].end).toBeNull();
  expect(closeEarlierRoles([old,{ ...recent, start: old.start }])[0].end).toBeNull();
 });
 it("keeps a user-restored Present role current after save and reopening", () => {
  const before = { ...DEMO_MASTER, experience: [old,recent] };
  const draft = manualDraft(before, []);
  const prior = draft.experience.find(e=>e.title===old.title)!;
  prior.end = null; prior.autoEnd = false; prior.concurrent = true;
  const saved = manualContent(draft,before,[]);
  const reopened = manualDraft(saved.master, saved.facts.map(f=>({...f,verified:true,provenance:"user" as const})));
  expect(reopened.experience.find(e=>e.title===old.title)).toMatchObject({end:null,concurrent:true});
  expect(saved.facts.find(f=>f.kind==='experience' && f.data.title===old.title)?.data.concurrent).toBe(true);
 });
 it("persists inferred dates in the master and matching facts and displays them in every export", () => {
  const before = { ...DEMO_MASTER, experience: [old,recent] };
  const out = manualContent({ ...manualDraft(before,[]), experience: [old,recent] }, before, []);
  expect(out.master.experience[1]).toMatchObject({end:"2021-09",autoEnd:true});
  expect(out.facts.filter(f=>f.kind==='experience')[1].data.end).toBe("2021-09");
  for(const html of [renderCvHtml({master:before,country:"BD"}), cvDocHtml({master:before,country:"BD"}),cvPrintHtml({master:before,country:"BD"})]) expect(html).toContain("Sep 2021");
 });
});
