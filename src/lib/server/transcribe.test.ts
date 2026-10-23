vi.mock("./matches",()=>({refreshCareerMatches:vi.fn().mockResolvedValue(true)}));
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { transcribeCv } from "./onboarding";
import { CvReadError } from "../cv/sniff";
import { AIError } from "../ai/provider";
import type { Ctx } from "./onboarding";

const ctx = {} as Ctx; // validation fails before any database call
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);

describe("CV photo / scan transcription input checks", () => {
  it("needs 1 to 4 pages", async () => {
    await expect(transcribeCv(ctx, [])).rejects.toThrow(CvReadError);
    await expect(transcribeCv(ctx, [jpeg, jpeg, jpeg, jpeg, jpeg])).rejects.toThrow(/at most 4/);
  });
  it("accepts only real image bytes", async () => {
    await expect(transcribeCv(ctx, [new TextEncoder().encode("%PDF-1.4 not an image")])).rejects.toThrow(/JPG, PNG or WebP/);
  });
  it("refuses without an AI provider (no key in tests) after validating", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    await expect(transcribeCv(ctx, [jpeg])).rejects.toBeInstanceOf(AIError);
  });
});
