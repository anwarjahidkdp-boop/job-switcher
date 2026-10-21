import { describe, expect, it } from "vitest";
import { normCompany, parseCsv, parseSponsors } from "./sponsors";

describe("normCompany", () => {
  it("drops legal suffixes, punctuation and case", () => {
    expect(normCompany("The Acme (UK) Ltd.")).toBe("acme");
    expect(normCompany("ACME")).toBe("acme");
    expect(normCompany("Smith & Jones LLP")).toBe("smith and jones");
    expect(normCompany("Deliveroo Limited t/a Deliveroo")).toBe("deliveroo");
  });
});

describe("parseCsv", () => {
  it("handles quotes and CRLF", () => {
    expect(parseCsv('a,"b, c","d ""e"""\r\n1,2,3\r\n')).toEqual([["a", "b, c", 'd "e"'], ["1", "2", "3"]]);
  });
});

describe("parseSponsors", () => {
  it("merges routes per employer", () => {
    const csv = '﻿"Organisation Name","Town/City","County","Type & Rating","Route"\n"Acme Ltd","London","","Worker (A rating)","Skilled Worker"\n"ACME LIMITED","London","","Worker (A rating)","Global Business Mobility: Senior or Specialist Worker"\n"Beta plc",Leeds,,x,Skilled Worker\n';
    const s = parseSponsors(csv);
    expect(s).toHaveLength(2);
    expect(s[0]).toEqual({ name_norm: "acme", name: "Acme Ltd", town: "London", routes: ["Skilled Worker", "Global Business Mobility: Senior or Specialist Worker"] });
    expect(s[1].name_norm).toBe("beta");
  });
});
