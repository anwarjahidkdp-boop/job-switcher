import { describe, expect, it } from "vitest";
import { askRows, postAsks } from "./job-asks";

describe("job post asks", () => {
  it("finds the documents in the how-to-apply part of a post", () => {
    const t = "Responsibilities: prepare CVs of clients.\nHow to apply: Interested candidates should send a CV, cover letter, recent passport size photograph, copies of academic certificates, experience certificates and mention expected salary to hr@x.com";
    expect(postAsks(t)).toEqual(["CV", "Cover letter", "Recent photo", "Experience letters", "Academic certificates and transcripts", "Expected salary"]);
  });
  it("returns nothing for an empty post", () => {
    expect(postAsks("")).toEqual([]);
  });
  it("marks what the pack covers and what the person attaches", () => {
    const rows = askRows(["CV", "Cover letter", "Recent photo", "Experience letters", "Expected salary", "Notice period", "CV"], { hasPhoto: true, photoAllowed: true, notice: null, salaryMin: 70000 });
    expect(rows.map((r) => r.status)).toEqual(["ready", "ready", "photo", "you", "ready", "you"]);
  });
});
