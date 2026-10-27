import { expect, it } from "vitest";
import { eligibilityCheck, extractEligibility } from "./eligibility";
import { normaliseJobText, parseSalary, rowToJob } from "./jobs";
import { applicationFee, feeLine } from "./job-asks";
import { salaryText } from "./countries";
import { gapAction } from "./gap-actions";
import type { Job, MatchProfile } from "./types";

const today = "2026-10-27";
const P = { birthDate: "1987-12-05", salaryMin: 30000, salaryConfirmed: true, workAuthorization: "yes" as const, sponsorshipRequired: false } as MatchProfile;
const gov = (payGrade: number | null, extra: Partial<Job> = {}) => ({ id: "j", country: "BD", title: "Assistant Engineer", minYears: 0, salaryMin: 44000, salaryMax: 105900, required: [], preferred: [], certs: [], resp: ["Supervise site work and prepare estimates for the department"], publishedAt: "2026-10-20", eligibility: payGrade == null ? {} : { payGrade }, ...extra }) as unknown as Job;

it("reads Bangladesh pay lines in every printed form, and leaves negotiable or unclear pay out", () => {
  expect(parseSalary("Salary: Tk. 15000 - 20000 (Monthly)")).toEqual({ min: 15000, max: 20000 });
  expect(parseSalary("Salary: ৪৪,০০০–১,০৫,৯০০ টাকা (গ্রেড-৯)")).toEqual({ min: 44000, max: 105900 });
  expect(parseSalary("Salary: গ্রেড-৯: ৪৪,০০০-১০,৫৯,০০ টাকা")).toEqual({ min: 44000, max: 105900 });
  expect(parseSalary("বেতনক্কেল: ৪৪০০০-১০৫৯০০/- (প্রেড-৯)")).toEqual({ min: 44000, max: 105900 });
  expect(parseSalary("বেতনক্কেল: ২০.০০০-৪৮৪০০/-")).toEqual({ min: 20000, max: 48400 });
  expect(parseSalary("Salary: Tk. 52800 (Monthly)")).toEqual({ min: 52800, max: 52800 });
  expect(parseSalary("Salary: 6 lakh per annum")).toEqual({ min: 50000, max: 50000 });
  // An OCR slip ("৪৮১৪০০" for ৪৮,৪০০) keeps only the start of the scale.
  expect(parseSalary("বেতনক্কেল-২০,০০০-৪৮১৪০০/-")).toEqual({ min: 20000, max: null });
  for (const t of ["Salary: Negotiable", "Salary: --", "Salary Review: Yearly", "Salary: আলোচনা সাপেক্ষে", "বেতন গ্রেড: ২০তম"]) expect(parseSalary(t)).toBeNull();
  // A circular listing several posts: its scale lines count only when they agree; the post's own Salary line wins.
  expect(parseSalary("বেতনস্কেল: ৪৪০০০-১০৫৯০০/- (গ্রেড-৯)\nবেতনস্কেল: ৩২০০০-৭৭৩০০/- (গ্রেড-১০)")).toBeNull();
  expect(parseSalary("Salary: 43000-69850 (grade 5)\nবেতনস্কেল: ৩২০০০-৭৭৩০০/-")).toEqual({ min: 43000, max: 69850 });
});

it("stores the parsed pay on Bangladesh jobs only, and drops listing notes from the duties", () => {
  const text = "Vacancies: 2\nSalary: 43000-69850 (grade 5)\nApplication deadline: 2026-11-20\nRead from the published circular image. Confirm all details in the original circular before applying.";
  const bd = normaliseJobText({ title: "Assistant Engineer", company: "KUET", text, country: "BD", source: "t", today });
  expect([bd.salaryMin, bd.salaryMax, bd.eligibility?.payGrade]).toEqual([43000, 69850, 5]);
  expect(bd.resp).toEqual([]);
  expect(normaliseJobText({ title: "Engineer", company: "X", text, country: "GB", source: "t", today }).salaryMax).toBeNull();
  expect(rowToJob({ id: "r", owner_id: null, source_kind: "bdweb", source_label: "t", country: "BD", title: "x", company: "y", industry: null, category: null, location: null, employment_type: null, salary_min: null, salary_max: null, min_years: null, max_years: null, seniority: null, education: null, required_skills: [], preferred_skills: [], certs: [], visa_sponsorship: null, deadline: null, published_at: null, apply_method: null, apply_target: null, url: null, responsibilities: ["Salary: Tk. 15000 - 20000 (Monthly)", "Prepare monthly VAT returns and reconcile ledgers"] }).resp).toEqual(["Prepare monthly VAT returns and reconcile ledgers"]);
});

