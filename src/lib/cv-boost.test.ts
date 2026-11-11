import { describe, expect, it } from "vitest";
import { applyBoost, boostOffered, boostRole, boostStatus, cleanBoostQuestions, numbersIn } from "./cv-boost";
import { BOOST_APPLY_PROMPT, BOOST_QUESTIONS_PROMPT } from "./prompts";
import type { MasterCV } from "./types";

const m: MasterCV = {
  name: "Sam Carter", headline: "Senior Carer", contact: "", summary: "", education: [], certifications: [], skills_core: [], skills_tools: [], languages: [],
  experience: [
    { title: "Senior Carer", company: "Oak House Care Home", location: "Leeds", start: "2022-03", end: null, bullets: ["Provide personal care to residents with dementia, following individual care plans", "Train new care assistants on moving and handling procedures"] },
    { title: "Care Assistant", company: "Bright Homecare", location: "Leeds", start: "2019-01", end: "2022-02", bullets: ["Supported clients in their own homes with daily living tasks and medication prompts"] },
  ],
};

describe("Strengthen my CV", () => {
  it("is offered for UK searches only", () => {
    expect(boostOffered("GB")).toBe(true);
    expect(boostOffered("BD")).toBe(false);
  });

  it("keeps only usable questions about real recent roles, with the role in the id", () => {
    const qs = cleanBoostQuestions([
      { role: 0, question: "At Oak House, how many residents did you support on a typical shift?", placeholder: "e.g. About 12 residents", suggestions: ["5-10", "10-20", "Not sure", "x".repeat(80)] },
      { role: 0, question: "At Oak House, how many residents did you support on a typical shift?", placeholder: "", suggestions: [] },
      { role: 7, question: "A role that does not exist on the CV at all?", placeholder: "", suggestions: [] },
      { role: 1, question: "Short?", placeholder: "", suggestions: [] },
      { role: 1, question: "At Bright Homecare, how many clients did you visit each day?", placeholder: "e.g. 6 visits", suggestions: [] },
    ], m, "abc");
    expect(qs.map((q) => q.id)).toEqual(["ach_abc_1_r0", "ach_abc_2_r1"]);
    expect(qs[0].suggestions).toEqual(["5-10", "10-20", "Not sure"]);
    expect(boostRole(qs[1].id)).toBe(1);
    expect(boostRole("q1")).toBeNull();
  });

  it("reports open questions, answered ones and results already shown", () => {
    const withResult: MasterCV = { ...m, experience: [{ ...m.experience[0], bullets: ["Supported 12 residents each shift with personal care and medication prompts"] }] };
    const s = boostStatus([{ id: "q1", question: "Setup", placeholder: "" }, { id: "ach_a_1_r0", question: "A", placeholder: "" }, { id: "ach_a_2_r0", question: "B", placeholder: "" }], { q1: "x", ach_a_1_r0: "12 residents" }, withResult);
    expect(s.asked.map((q) => q.id)).toEqual(["ach_a_2_r0"]);
    expect(s.answered).toBe(1);
    expect(s.results).toBe(1);
  });

  it("writes answers into the role and never lets a figure in that nobody gave", () => {
    const out = applyBoost(m, [
      { role: 0, bullets: ["Supported 12 residents with dementia each shift, following individual care plans", "Trained 4 new care assistants on moving and handling procedures", "Cut medication errors by 30% across the home"] },
      { role: 5, bullets: ["Nothing"] },
    ], "About 12 residents\nI trained 4 new starters");
    expect(out.changed).toBe(1);
    expect(out.dropped).toBe(1);
    expect(out.master.experience[0].bullets).toEqual(["Supported 12 residents with dementia each shift, following individual care plans", "Trained 4 new care assistants on moving and handling procedures"]);
    expect(out.master.experience[1]).toEqual(m.experience[1]);
  });

  it("keeps a role as it was when every new bullet had an invented figure", () => {
    const out = applyBoost(m, [{ role: 1, bullets: ["Visited 9 clients a day"] }], "about 6");
    expect(out.changed).toBe(0);
    expect(out.master.experience[1].bullets).toEqual(m.experience[1].bullets);
  });

  it("reads numbers the way people write them", () => {
    expect(numbersIn("Grew sales by 35% to £1,200,000 (4.0 stars)")).toEqual(["35", "1200000", "4"]);
  });

  it("asks like a CV writer and treats the CV and answers as data", () => {
    const ask = BOOST_QUESTIONS_PROMPT(m, "GB", ["Earlier question?"]);
    expect(ask).toContain("Role 0: Senior Carer at Oak House Care Home");
    expect(ask).toContain("Do not repeat these questions");
    expect(ask).toContain("United Kingdom");
    const write = BOOST_APPLY_PROMPT(m, "GB", [{ role: 0, question: "How many residents?", answer: "About 12" }]);
    expect(write).toContain("Never invent a number");
    expect(write).toContain("Answer: About 12");
  });
});
