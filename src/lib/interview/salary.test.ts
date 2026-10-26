import { describe, expect, it } from "vitest";
import { askRange, offerAdvice, salaryFacts, salaryQuestions, withSalaryPrep } from "./salary";
import { templateInterview } from "./template";
import { DEMO_MASTER, SAMPLE_JOBS_RAW } from "../demo";
import { sampleToJob } from "../jobs";

const base = sampleToJob(SAMPLE_JOBS_RAW[0], "2026-10-17");
const bd = { ...base, country: "BD" as const, title: "Accounts Manager", company: "Acme Ltd", salaryMin: 60000, salaryMax: 80000 };
const uk = { ...base, country: "GB" as const, title: "Management Accountant", company: "Northwind", salaryMin: null, salaryMax: null };
const none = { expected: null, current: null, negotiable: false, noticeDays: null };

describe("salary facts", () => {
  it("uses saved answers, falls back to the preferred range, and drops figures saved for another country", () => {
    expect(salaryFacts({ expectedSalary: 70000, currentSalary: 55000, noticeDays: 30 }, null, "BD", "BD")).toMatchObject({ expected: 70000, current: 55000, noticeDays: 30 });
    expect(salaryFacts({}, { salaryMin: 65000, salaryMax: null, notice: 60 }, "BD", "BD")).toMatchObject({ expected: 65000, noticeDays: 60 });
    expect(salaryFacts({ expectedSalary: 70000, salaryCountry: "BD", currentSalary: 55000 }, null, "GB", "BD")).toMatchObject({ expected: null, current: null });
  });
});

describe("ask range", () => {
  it("aims for the upper half of a posted band and never below the person's own figure", () => {
    expect(askRange(bd, none)).toEqual({ low: 70000, high: 80000 });
    expect(askRange(bd, { ...none, expected: 75000 })).toEqual({ low: 75000, high: 80000 });
    expect(askRange(uk, none)).toBeNull();
    expect(askRange(uk, { ...none, expected: 42000 })).toEqual({ low: 42000, high: 46000 });
  });
});

describe("salary questions", () => {
  it("quotes the posted range in the job's currency and per month in Bangladesh", () => {
    const q = salaryQuestions(bd, { ...none, current: 55000, noticeDays: 30 });
    expect(q).toHaveLength(4);
    expect(q[0].why).toContain("৳60,000 to ৳80,000 a month");
    expect(q[0].answer).toContain("৳70,000 to ৳80,000 a month");
    expect(q[1].answer).toContain("৳55,000 a month");
    expect(q[3].answer).toContain("one month");
  });
  it("uses placeholders, not invented numbers, when nothing is known, and steers away from current pay in the UK", () => {
    const q = salaryQuestions(uk, none);
    expect(q[0].answer).toMatch(/\[your expected range/);
    expect(q[1].answer).not.toMatch(/\d/);
    expect(q[1].answer).toMatch(/value of this role/);
    expect(q[3].answer).toMatch(/\[your notice period/);
  });
  it("replaces the generic salary question and keeps every other question", () => {
    const prep = templateInterview(bd, DEMO_MASTER);
    const other = prep.questions.filter((x) => x.topic !== "salary").length;
    const out = withSalaryPrep(prep, bd, none);
    expect(out.questions.filter((x) => x.topic === "salary")).toHaveLength(4);
    expect(out.questions.length).toBe(other + 4);
    expect(withSalaryPrep(out, bd, none)).toEqual(out);
  });
});

describe("offer advice", () => {
  it("counters inside the posted range and at most 15% above the offer", () => {
    const a = offerAdvice(bd, { ...none, expected: 78000 }, 62000, "Rahim");
    expect(a.counter).toBe(71500);
    expect(a.email.body).toContain("৳71,500 a month");
    expect(a.email.body).toContain("Rahim");
  });
  it("does not push for more base pay when the offer already meets the top of the range", () => {
    const a = offerAdvice(bd, { ...none, expected: 70000 }, 80000, "Rahim");
    expect(a.counter).toBeNull();
    expect(a.verdict).toMatch(/benefits/);
  });
});
