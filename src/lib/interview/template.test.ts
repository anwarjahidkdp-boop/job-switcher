import { describe, expect, it } from "vitest";
import { templateInterview } from "./template";
import { DEMO_MASTER, SAMPLE_JOBS_RAW } from "../demo";
import { sampleToJob } from "../jobs";

const job = sampleToJob(SAMPLE_JOBS_RAW[0], "2026-10-17");

describe("templateInterview", () => {
  const prep = templateInterview(job, DEMO_MASTER);
  it("covers the standard topics for this job", () => {
    expect(prep.questions.length).toBeGreaterThanOrEqual(8);
    const topics = new Set(prep.questions.map((q) => q.topic));
    for (const t of ["about_you", "technical", "behavioural", "salary"]) expect(topics.has(t as never)).toBe(true);
    expect(prep.questions.some((q) => q.question.includes(job.company))).toBe(true);
  });
  it("answers only from the CV and marks where the person must add their own example", () => {
    const cur = DEMO_MASTER.experience[0];
    expect(prep.questions[0].answer).toContain(cur.company);
    expect(prep.questions.filter((q) => q.answer.includes("[")).length).toBeGreaterThan(3);
    for (const q of prep.questions) expect(q.why.length).toBeGreaterThan(10);
  });
  it("gives questions to ask and a checklist", () => {
    expect(prep.ask_them.length).toBeGreaterThanOrEqual(3);
    expect(prep.checklist.length).toBeGreaterThanOrEqual(5);
  });
});

describe("templateInterview punctuation", () => {
  it("does not double the full stop after names like Ltd.", () => {
    const p = templateInterview({ ...job, company: "Acme Ltd." }, DEMO_MASTER);
    for (const q of p.questions) { expect(q.answer).not.toMatch(/\.\.(?!\.)/); expect(q.question).not.toMatch(/\.\.(?!\.)/); }
  });
});
