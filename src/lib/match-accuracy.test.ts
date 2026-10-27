import { expect, it } from "vitest";
import { eligibilityCheck } from "./eligibility";
import { roleRel } from "./matching";
import type { Job, MatchProfile } from "./types";

// A cost accountant who once lectured: "Lecturer" alone is in her history, but the subject decides the fit.
const P = { targetRoles: ["Manager Accountant", "Internal Audit Officer", "Cost Accountant"], titles: ["Lecturer", "Senior Accountant"], categories: ["Finance & Accounts", "Education"], skills: [] } as unknown as MatchProfile;

it("reads a teaching title's subject, so a former accounting lecturer is not matched to engineering lectureships", () => {
  const fit = (title: string) => roleRel({ title, category: "Education" }, P);
  for (const t of ["Lecturer (Harbor and River Engineering)", "Lecturer (Institute of Professional Language)", "Lecturer in River Engineering"]) expect(fit(t)).toBeLessThan(0.6);
  for (const t of ["Lecturer (Accounting)", "Lecturer in Accounting", "Lecturer, Department of Accounting & Information Systems", "Lecturer"]) expect(fit(t)).toBe(1);
  expect(fit("Senior Accountant")).toBe(1);
});

it("never calls a listing without requirements a Best or Strong fit, but still lets people apply", () => {
  const job = { id: "j", country: "BD", title: "Accountant", minYears: null, education: null, required: [], preferred: [], certs: [], resp: ["Maintain books of accounts and prepare monthly reports"], salaryMin: 80000, salaryMax: 90000, eligibility: {} } as unknown as Job;
  const r = eligibilityCheck(job, { salaryMin: 70000, salaryConfirmed: true } as MatchProfile, "2026-10-27");
  expect(r).toMatchObject({ scoreCap: 79, eligible: true });
  expect(r.issues.map((i) => i.code)).toEqual(["requirements_thin"]);
  expect(eligibilityCheck({ ...job, minYears: 3 }, { salaryMin: 70000, salaryConfirmed: true } as MatchProfile, "2026-10-27").scoreCap).toBe(100);
  expect(eligibilityCheck({ ...job, resp: [] }, { salaryMin: 70000, salaryConfirmed: true } as MatchProfile, "2026-10-27")).toMatchObject({ scoreCap: 79, eligible: false });
});
