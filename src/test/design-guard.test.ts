// Design guard: the owner approved the current look (home v9, PR #175). Every line of these files at that commit
// must still be present, unchanged. New lines may be added around them. A deliberate, owner-approved redesign
// regenerates src/test/design-guard.json in the same pull request (see the "base" commit inside it).
import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import guard from "./design-guard.json";

const fp = (l: string) => createHash("sha256").update(l).digest("hex").slice(0, 16);

describe("approved design is unchanged", () => {
  for (const [file, lines] of Object.entries(guard.files)) {
    it(`keeps every approved line of ${file}`, () => {
      const now = new Set(readFileSync(file, "utf8").split("\n").map((l) => l.trim()).filter(Boolean).map(fp));
      const missing = lines.filter((h) => !now.has(h));
      expect(missing, `${missing.length} approved line(s) of ${file} were changed or removed`).toEqual([]);
    });
  }
});
