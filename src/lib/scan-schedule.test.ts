import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SCAN_CRON, clock, dueMarkets, lastUpdate, nextUpdate, updateTimes } from "./scan-schedule";

const at = (s: string) => Date.parse(s);

describe("fresh-job update schedule", () => {
  it("is the schedule the ingest workflow runs on", () => {
    expect(readFileSync(".github/workflows/ingest.yml", "utf8")).toContain(`cron: "${SCAN_CRON}"`);
  });
  it("updates Bangladesh at 8 am, 3 pm and 10 pm Dhaka time", () => {
    expect(updateTimes("BD")).toBe("8 am, 3 pm and 10 pm");
    expect(nextUpdate("BD", at("2026-10-26T19:20:00Z")).toISOString()).toBe("2026-10-27T02:00:00.000Z"); // 1:20 am -> 8 am
    expect(lastUpdate("BD", at("2026-10-26T19:20:00Z")).toISOString()).toBe("2026-10-26T16:00:00.000Z"); // 10 pm
    expect(lastUpdate("BD", at("2026-10-26T09:00:00Z")).toISOString()).toBe("2026-10-26T09:00:00.000Z"); // 3 pm sharp
    expect(clock(nextUpdate("BD", at("2026-10-26T05:00:00Z")), "Asia/Dhaka")).toBe("3 pm");
  });
  it("follows UK summer and winter time", () => {
    expect(updateTimes("GB")).toBe("7 am, 12 pm and 9 pm");
    expect(nextUpdate("GB", at("2026-10-27T05:00:00Z")).toISOString()).toBe("2026-10-27T07:00:00.000Z"); // GMT
    expect(nextUpdate("GB", at("2026-07-01T05:00:00Z")).toISOString()).toBe("2026-07-01T06:00:00.000Z"); // BST
  });
  it("uses the default times elsewhere, in half-hour zones too", () => {
    expect(updateTimes("IN")).toBe("8 am, 1 pm and 9 pm");
    expect(nextUpdate("IN", at("2026-10-26T00:00:00Z")).toISOString()).toBe("2026-10-26T02:30:00.000Z"); // 8 am IST
  });
  it("prepares each market two hours ahead, even when the hourly run starts late", () => {
    // The 00:10 UTC run prepares the 02:00 UTC update: 8 am in Dhaka.
    expect(dueMarkets(["BD", "GB"], at("2026-10-26T00:10:00Z"))).toEqual(["BD"]);
    expect(dueMarkets(["BD", "GB"], at("2026-10-26T00:55:00Z"))).toEqual(["BD"]);
    // The 05:10 UTC run prepares 07:00 UTC: 7 am in London (GMT).
    expect(dueMarkets(["BD", "GB"], at("2026-10-26T05:10:00Z"))).toEqual(["GB"]);
    expect(dueMarkets(["BD", "GB"], at("2026-10-26T03:10:00Z"))).toEqual([]);
  });
});
