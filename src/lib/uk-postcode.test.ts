import { expect, it } from "vitest";
import { ukTownFromPostcode } from "./uk-postcode";
import { rowToJob } from "./jobs";
it("names the town for a bare UK postcode and leaves other locations alone", () => {
  expect(ukTownFromPostcode("B375DP")).toBe("Birmingham, B37 5DP");
  expect(ukTownFromPostcode("SW1A0AA")).toBe("London, SW1A 0AA");
  expect(ukTownFromPostcode("EH10 4BG")).toBe("Edinburgh, EH10 4BG");
  expect(ukTownFromPostcode("Greater Manchester")).toBe("Greater Manchester");
  expect(ukTownFromPostcode(null)).toBeNull();
});
it("lets a Birmingham postcode job match a Birmingham preference", () => {
  const j = rowToJob({ id: "p", owner_id: null, source_kind: "board", source_label: "Reed", country: "GB", title: "Healthcare Assistant", company: "C", industry: null, category: null, location: "B375DP", employment_type: null, salary_min: null, salary_max: null, min_years: null, max_years: null, seniority: null, education: null, required_skills: [], preferred_skills: [], certs: [], visa_sponsorship: null, deadline: null, published_at: null, apply_method: null, apply_target: null, url: null, responsibilities: [] });
  expect(j.location).toBe("Birmingham, B37 5DP");
  expect(j.location!.toLowerCase().includes("birmingham")).toBe(true);
});
