import { describe, expect, it } from "vitest";
import { isSetupKey, siteDone, sitesDone } from "./setup";

describe("setup progress per job site", () => {
  const s = { forward: true, "alerts:Bdjobs": true, "filter:Bdjobs": true };
  it("counts only the sites that are set up", () => {
    expect(siteDone(s, "Bdjobs")).toBe(true);
    expect(siteDone(s, "LinkedIn")).toBe(false);
    expect(sitesDone(s, ["Bdjobs", "LinkedIn"])).toBe(1);
    expect(sitesDone(s, ["Indeed", "LinkedIn"])).toBe(0);
  });
  it("treats an arrived alert as set up", () => expect(siteDone({ "test:Indeed": true }, "Indeed")).toBe(true));
  it("accepts only known key shapes", () => {
    expect(isSetupKey("forward")).toBe(true);
    expect(isSetupKey("alerts:Job Bank")).toBe(true);
    expect(isSetupKey("plan")).toBe(false);
    expect(isSetupKey("alerts:<x>")).toBe(false);
  });
});
