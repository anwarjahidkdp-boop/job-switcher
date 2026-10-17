import { describe, expect, it } from "vitest";
import { localHour } from "./reminders";

describe("reminder timing", () => {
  it("computes local hour per time zone", () => {
    const t = new Date("2026-10-17T02:30:00Z");
    expect(localHour("Asia/Dhaka", t)).toBe(8);
    expect(localHour("Europe/London", t)).toBe(3);
    expect(localHour("UTC", new Date("2026-10-17T00:05:00Z"))).toBe(0);
  });
});
