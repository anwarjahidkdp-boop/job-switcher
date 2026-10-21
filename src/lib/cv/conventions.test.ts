import { describe, expect, it } from "vitest";
import { convention, mergePersonal, personalFields, personalRows } from "./conventions";

describe("CV conventions", () => {
  it("picks country rules, then region rules, then the base", () => {
    expect(convention("BD")).toMatchObject({ refs: "list", refCount: 2, declaration: true, sign: true, paper: "A4" });
    expect(convention("US")).toMatchObject({ paper: "Letter", refs: "none" });
    expect(convention("DE")).toMatchObject({ sign: true, dateLocale: "de-DE" });
    expect(convention("QA").fields).toContain("notice");
    expect(convention("XX").paper).toBe("A4");
  });
  it("keeps personal details off countries that avoid them unless hand-checked", () => {
    expect(convention("GB").fields).toEqual(["visa"]);
    expect(convention("ES").fields).toContain("dob");
    expect(convention("PL").fields.every((f) => ["visa", "licence", "notice"].includes(f))).toBe(true);
  });
  it("shows only filled rows, with the country's visa label", () => {
    expect(personalRows(convention("GB"), { visa: "Requires sponsorship", dob: "1990" })).toEqual([["Right to work", "Requires sponsorship"]]);
    expect(personalRows(convention("AE"), {}, 60)).toEqual([["Notice period", "60 days"]]);
  });
  it("form boxes exclude notice period and carry hints", () => {
    const f = personalFields("BD");
    expect(f.map((x) => x.k)).toEqual(["fatherName", "motherName", "dob", "nationality", "marital", "religion", "address"]);
    expect(f.every((x) => x.hint)).toBe(true);
  });
  it("merges a form without losing details kept for another country, and blank clears", () => {
    const prev = { fatherName: "A", dob: "1990", visa: "x", references: [{ name: "R", phone: "1" }] };
    expect(mergePersonal(prev, { visa: "", dob: "1991" })).toEqual({ fatherName: "A", dob: "1991", references: [{ name: "R", title: "", org: "", phone: "1", email: "", relation: "" }] });
    expect(mergePersonal(prev, { references: [{ name: "" }], evil: "<x>" })).toEqual({ fatherName: "A", dob: "1990", visa: "x" });
  });
});
