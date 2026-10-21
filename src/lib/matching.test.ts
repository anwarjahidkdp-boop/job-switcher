import { describe, expect, it } from "vitest";
import { bandOf, CAP_SCORE, roleRel, scoreJob, W, yearsFrom, inboxList, scoreAll, skillImpact } from "./matching";
import { buildMatchProfile, groundExtraction } from "./facts";
import { DEMO_CV_TEXT, DEMO_EXTRACT, DEMO_PREFS, SAMPLE_JOBS_RAW } from "./demo";
import { guessCategory, sampleToJob } from "./jobs";
import type { Job, MatchProfile } from "./types";

const TODAY = "2026-10-17";
const NOW = new Date("2026-10-17T12:00:00Z").getTime();
const jobs = SAMPLE_JOBS_RAW.map((s) => sampleToJob(s, TODAY));
const job = (id: string) => jobs.find((j) => j.id === id)!;

function demoProfile(country = "BD", prefs = DEMO_PREFS): MatchProfile {
  const facts = groundExtraction(DEMO_EXTRACT, DEMO_CV_TEXT);
  const meta = { industries: DEMO_EXTRACT.industries, categories: DEMO_EXTRACT.categories, seniority: DEMO_EXTRACT.seniority, target_roles: DEMO_EXTRACT.target_roles, location: DEMO_EXTRACT.location };
  const p = buildMatchProfile({ name: DEMO_EXTRACT.name, facts, meta, prefs, country });
  return { ...p, years: yearsFrom([{ start: "2017-07", end: "2020-12" }, { start: "2021-01", end: null }], NOW) };
}
const opts = { today: TODAY, needVisa: true };

describe("weights and bands", () => {
  it("uses the blueprint weights summing to 100", () => {
    expect(W).toEqual({ role: 25, skills: 25, exp: 15, sen: 10, ind: 7, edu: 6, cert: 5, loc: 4, sal: 3 });
    expect(Object.values(W).reduce((a, b) => a + b, 0)).toBe(100);
  });
  it("bands at 85 / 70 / 55", () => {
    expect(bandOf(100)).toBe("ex");
    expect(bandOf(85)).toBe("ex");
    expect(bandOf(84)).toBe("st");
    expect(bandOf(70)).toBe("st");
    expect(bandOf(69)).toBe("po");
    expect(bandOf(55)).toBe("po");
    expect(bandOf(54)).toBe("lo");
    expect(bandOf(0)).toBe("lo");
  });
});

describe("scoreJob (demo profile, Bangladesh)", () => {
  const P = demoProfile();
  it("profile is built from grounded CV facts", () => {
    expect(P.skills.map((s) => s.name)).toContain("vat & tax");
    expect(P.years).toBeGreaterThan(9);
    expect(P.certs).toEqual([{ name: "ACCA", status: "partly" }]);
  });
  it("rates the close accounts role as Excellent", () => {
    const m = scoreJob(job("j1"), P, opts);
    expect(m.band).toBe("ex");
    expect(m.score).toBeGreaterThanOrEqual(85);
    expect(m.relevant).toBe(true);
    expect(m.matched[0]).toMatch(/years of experience/);
    expect(m.capped).toBe(false);
  });
  it("caps at 69 when a required certification is not fully held", () => {
    const m = scoreJob(job("j5"), P, opts); // FP&A manager: CA or CMA required
    expect(m.score).toBeLessThanOrEqual(CAP_SCORE);
    expect(m.band).not.toBe("st");
    expect(m.allGaps.some((g) => g.k === "cert" && /required; not in your profile/.test(g.t))).toBe(true);
    // Uncapped the same job would score higher once the cert is held:
    const withCert = scoreJob(job("j5"), { ...P, certs: [{ name: "CMA", status: "qualified" }] }, opts);
    expect(withCert.allGaps.some((g) => g.k === "cert")).toBe(false);
  });
  it("partly-qualified required cert still caps, with the cap reason", () => {
    const strong: Job = { ...job("j1"), id: "t1", certs: [{ names: ["ACCA"], required: true }] };
    const m = scoreJob(strong, P, opts);
    expect(m.capped).toBe(true);
    expect(m.score).toBe(CAP_SCORE);
    expect(m.reason).toBe("Certification requirement");
    expect(m.gaps[0].t).toMatch(/partly qualified/);
  });
  it("marks expired vacancies", () => {
    const m = scoreJob(job("j10"), P, opts);
    expect(m.expired).toBe(true);
    expect(m.reason).toBe("Expired vacancy");
  });
  it("is deterministic", () => {
    expect(scoreJob(job("j2"), P, opts)).toEqual(scoreJob(job("j2"), P, opts));
  });
  it("inbox lists only relevant, open, >=55 jobs, best first", () => {
    const list = inboxList(scoreAll(jobs, P, opts), new Set());
    expect(list.length).toBeGreaterThan(3);
    expect(list.every((x) => x.m.relevant && !x.m.expired && x.m.score >= 55)).toBe(true);
    expect(list.map((x) => x.m.score)).toEqual([...list.map((x) => x.m.score)].sort((a, b) => b - a));
    expect(list.find((x) => x.job.id === "j16")).toBeUndefined(); // software engineer is not relevant
    expect(list.find((x) => x.job.country !== "BD")).toBeUndefined();
  });
  it("skill impact reports how many more jobs would reach Strong", () => {
    const sc = scoreAll(jobs, P, opts);
    const r = skillImpact(sc, P, "erp", opts);
    expect(r.after).toBeGreaterThanOrEqual(r.before);
    expect(r.where.length).toBeGreaterThan(0);
  });
});

