// All fixtures in __fixtures__/alerts are SYNTHETIC: hand-written emails with invented companies and job IDs.
// They are not copies of real portal emails. Tuning against a real Bdjobs alert is still pending (BUILD_NOTES.md).
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseRawEmail } from "./parse";
import { dedupeJobs, jobUrl, looksLikeAlert, parseAlert, parseDate, portalFromSender, unwrapUrl } from "./alerts";

const TODAY = "2026-10-17";
const fixture = (name: string) => readFileSync(fileURLToPath(new URL(`./__fixtures__/alerts/${name}`, import.meta.url)), "utf8");
async function parseFixture(name: string) {
  const m = await parseRawEmail(fixture(name));
  return parseAlert({ from: m.from, subject: m.subject, html: m.html, text: m.text, today: TODAY });
}

describe("alert links", () => {
  it("unwraps redirect and tracking links carrying the original URL", () => {
    expect(unwrapUrl("https://click.bdjobs.com/track?uid=7&url=https%3A%2F%2Fjobs.bdjobs.com%2Fjobdetails.asp%3Fid%3D1298765")).toBe("https://jobs.bdjobs.com/jobdetails.asp?id=1298765");
    expect(unwrapUrl("https://www.google.com/url?q=https://www.reed.co.uk/jobs/x/51234567&sa=D")).toBe("https://www.reed.co.uk/jobs/x/51234567");
    const b64 = btoa("https://www.seek.com.au/job/78123456");
    expect(unwrapUrl(`https://t.example.net/c?d=${b64}`)).toBe("https://www.seek.com.au/job/78123456");
    expect(unwrapUrl("https://t.example.net/opaque/abc123")).toBe("https://t.example.net/opaque/abc123");
  });
  it("canonicalises job detail URLs per portal and ignores other pages", () => {
    expect(jobUrl("https://www.linkedin.com/comm/jobs/view/4012345678/?trackingId=a")?.url).toBe("https://www.linkedin.com/jobs/view/4012345678/");
    expect(jobUrl("https://uk.indeed.com/rc/clk?jk=a1b2c3d4e5f60718&from=ja")?.url).toBe("https://uk.indeed.com/viewjob?jk=a1b2c3d4e5f60718");
    expect(jobUrl("https://jobs.bdjobs.com/jobdetails.asp?id=1299001&ln=1")).toEqual({ url: "https://jobs.bdjobs.com/jobdetails.asp?id=1299001", portal: "Bdjobs" });
    expect(jobUrl("https://bdjobs.com/jobsearch.asp?fcatId=1")).toBeNull();
    expect(jobUrl("https://www.linkedin.com/comm/jobs/search/?keywords=x")).toBeNull();
    expect(jobUrl("https://mybdjobs.bdjobs.com/alert/unsubscribe.asp?id=77")).toBeNull();
    expect(jobUrl("https://evil.example/bdjobs.com/jobs/details/1299555")).toBeNull();
  });
  it("detects the portal from the sender domain", () => {
    expect(portalFromSender("Bdjobs.com <jobalert@bdjobs.com>")).toBe("Bdjobs");
    expect(portalFromSender("Bayt <alerts@mail.bayt.com>")).toBe("Bayt");
    expect(portalFromSender("Someone <me@gmail.com>")).toBeNull();
  });
  it("parses alert date formats", () => {
    expect(parseDate("20 Nov 2026", TODAY)).toBe("2026-11-20");
    expect(parseDate("Nov 28, 2026", TODAY)).toBe("2026-11-28");
    expect(parseDate("05/11/2026", TODAY)).toBe("2026-11-05");
    expect(parseDate("15 December 2026", TODAY)).toBe("2026-12-15");
    expect(parseDate("2026-12-01", TODAY)).toBe("2026-12-01");
    expect(parseDate("3rd Jan", TODAY)).toBe("2027-01-03");
    expect(parseDate("soon", TODAY)).toBeNull();
  });
});

