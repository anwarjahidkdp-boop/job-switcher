import { describe, expect, it } from "vitest";
import { isoWeek } from "./nudges";

describe("career report scheduling", () => {
  it("uses a stable ISO-week key so paid reports dedupe weekly", () => {
    expect(isoWeek(new Date("2026-10-23T12:00:00Z"))).toBe("2026-W43");
    expect(isoWeek(new Date("2026-10-25T23:59:00Z"))).toBe("2026-W43");
    expect(isoWeek(new Date("2026-10-26T00:01:00Z"))).toBe("2026-W44");
  });
});
