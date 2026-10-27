import { describe, expect, it } from "vitest";
import { scoreAll, type Scored } from "./matching";
import { buildMatchProfile, groundExtraction } from "./facts";
import { DEMO_CV_TEXT, DEMO_EXTRACT, DEMO_PREFS, SAMPLE_JOBS_RAW } from "./demo";
import { sampleToJob } from "./jobs";
import { withAiScores } from "./server/state";
import { gapLabel, scoreGap, splitWhole } from "./score-gap";

const TODAY = "2026-10-17";
const facts = groundExtraction(DEMO_EXTRACT, DEMO_CV_TEXT);
const meta = { industries: DEMO_EXTRACT.industries, categories: DEMO_EXTRACT.categories, seniority: DEMO_EXTRACT.seniority, target_roles: DEMO_EXTRACT.target_roles, location: DEMO_EXTRACT.location };
const P = buildMatchProfile({ name: DEMO_EXTRACT.name, facts, meta, prefs: DEMO_PREFS, country: "BD" });
const rows = scoreAll(SAMPLE_JOBS_RAW.map((s) => sampleToJob(s, TODAY)), P, { today: TODAY, needVisa: true });
const sum = (g: ReturnType<typeof scoreGap>) => g.reasons.reduce((a, r) => a + r.pts, 0);

describe("why one job is short of 100%", () => {
  it("splits whole numbers that still add up", () => {
    expect(splitWhole([5.5, 3.3, 1.2], 10)).toEqual([6, 3, 1]);
    expect(splitWhole([1, 1, 1], 2).reduce((a, b) => a + b)).toBe(2);
    expect(splitWhole([], 5)).toEqual([]);
  });

  it("explains exactly the score the card shows when the rule score is final", () => {
    const short = rows.filter((x) => x.m.score < 100);
    expect(short.length).toBeGreaterThan(3);
    for (const x of short) {
      const g = scoreGap(x);
      expect(g.score).toBe(x.m.score);
      expect(g.missing).toBe(100 - x.m.score);
      expect(g.exact).toBe(true);
      // Every missing point is accounted for, cap included, unless all losses are under one point each.
      if (g.reasons.length) expect(sum(g), x.job.title).toBe(g.missing);
    }
  });

  it("puts a hard cap first with the points it holds back", () => {
    const capped = rows.find((x) => x.m.capped);
    expect(capped).toBeTruthy();
    const g = scoreGap(capped!);
    expect(g.cap?.at).toBe(capped!.m.score);
    expect(g.reasons[0].key).toBe("cap");
    expect(g.reasons[0].pts).toBeGreaterThan(0);
  });

  it("reads the same way when the AI score is final: the AI's reason, and points that add up to its gap", () => {
    const base = rows.find((x) => !x.m.capped && x.m.score < 90)!;
    const ai = { fit: "partial" as const, score: 72, reason: "Strong accounting background, but no audit experience." };
    const [x] = withAiScores([base], new Map([[base.job.id, ai]]));
    const g = scoreGap(x, ai);
    expect(g.source).toBe("ai");
    expect(g.score).toBe(Math.min(72, base.m.scoreCap ?? 100));
    expect(g.missing).toBe(100 - g.score);
    expect(g.aiReason).toBe(ai.reason);
    expect(g.exact).toBe(false);
    expect(sum(g)).toBe(g.missing);
    const none = scoreGap({ job: base.job, m: { ...x.m, score: 72, scoreCap: 100, capped: false, f: { role: 1 } } }, ai);
    expect(none.reasons.map((r) => [r.key, r.pts, r.advice])).toEqual([["ai", none.missing, ai.reason]]);
  });

  it("labels only open jobs in the person's field that are under 100%", () => {
    const x = rows.find((r) => r.m.relevant && !r.m.expired && r.m.score < 100)!;
    expect(gapLabel(x)).toBe(`${100 - x.m.score}% missing · why?`);
    const off = (over: Partial<Scored["m"]>) => gapLabel({ job: x.job, m: { ...x.m, ...over } });
    expect(off({ relevant: false })).toBeNull();
    expect(off({ expired: true })).toBeNull();
    expect(off({ score: 100 })).toBeNull();
  });
});