describe("synthetic alert emails", () => {
  it("Bdjobs-style HTML: titles, companies, locations, deadlines; duplicates merged", async () => {
    const r = await parseFixture("bdjobs-synthetic.eml");
    expect(r.portal).toBe("Bdjobs");
    expect(r.jobs).toHaveLength(3);
    expect(r.jobs[0]).toEqual({ title: "Senior Executive, Accounts & Finance", company: "Meghna Agro Foods Ltd.", location: "Dhaka (Tejgaon)", deadline: "2026-11-20", url: "https://jobs.bdjobs.com/jobdetails.asp?id=1298765" });
    expect(r.jobs[1]).toMatchObject({ title: "Assistant Manager - VAT & Tax", company: "Padma Ceramics PLC", location: "Chattogram", deadline: "2026-11-05" });
    expect(r.jobs[2]).toMatchObject({ title: "Accounts Officer", company: "Rupsha Shipping Lines", location: "Khulna", deadline: "2026-11-28", url: "https://bdjobs.com/jobs/details/1299555" });
  });
  it("LinkedIn-style HTML: 'Company · Location' lines and tracking parameters", async () => {
    const r = await parseFixture("linkedin-synthetic.eml");
    expect(r.portal).toBe("LinkedIn");
    expect(r.jobs.map((j) => [j.title, j.company, j.location])).toEqual([
      ["Finance Manager", "Crescent Trading LLC", "Dubai, United Arab Emirates"],
      ["Financial Controller", "Al Noor Hospitality Group", "Abu Dhabi, United Arab Emirates (On-site)"],
    ]);
    expect(r.jobs[0].url).toBe("https://www.linkedin.com/jobs/view/4012345678/");
  });
  it("Bayt-style HTML: redirect links, missing company left empty for the AI pass", async () => {
    const r = await parseFixture("gulf-mixed-synthetic.eml");
    expect(r.portal).toBe("Bayt");
    expect(r.jobs[0]).toEqual({ title: "Senior Accountant", company: "Gulf Star Contracting", location: "Sharjah, UAE", deadline: "2026-12-15", url: "https://www.bayt.com/en/uae/jobs/senior-accountant-4987654/" });
    expect(r.jobs[1]).toMatchObject({ title: "Payroll Specialist", url: "https://www.bayt.com/en/saudi-arabia/jobs/payroll-specialist-4988001/" });
    // "Riyadh, Saudi Arabia" is a place, but nothing marks it as one; we only claim what the email states.
    expect(r.jobs).toHaveLength(2);
  });
  it("Indeed-style plain text: blocks before each link, 'Title at Company'", async () => {
    const r = await parseFixture("indeed-plain-synthetic.eml");
    expect(r.portal).toBe("Indeed");
    expect(r.jobs).toEqual([
      { title: "Management Accountant", company: "Thames Valley Foods Ltd", location: "London", deadline: null, url: "https://uk.indeed.com/viewjob?jk=a1b2c3d4e5f60718" },
      { title: "Assistant Accountant", company: "Northbridge Housing", location: "London EC1", deadline: null, url: "https://uk.indeed.com/viewjob?jk=0f9e8d7c6b5a4321" },
    ]);
  });
  it("manually forwarded mix: SEEK, Reed, JobStreet, GulfTalent, Naukrigulf, safelinks-wrapped LinkedIn", async () => {
    const r = await parseFixture("others-synthetic.eml");
    const byTitle = Object.fromEntries(r.jobs.map((j) => [j.title, j]));
    expect(r.jobs).toHaveLength(6);
    expect(byTitle["Finance Business Partner"]).toMatchObject({ company: "Harbourline Logistics", location: "Sydney NSW", url: "https://www.seek.com.au/job/78123456" });
    expect(byTitle["Credit Controller"]).toMatchObject({ company: "Elm Street Partners", location: "Leeds", url: "https://www.reed.co.uk/jobs/credit-controller/51234567" });
    expect(byTitle["Account Executive"]).toMatchObject({ company: "Sinar Maju Sdn Bhd", location: "Kuala Lumpur", url: "https://my.jobstreet.com/job/81234567" });
    expect(byTitle["Internal Auditor"]).toMatchObject({ company: "Desert Rose Holding", deadline: "2026-11-30" });
    expect(byTitle["Accounts Manager"]).toMatchObject({ company: null, url: expect.stringContaining("naukrigulf.com/accounts-manager-jobs") });
    expect(byTitle["Treasury Analyst"]).toMatchObject({ company: "Eastbay Bank", url: "https://www.linkedin.com/jobs/view/4019876543/" });
  });
  it("dedupes by (title, company) across different links", () => {
    const j = { title: "Accounts Officer", company: "Rupsha Shipping Lines Ltd.", location: null, deadline: null, url: "https://a.example/1" };
    expect(dedupeJobs([j, { ...j, company: "Rupsha Shipping Lines", url: "https://a.example/2", deadline: "2026-11-01" }])).toHaveLength(1);
  });
  it("recognises alerts with no job links as worth an AI pass", () => {
    expect(looksLikeAlert("5 new jobs for you", "x@y.com", "")).toBe(true);
    expect(looksLikeAlert("Lunch on Friday?", "friend@gmail.com", "See you")).toBe(false);
  });
});
