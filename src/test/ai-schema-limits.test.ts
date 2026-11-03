// Every schema sent to Claude as structured output must fit the API's schema limits.
// Over the limit the API answers 400 and the feature never works (paste-a-job, November 2026: 17 union fields).
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import * as schemas from "@/lib/ai/schemas";

// https://platform.claude.com/docs/en/build-with-claude/structured-outputs (schema complexity limits)
const MAX_UNION_PARAMS = 16, MAX_OPTIONAL_PARAMS = 24;

type Node = Record<string, unknown>;
function count(node: unknown, acc = { unions: 0, optional: 0 }) {
  if (Array.isArray(node)) { node.forEach((n) => count(n, acc)); return acc; }
  if (!node || typeof node !== "object") return acc;
  const n = node as Node;
  if (Array.isArray(n.anyOf) || Array.isArray(n.type)) acc.unions++;
  if (n.properties && typeof n.properties === "object") {
    const req = new Set(Array.isArray(n.required) ? n.required as string[] : []);
    acc.optional += Object.keys(n.properties as Node).filter((k) => !req.has(k)).length;
  }
  Object.values(n).forEach((v) => count(v, acc));
  return acc;
}

const all = Object.entries(schemas).filter(([, v]) => v instanceof z.ZodType) as [string, z.ZodType][];

describe("AI output schemas fit the structured-output limits", () => {
  it("finds the schemas", () => expect(all.map(([k]) => k)).toContain("PastedJobSchema"));
  it.each(all)("%s", (_name, s) => {
    const json = (betaZodOutputFormat(s) as unknown as { schema: unknown }).schema;
    const c = count(json);
    expect(c.unions).toBeLessThanOrEqual(MAX_UNION_PARAMS);
    expect(c.optional).toBeLessThanOrEqual(MAX_OPTIONAL_PARAMS);
  });
});

describe("blank answers from the job reader mean 'not stated'", () => {
  it("turns empty strings into missing values", async () => {
    const { aiJobToJob } = await import("@/lib/jobs");
    const j = aiJobToJob({
      title: "Accountant", company: "A company", industry: "", category: "", location: "", type: "",
      eligibility: { minAge: null, maxAge: null, ageAsOf: "" }, salaryMin: null, salaryMax: null, visa: null, minYears: 2, maxYears: null,
      seniority: null, education: null, required: [], preferred: [], certs: [], deadline: "", apply: { method: "unknown", target: "" }, resp: [],
    }, { country: "GB", source: "Pasted by you", today: "2026-11-03" });
    expect(j).toMatchObject({ industry: null, category: "Other", location: null, type: null, deadline: null, apply: { method: "unknown", target: null } });
    expect(j.eligibility).toEqual({});
  });
});
