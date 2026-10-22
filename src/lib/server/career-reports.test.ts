import {describe,it,expect} from "vitest";
import {reportWeek,reportBody} from "./career-reports";
describe("career report periods",()=>{
 it.each(["2026-10-26T00:00:00Z","2026-11-01T23:59:59Z"])("uses the same completed UTC week on %s",now=>{
  const w=reportWeek(new Date(now));expect(w.start.toISOString()).toBe("2026-10-19T00:00:00.000Z");expect(w.end.toISOString()).toBe("2026-10-26T00:00:00.000Z");
 });
 it("handles year boundaries",()=>{const w=reportWeek(new Date("2027-01-01T00:00:00Z"));expect(w.start.toISOString()).toBe("2026-12-21T00:00:00.000Z");});
 it("reports personal counts without implying a hiring probability",()=>{expect(reportBody({jobs_analysed:12,relevant:3,strong:1,prepared:2,applied:1,interviews:0,offers:0,top_gap:"SQL",next_deadline:null})).toContain("Jobs checked for you: 12 · Relevant: 3 · Strong Fit: 1");});
});
