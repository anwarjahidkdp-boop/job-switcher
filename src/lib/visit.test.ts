import { describe, expect, it } from "vitest";
import { nextVisit, sinceParam, visitSince } from "./visit";

const MIN = 60_000, H = 3_600_000, D = 24 * H, now = Date.parse("2026-10-26T06:00:00Z");
const U = "9f1c2d3e-aaaa-bbbb-cccc-000000000001", OTHER = "11112222-aaaa-bbbb-cccc-000000000002";
const T = "9f1c2d3eaaaa";

describe("new since your last visit", () => {
  it("shows the last day on the first visit of an older account", () => {
    expect(visitSince(undefined, now, U, now - 90 * D)).toBe(now - D);
    expect(visitSince(undefined, now, U)).toBe(now - D);
    expect(nextVisit(undefined, now, U)).toBe(`0.${now}.${T}`);
  });
  it("shows everything found since joining on a new account's first visit, also after refreshing", () => {
    const joined = now - 30 * H;
    expect(visitSince(undefined, now, U, joined)).toBe(joined);
    const cookie = nextVisit(undefined, now - 5 * MIN, U);
    expect(visitSince(nextVisit(cookie, now, U), now, U, joined)).toBe(joined);
  });
  it("starts the window at the previous visit once you come back", () => {
    const yesterday = now - 20 * H;
    const cookie = nextVisit(`${yesterday - D}.${yesterday}.${T}`, now, U);
    expect(cookie).toBe(`${yesterday}.${now}.${T}`);
    expect(visitSince(cookie, now, U, now - 2 * D)).toBe(yesterday);
    expect(nextVisit(`0.${yesterday}.${T}`, now, U)).toBe(`${yesterday}.${now}.${T}`);
  });
  it("keeps the same window while you refresh during one visit", () => {
    const start = now - 20 * H, first = now - 10 * 60_000;
    expect(nextVisit(`${start}.${first}.${T}`, now, U)).toBe(`${start}.${now}.${T}`);
  });
  it("never uses another account's visits on the same browser", () => {
    const theirs = nextVisit(undefined, now - H, OTHER);
    expect(nextVisit(theirs, now, U)).toBe(`0.${now}.${T}`);
    expect(visitSince(`${now - H}.${now - H}.11112222aaaa`, now, U, now - 2 * H)).toBe(now - 2 * H);
    expect(visitSince(`${now - 2 * H}.${now - H}`, now, U)).toBe(now - D);
  });
  it("shows at most a week after a long time away, and ignores bad values", () => {
    expect(visitSince(`${now - 30 * D}.${now - 30 * D}.${T}`, now, U)).toBe(now - 7 * D);
    expect(visitSince("abc", now, U)).toBe(now - D);
    expect(visitSince(`${now + D}.${now + D}.${T}`, now, U)).toBe(now - D);
    expect(sinceParam(String(now - 2 * H), now)).toBe(now - 2 * H);
    expect(sinceParam("x", now)).toBeNull();
  });
});
