import { describe, expect, it } from "vitest";
import { nextVisit, sinceParam, visitSince } from "./visit";

const H = 3_600_000, D = 24 * H, now = Date.parse("2026-10-26T06:00:00Z");

describe("new since your last visit", () => {
  it("shows the last day on a first visit", () => {
    expect(visitSince(undefined, now)).toBe(now - D);
    expect(nextVisit(undefined, now)).toBe(`${now - D}.${now}`);
  });
  it("starts the window at the previous visit once you come back", () => {
    const yesterday = now - 20 * H;
    const cookie = nextVisit(`${yesterday - D}.${yesterday}`, now);
    expect(cookie).toBe(`${yesterday}.${now}`);
    expect(visitSince(cookie, now)).toBe(yesterday);
  });
  it("keeps the same window while you refresh during one visit", () => {
    const start = now - 20 * H, first = now - 10 * 60_000;
    expect(nextVisit(`${start}.${first}`, now)).toBe(`${start}.${now}`);
  });
  it("shows at most a week after a long time away, and ignores bad values", () => {
    expect(visitSince(`${now - 30 * D}.${now - 30 * D}`, now)).toBe(now - 7 * D);
    expect(visitSince("abc", now)).toBe(now - D);
    expect(visitSince(`${now + D}.${now + D}`, now)).toBe(now - D);
    expect(sinceParam(String(now - 2 * H), now)).toBe(now - 2 * H);
    expect(sinceParam("x", now)).toBeNull();
  });
});
