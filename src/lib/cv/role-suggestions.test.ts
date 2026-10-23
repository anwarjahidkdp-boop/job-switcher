import { describe, expect, it } from "vitest";
import { roleSuggestions } from "./role-suggestions";
describe("optional role responsibility suggestions without AI", () => {
 it("offers accounting-management responsibilities for the user's short manager role", () => {
  const s = roleSuggestions("Accounts Manager", ["Full Accounts Management"]);
  expect(s).toContain("Prepared monthly financial and management reports.");
  expect(s).toContain("Monitored team activities and coordinated daily accounting work.");
  expect(s.join(" ")).not.toMatch(/\d/);
 });
 it("selects cost accounting before general accounting and supports other professions", () => {
  expect(roleSuggestions("Cost Accountant",[])[0]).toContain("cost reports");
  expect(roleSuggestions("HR Manager",[])[0]).toContain("recruitment");
  expect(roleSuggestions("Software Developer",[])[0]).toContain("software");
 });
 it("does not append suggestions automatically or duplicate already selected lines", () => {
  const existing = ["Managed day-to-day accounting operations."];
  expect(roleSuggestions("Accounts Manager",existing)).not.toContain(existing[0]);
  expect(existing).toEqual(["Managed day-to-day accounting operations."]);
  expect(roleSuggestions("Unknown role",[])).toEqual([]);
 });
});

it('flags missing or placeholder responsibilities without replacing the user text',async()=>{
 const {experienceNeedsDetails}=await import('./role-suggestions');
 expect(experienceNeedsDetails({bullets:[]})).toBe(true);
 expect(experienceNeedsDetails({bullets:['Full Accounts Management']})).toBe(true);
 expect(experienceNeedsDetails({bullets:['Managed month-end closing and financial reports.','Reviewed reconciliations and supervised the accounting team.']})).toBe(false);
});
