import { describe, it, expect } from "vitest";
import { answerChoices } from "./QuestionsForm";
import { vi } from "vitest";
vi.mock("server-only", () => ({}));
import { cleanAnswerChoices } from "@/lib/server/onboarding";

describe("suggested answers", () => {
  it("uses the question's own suggestions first", () => {
    expect(answerChoices({ id: "q1", question: "Team size?", placeholder: "e.g. 3", suggestions: ["1 person", "3 people"] })).toEqual(["1 person", "3 people"]);
  });
  it("falls back to the examples in the placeholder", () => {
    expect(answerChoices({ id: "q1", question: "?", placeholder: "e.g. Still there, now Senior Accountant / Left in June 2025, now at ABC Ltd" })).toEqual(["Still there, now Senior Accountant", "Left in June 2025, now at ABC Ltd"]);
    expect(answerChoices({ id: "q1", question: "?", placeholder: "Leave blank if none" })).toEqual([]);
  });
  it("keeps at most 4 short, distinct AI suggestions", () => {
    expect(cleanAnswerChoices(["A", "a", "", "x".repeat(81), "B", "C", "D", "E"])).toEqual(["A", "B", "C", "D"]);
    expect(cleanAnswerChoices("nope")).toEqual([]);
  });
});
