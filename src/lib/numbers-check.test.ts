import { describe, expect, it } from "vitest";
import { checkMasterCv, checkPack, packNumbersCheck, unknownNumbers } from "./numbers-check";
import { DEMO_CV_TEXT, DEMO_MASTER, DEMO_PREFS, SAMPLE_JOBS_RAW } from "./demo";
import { sampleToJob } from "./jobs";
import { templatePack } from "./template-pack";
import { buildMatchProfile, groundExtraction } from "./facts";
import { DEMO_EXTRACT } from "./demo";

const TODAY = "2026-10-17";
const job = sampleToJob(SAMPLE_JOBS_RAW[0], TODAY);
const answers = "3\nMonthly VAT return (Mushak 9.1) submission and TDS/VDS calculation\nOnly Tally ERP 9\nNo, not directly";

describe("numbers check", () => {
  it("flags numbers that are not in the sources", () => {
    expect(unknownNumbers(["Cut close time by 40% across 12 entities"], "team of 12")).toEqual(["40"]);
  });
  it("accepts numbers with thousands separators present without them", () => {
    expect(unknownNumbers(["Payroll for 2,000 workers."], "payroll 2000 workers")).toEqual([]);
  });
  it("accepts the prototype demo master CV against its own sources", () => {
    const flags = packNumbersCheck({ summary: DEMO_MASTER.summary, top_bullets: DEMO_MASTER.experience[0].bullets, cover_letter: "", email_body: "" }, { master: DEMO_MASTER, job, prefs: DEMO_PREFS, today: TODAY });
    expect(flags).toEqual([]);
  });
  it("flags an invented number in a pack", () => {
    const flags = packNumbersCheck({ summary: "Managed a budget of 5 crore.", top_bullets: [], cover_letter: "Led 25 people.", email_body: "" }, { master: DEMO_MASTER, job, prefs: DEMO_PREFS, today: TODAY });
    expect(flags[0]).toMatch(/25/);
  });
});

describe("checkPack", () => {
  const P = buildMatchProfile({ name: DEMO_MASTER.name, facts: groundExtraction(DEMO_EXTRACT, DEMO_CV_TEXT), meta: { industries: DEMO_EXTRACT.industries, categories: DEMO_EXTRACT.categories, seniority: "senior", target_roles: [], location: "Dhaka" }, prefs: DEMO_PREFS, country: "BD" });
  it("drops skills that are not in the Master CV and keeps all master skills", () => {
    const pack = templatePack(job, DEMO_MASTER, P, { needVisa: true });
    const { pack: clean, flags } = checkPack({ ...pack, skills_order: ["SAP", ...pack.skills_order] }, DEMO_MASTER, { job, prefs: DEMO_PREFS, today: TODAY });
    expect(clean.skills_order).not.toContain("SAP");
    expect(clean.skills_order.length).toBe(DEMO_MASTER.skills_core.length + DEMO_MASTER.skills_tools.length);
    expect(flags.some((f) => f.includes("SAP"))).toBe(true);
  });
  it("template pack passes the numbers check", () => {
    const { flags } = checkPack(templatePack(job, DEMO_MASTER, P, { needVisa: true }), DEMO_MASTER, { job, prefs: DEMO_PREFS, today: TODAY });
    expect(flags).toEqual([]);
  });
});

describe("checkMasterCv", () => {
  const verifiedCompanies = ["Meghna Textile Mills Ltd.", "Rupali Foods Ltd."];
  it("keeps a faithful master CV", () => {
    const { flags, master } = checkMasterCv(DEMO_MASTER, { cvText: DEMO_CV_TEXT, answersText: answers, verifiedCompanies, verifiedSkills: [] });
    expect(flags).toEqual([]);
    expect(master.experience.length).toBe(2);
  });
  it("removes invented employers, skills and qualifications, and flags invented numbers", () => {
    const bad = {
      ...DEMO_MASTER,
      summary: DEMO_MASTER.summary + " Saved 30% on costs.",
      experience: [...DEMO_MASTER.experience, { title: "CFO", company: "Imaginary Corp", location: null, start: "2010-01", end: "2012-01", bullets: ["Ran everything."] }],
      skills_tools: [...DEMO_MASTER.skills_tools, "SAP S/4HANA"],
      certifications: [...DEMO_MASTER.certifications, "CPA (USA)"],
    };
    const { flags, master } = checkMasterCv(bad, { cvText: DEMO_CV_TEXT, answersText: answers, verifiedCompanies, verifiedSkills: [] });
    expect(master.experience.map((e) => e.company)).not.toContain("Imaginary Corp");
    expect(master.skills_tools).not.toContain("SAP S/4HANA");
    expect(master.certifications).not.toContain("CPA (USA)");
    expect(flags.join(" ")).toMatch(/30/);
  });
});
