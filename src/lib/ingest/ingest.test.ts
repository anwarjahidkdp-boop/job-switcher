import { describe, expect, it } from "vitest";
import { extractJobPostings, postingToJob, countryFromLocation } from "./jsonld";
import { parseGreenhouse, parseLever } from "./ats";
import { robotsAllows } from "./robots";

const TODAY = "2026-10-17";
const PAGE = `<html><head>
<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"Organization","name":"Acme"},{"@type":"JobPosting","title":"Assistant Manager, Accounts","hiringOrganization":{"@type":"Organization","name":"Acme Knit Ltd."},
"datePosted":"2026-10-10","validThrough":"2026-10-30T23:59","employmentType":"FULL_TIME",
"jobLocation":{"@type":"Place","address":{"@type":"PostalAddress","addressLocality":"Dhaka","addressCountry":"BD"}},
"description":"<p>Minimum 5 years experience. Bachelor's degree in accounting.</p><ul><li>Prepare monthly financial reporting and bank reconciliation</li><li>Handle VAT and withholding tax returns for the group</li></ul><p>Preferred: ERP experience.</p>",
"baseSalary":{"@type":"MonetaryAmount","currency":"BDT","value":{"@type":"QuantitativeValue","minValue":60000,"maxValue":80000,"unitText":"MONTH"}},"identifier":{"@type":"PropertyValue","value":"AK-101"}}]}</script>
<script type="application/ld+json">not json</script></head></html>`;

describe("JSON-LD JobPosting", () => {
  it("finds postings inside @graph and skips invalid blocks", () => {
    expect(extractJobPostings(PAGE)).toHaveLength(1);
  });
  it("normalises a posting deterministically", () => {
    const j = postingToJob(extractJobPostings(PAGE)[0], { country: "BD", sourceLabel: "Company careers page", pageUrl: "https://acme.example/careers", today: TODAY })!;
    expect(j.title).toBe("Assistant Manager, Accounts");
    expect(j.company).toBe("Acme Knit Ltd.");
    expect(j.country).toBe("BD");
    expect(j.deadline).toBe("2026-10-30");
    expect(j.minYears).toBe(5);
    expect(j.education?.level).toBe("bachelors");
    expect(j.required).toEqual(expect.arrayContaining(["financial reporting", "bank reconciliation", "vat & tax"]));
    expect(j.preferred).toContain("erp");
    expect(j.salaryMin).toBe(60000);
    expect(j.seniority).toBe("senior");
    expect(j.externalId).toBe("AK-101");
  });
  it("maps locations to countries", () => {
    expect(countryFromLocation("Dubai, UAE", "BD")).toBe("AE");
    expect(countryFromLocation("Somewhere", "MY")).toBe("MY");
  });
});

describe("ATS boards", () => {
  it("parses Greenhouse jobs", () => {
    const json = { jobs: [{ id: 42, title: "Senior Software Engineer (Backend)", absolute_url: "https://boards.greenhouse.io/acme/jobs/42", location: { name: "Kuala Lumpur" }, content: "&lt;p&gt;3+ years with Node.js, SQL and REST APIs. We offer visa sponsorship.&lt;/p&gt;", first_published: "2026-10-01T00:00:00Z" }] };
    const [j] = parseGreenhouse(json, { country: "BD", company: "Acme", sourceLabel: "Acme (Greenhouse)", today: TODAY });
    expect(j.country).toBe("MY");
    expect(j.required).toEqual(expect.arrayContaining(["node.js", "sql", "rest apis"]));
    expect(j.visa).toBe(true);
    expect(j.externalId).toBe("gh:42");
    expect(j.minYears).toBe(3);
  });
  it("parses Lever postings", () => {
    const json = [{ id: "abc", text: "HR Business Partner", hostedUrl: "https://jobs.lever.co/acme/abc", createdAt: Date.parse("2026-10-05"), categories: { location: "London", commitment: "Full-time" }, descriptionPlain: "Talent acquisition and employee relations. We are unable to sponsor visas.", lists: [{ text: "Requirements", content: "<li>HRIS experience</li>" }] }];
    const [j] = parseLever(json, { country: "GB", company: "Acme", sourceLabel: "Acme (Lever)", today: TODAY });
    expect(j.country).toBe("GB");
    expect(j.visa).toBe(false);
    expect(j.required).toEqual(expect.arrayContaining(["talent acquisition", "employee relations", "hris"]));
    expect(j.publishedAt).toBe("2026-10-05");
  });
});

describe("robots.txt", () => {
  const txt = "User-agent: *\nDisallow: /private\nAllow: /private/jobs\n\nUser-agent: BadBot\nDisallow: /";
  it("honours disallow/allow with longest match", () => {
    expect(robotsAllows(txt, "/careers")).toBe(true);
    expect(robotsAllows(txt, "/private/x")).toBe(false);
    expect(robotsAllows(txt, "/private/jobs/1")).toBe(true);
  });
  it("blocks everything when told to", () => {
    expect(robotsAllows("User-agent: *\nDisallow: /", "/careers")).toBe(false);
  });
});

describe("countryFromLocation for global boards", () => {
  it("maps US cities and state codes, and leaves unknown places on the fallback", () => {
    expect(countryFromLocation("Austin, TX", "XX")).toBe("US");
    expect(countryFromLocation("San Jose, CA", "XX")).toBe("US");
    expect(countryFromLocation("Toronto, ON", "XX")).toBe("CA");
    expect(countryFromLocation("Edinburgh", "XX")).toBe("GB");
    expect(countryFromLocation("Berlin, Germany", "XX")).toBe("DE");
    expect(countryFromLocation("Remote - Estonia", "XX")).toBe("EE");
    expect(countryFromLocation("Atlanta, Georgia", "XX")).toBe("US");
    expect(countryFromLocation("Bangalore", "XX")).toBe("IN");
    expect(countryFromLocation("Worldwide", "XX")).toBe("XX");
    expect(countryFromLocation("Dhaka, Bangladesh", "XX")).toBe("BD");
  });
});
