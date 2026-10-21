import { describe, expect, it } from "vitest";
import { isoToCountry, parseAdzuna, parseAshby, parseJooble, parseRecruitee, parseReed, parseRemotive, parseSmartRecruiters, parseWorkable } from "./boards";

const ctx = { country: "XX" as const, company: "Acme", sourceLabel: "Acme careers", today: "2026-10-21" };

describe("isoToCountry", () => {
  it("maps codes and names to our countries, others to XX", () => {
    expect(isoToCountry("bd")).toBe("BD");
    expect(isoToCountry("UK")).toBe("GB");
    expect(isoToCountry("DE")).toBe("DE");
    expect(isoToCountry("ZZ")).toBe("XX");
    expect(isoToCountry("United Arab Emirates")).toBe("AE");
    expect(isoToCountry(null, "Riyadh")).toBe("SA");
  });
});

describe("board parsers", () => {
  it("reads Ashby", () => {
    const j = parseAshby({ jobs: [{ id: "a1", title: "Finance Manager", location: "Dubai", descriptionPlain: "5+ years. IFRS, Excel.", publishedAt: "2026-10-20T09:00:00Z", jobUrl: "https://jobs.ashbyhq.com/acme/a1", address: { postalAddress: { addressCountry: "United Arab Emirates" } } }, { id: "x", title: "Hidden", isListed: false }] }, ctx);
    expect(j).toHaveLength(1);
    expect(j[0]).toMatchObject({ externalId: "ashby:a1", country: "AE", title: "Finance Manager", publishedAt: "2026-10-20", url: "https://jobs.ashbyhq.com/acme/a1" });
  });
  it("reads SmartRecruiters with details", () => {
    const j = parseSmartRecruiters({ content: [{ id: "77", name: "HR Officer", releasedDate: "2026-10-19T00:00:00Z", location: { city: "Kuala Lumpur", country: "my" }, company: { name: "Acme MY", identifier: "AcmeMY" } }] }, { 77: { jobAd: { sections: { jobDescription: { text: "<p>Payroll and recruitment</p>" } } } } }, ctx);
    expect(j[0]).toMatchObject({ externalId: "sr:77", country: "MY", company: "Acme MY", url: "https://jobs.smartrecruiters.com/AcmeMY/77" });
    expect(j[0].description).toContain("Payroll");
  });
  it("reads Workable and Recruitee", () => {
    expect(parseWorkable({ name: "Acme", jobs: [{ title: "Sales Executive", shortcode: "AB12", country: "Saudi Arabia", city: "Riyadh", url: "https://apply.workable.com/j/AB12", description: "<p>Sell</p>", published_on: "2026-10-18" }] }, ctx)[0]).toMatchObject({ externalId: "workable:AB12", country: "SA" });
    expect(parseRecruitee({ offers: [{ id: 5, title: "Accountant", country_code: "GB", city: "London", careers_url: "https://acme.recruitee.com/o/accountant", description: "ACCA", published_at: "2026-10-17 10:00:00 UTC" }] }, ctx)[0]).toMatchObject({ externalId: "recruitee:5", country: "GB", publishedAt: "2026-10-17" });
  });
  it("reads job APIs", () => {
    expect(parseRemotive({ jobs: [{ id: 9, url: "https://remotive.com/remote-jobs/9", title: "Support Agent", company_name: "Foo", candidate_required_location: "USA", description: "<b>Help</b>", publication_date: "2026-10-20T00:00:00" }] }, ctx)[0]).toMatchObject({ externalId: "remotive:9", country: "US", location: "Remote (USA)" });
    expect(parseAdzuna({ results: [{ id: "123", title: "<strong>Data</strong> Analyst", company: { display_name: "Bar" }, location: { display_name: "Leeds" }, redirect_url: "https://adzuna.example/123", created: "2026-10-20T00:00:00Z", salary_min: 30000 }] }, { ...ctx, country: "GB" })[0]).toMatchObject({ externalId: "adzuna:123", title: "Data Analyst", country: "GB", salaryMin: 30000 });
    expect(parseReed({ results: [{ jobId: 7, jobTitle: "Care Assistant", employerName: "Acme Care", locationName: "Leeds", minimumSalary: 24000, maximumSalary: 26000, date: "15/10/2026", expirationDate: "26/11/2026", jobUrl: "https://www.reed.co.uk/jobs/7", jobDescription: "<p>Care</p>" }] }, ctx)[0]).toMatchObject({ externalId: "reed:7", country: "GB", company: "Acme Care", deadline: "2026-11-26" });
    expect(parseJooble({ jobs: [{ id: 1, title: "Marketing Officer", location: "Dhaka", snippet: "Digital marketing", link: "https://jooble.org/desc/1", company: "Baz" }] }, { ...ctx, country: "BD" })[0]).toMatchObject({ externalId: "jooble:1", country: "BD", company: "Baz" });
  });
});

describe("new matches email", () => {
  it("lists jobs and says how many are ready", async () => {
    const { newMatchesEmail } = await import("../email/templates");
    const m = newMatchesEmail({ name: "Md. Rahim Uddin", link: "https://jobpao.app/inbox", total: 2, jobs: [
      { title: "Finance Manager", company: "Acme <Ltd>", location: "Dubai", score: 91, link: "https://jobpao.app/jobs/1", ready: true },
      { title: "Accountant", company: "Bar", location: null, score: 74, link: "https://jobpao.app/jobs/2", ready: false },
    ] });
    expect(m.subject).toBe("2 new jobs match your profile, 1 ready to apply");
    expect(m.text).toContain("Hi Rahim");
    expect(m.html).toContain("Acme &lt;Ltd&gt;");
    expect(m.html).not.toContain("<Ltd>");
  });
});