describe("visa sponsorship cap (abroad)", () => {
  const P = demoProfile("CA", { ...DEMO_PREFS, locations: "", salaryMin: null, salaryMax: null });
  it("caps at 69 when the job offers no sponsorship and the user needs it", () => {
    const m = scoreJob(job("ca1"), P, opts); // visa: false
    expect(m.score).toBeLessThanOrEqual(CAP_SCORE);
    expect(m.allGaps.some((g) => g.k === "visa")).toBe(true);
    const unc = scoreJob(job("ca1"), P, { ...opts, needVisa: false });
    if (unc.score > CAP_SCORE) {
      expect(m.capped).toBe(true);
      expect(m.reason).toBe("Visa sponsorship");
    }
  });
  it("does not cap when the user has their own right to work", () => {
    const m = scoreJob(job("ca1"), P, { ...opts, needVisa: false });
    expect(m.allGaps.some((g) => g.k === "visa")).toBe(false);
  });
  it("credits offered sponsorship", () => {
    const PA = demoProfile("AE", { ...DEMO_PREFS, locations: "", salaryMin: null, salaryMax: null });
    const m = scoreJob(job("ae1"), PA, opts);
    expect(m.matched).toContain("Visa sponsorship offered");
    expect(m.capped).toBe(false);
  });
  it("never applies the visa rule to home-country jobs", () => {
    const P2 = demoProfile();
    const m = scoreJob({ ...job("j1"), visa: false }, P2, opts);
    expect(m.allGaps.some((g) => g.k === "visa")).toBe(false);
  });
});

describe("yearsFrom", () => {
  it("merges overlapping intervals", () => {
    expect(yearsFrom([{ start: "2020-01", end: "2020-12" }, { start: "2020-06", end: "2021-12" }], NOW)).toBeCloseTo(2, 0);
  });
});

describe("role part of the title decides relevance", () => {
  const P = demoProfile("BD");
  const rel = (title: string) => roleRel({ title, category: "Finance & Accounting" }, P) >= 0.6;
  it("drops other professions that only mention finance after a separator", () => {
    expect(rel("Customer Experience Representative, Trump Accounts")).toBe(false);
    expect(rel("Software Engineer, Bill Pay & Procurement")).toBe(false);
    expect(rel("Full Stack Software Engineer - Codex for Finance")).toBe(false);
    expect(rel("Forward Deployed Engineer (FDE), Financial Services- NYC")).toBe(false);
    expect(rel("Account Manager | Mid-Market")).toBe(false);
  });
  it("keeps finance roles, including level-first titles", () => {
    expect(rel("Assistant Manager, Accounts")).toBe(true);
    expect(rel("Director, Strategic Finance")).toBe(true);
    expect(rel("Senior Accountant - Tax")).toBe(true);
    expect(rel("Manager (Internal Audit)")).toBe(true);
  });
});

describe("guessCategory", () => {
  it("reads the role, not the team", () => {
    expect(guessCategory("Software Engineer, Bill Pay & Procurement", ["accounts payable"])).toBe("IT");
    expect(guessCategory("Customer Experience Representative, Trump Accounts")).toBe("Customer Service");
    expect(guessCategory("Account Executive | Commercial", ["budgeting"])).toBe("Sales");
    expect(guessCategory("Director, Strategic Finance")).toBe("Finance & Accounting");
    expect(guessCategory("Senior Accounts Manager")).toBe("Finance & Accounting");
    expect(guessCategory("Analyst", ["accounts payable"])).toBe("Finance & Accounting");
  });
});
