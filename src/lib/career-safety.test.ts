import { describe, expect, it } from "vitest";
import { applicationSafety, normaliseDealBreakers } from "./career-safety";
import type { Job, Preferences } from "./types";

const job: Job = { id:"j", country:"US", title:"Accountant", company:"Acme", industry:"finance", category:"accounting", location:"New York", type:"On-site", salaryMin:70000, salaryMax:90000, minYears:2, maxYears:null, seniority:"mid", education:null, required:[], preferred:[], certs:[], visa:null, deadline:null, publishedAt:null, apply:{method:"portal",target:null}, url:null, source:"test", resp:[] };
const prefs: Preferences = { roles:"Accountant", locations:"", salaryMin:null, salaryMax:null, notice:null, mode:"Any" };

describe("applicationSafety", () => {
  it("blocks hard salary and remote-only conflicts", () => {
    const r=applicationSafety(job,prefs,{minSalary:100000,remoteOnly:true},{workAuthorization:"yes"},false);
    expect(r.safe).toBe(false); expect(r.issues.map(x=>x.code)).toEqual(expect.arrayContaining(["salary","remote"]));
  });
  it("never guesses required work authorization", () => {
    const r=applicationSafety(job,prefs,{workAuthorizationRequired:true},{workAuthorization:"unknown"},false);
    expect(r.safe).toBe(false); expect(r.issues.some(x=>x.code==="work_authorization_unknown")).toBe(true);
  });
  it("blocks known no-sponsorship jobs when sponsorship is required", () => {
    const r=applicationSafety({...job,visa:false},prefs,{sponsorshipRequired:true},{},true);
    expect(r.safe).toBe(false); expect(r.issues.some(x=>x.code==="sponsorship")).toBe(true);
  });
  it("blocks excluded companies and contract work", () => {\n    const r=applicationSafety({...job,type:"contract"},prefs,{excludedCompanies:["acme"],noContract:true},{workAuthorization:"yes"},false);\n    expect(r.issues.map(x=>x.code)).toEqual(expect.arrayContaining(["company","contract"]));\n  });\n  it("normalises user lists and numbers", () => {
    expect(normaliseDealBreakers({minSalary:"50000",excludedCompanies:[" ACME "]})).toMatchObject({minSalary:50000,excludedCompanies:["acme"]});
  });
});
