import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import robots from "./robots";
import sitemap from "./sitemap";

describe("search engines", () => {
  it("keeps every signed-in page out of results and lists only public pages", () => {
    const protectedPaths = JSON.parse(readFileSync("src/middleware.ts", "utf8").match(/const PROTECTED = (\[[^\]]+\])/)![1]) as string[];
    const rules = robots().rules as { disallow: string[] };
    for (const p of protectedPaths) expect(rules.disallow).toContain(p);
    for (const { url } of sitemap()) expect(protectedPaths.some((p) => new URL(url).pathname.startsWith(p))).toBe(false);
  });
});