it("finds a government pay grade only beside pay, and only when a circular's posts agree", () => {
  expect(extractEligibility("Salary: ৪৪,০০০–১,০৫,৯০০ টাকা (গ্রেড-৯)").payGrade).toBe(9);
  expect(extractEligibility("বেতন গ্রেড: ২০তম (পে স্কেল-২০১৫ অনুযায়ী)").payGrade).toBe(20);
  expect(extractEligibility("Grade 5 teacher wanted for our school").payGrade).toBeUndefined();
  const mixed = extractEligibility("১. হিসাব রক্ষক (গ্রেড-১৪) ২৩৫০০-৫৬৮০০\n২. সহকারী পরিচালক (গ্রেড-৫) ৪৩০০০-৬৯৮৫০");
  expect(mixed).toMatchObject({ govPost: true });
  expect(mixed.payGrade).toBeUndefined();
  expect(extractEligibility("We are hiring an accountant. Salary: Tk. 25000 - 35000 (Monthly)").govPost).toBeUndefined();
});

it("applies the legal government age limit of 32 whenever the circular states none, and the circular's own limit otherwise", () => {
  const over = eligibilityCheck(gov(9), P, today);
  expect(over).toMatchObject({ blocked: true, scoreCap: 0 });
  expect(over.issues[0].message).toBe("Government jobs accept applicants up to 32 unless the circular says otherwise. You are 38.");
  expect(eligibilityCheck(gov(5), P, today).blocked).toBe(true);
  expect(eligibilityCheck(gov(null, { eligibility: { govPost: true } }), P, today).blocked).toBe(true);
  expect(eligibilityCheck(gov(9), { ...P, birthDate: "1994-10-21" }, today).blocked).toBe(false);
  expect(eligibilityCheck(gov(9), { ...P, birthDate: "1993-10-19" }, today).blocked).toBe(true);
  expect(eligibilityCheck(gov(9), { ...P, birthDate: null }, today)).toMatchObject({ eligible: false, scoreCap: 54 });
  expect(eligibilityCheck(gov(2, { eligibility: { payGrade: 2, maxAge: 50 } }), P, today).blocked).toBe(false);
  expect(eligibilityCheck(gov(9, { eligibility: { payGrade: 9, minAge: 18, maxAge: 30 } }), { ...P, birthDate: "1995-01-01" }, today).blocked).toBe(true);
  expect(eligibilityCheck(gov(null), P, today).blocked).toBe(false);
  expect(eligibilityCheck(gov(9, { country: "GB" } as Partial<Job>), P, today).blocked).toBe(false);
});

it("explains unpublished pay in plain words and offers the fix", () => {
  const msg = (j: Partial<Job>) => eligibilityCheck(gov(null, { salaryMin: null, salaryMax: null, ...j }), P, today).issues.find((i) => i.code === "salary_unpublished")!.message;
  expect(msg({})).toBe("This job does not publish its salary, so pay is left out of the score. You expect ৳30,000 a month: confirm the pay before applying.");
  expect(msg({ salaryMin: 20000 })).toMatch(/^This job publishes only its starting pay \(৳20,000\)/);
  expect(gapAction("salary_unpublished")).toEqual({ href: "/profile#application-safety", label: "Update salary" });
  expect(gapAction("sal")?.label).toBe("Update salary");
  expect(gapAction("missing")).toBeNull();
  expect(salaryText(44000, 105900, "BD")).toBe("৳44,000–৳1,05,900/mo");
  expect(salaryText(52800, 52800, "BD")).toBe("৳52,800/mo");
  expect(salaryText(20000, null, "BD")).toBe("From ৳20,000/mo");
  expect(salaryText(null, null, "BD")).toBe("");
});

it("reads the application fee a circular charges and how to pay it", () => {
  expect(applicationFee("আবেদন ফি: ১ ও ২ নম্বর পদ: ১১২ টাকা।")).toEqual({ amounts: [112], methods: [] });
  expect(applicationFee("আবেদন ফি ৩ হাজার টাকা, রকেট অথবা নগদের মাধ্যমে জমা দিতে হবে।")).toEqual({ amounts: [3000], methods: ["Nagad", "Rocket"] });
  const f = applicationFee("Application fee: 700 টাকা ব্যাংক ড্রাফট অথবা ট্রেজারি চালান\nপরীক্ষার ফি বাবদ ১০০০/- টাকা পে-অর্ডার");
  expect(f).toEqual({ amounts: [700, 1000], methods: ["bank draft", "treasury challan", "pay order"] });
  expect(feeLine(f!)).toBe("৳700 to ৳1,000, by post or applicant group · pay by bank draft, treasury challan or pay order");
  expect(feeLine({ amounts: [700], methods: ["bank draft"] })).toBe("৳700 · pay by bank draft");
  // "সার্টিফিকেট" contains ফি; a certificate is not a fee.
  expect(applicationFee("এস.এস.সি সার্টিফিকেট ১০০০ টাকা বেতনে")).toBeNull();
  expect(applicationFee("Authorising demand drafts and pay orders for customers")).toBeNull();
});
