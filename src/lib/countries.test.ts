import { describe, expect, it } from "vitest";
import { ALL_COUNTRIES, cc, cname, COUNTRY_CODES, money, portals, rule } from "./countries";
import { WORLD } from "./world";
import { languagesRequired } from "./jobs";

describe("every country", () => {
  it("lists all countries once, popular ones first", () => {
    expect(WORLD.length).toBeGreaterThan(190);
    expect(new Set(ALL_COUNTRIES.map((c) => c.code)).size).toBe(ALL_COUNTRIES.length);
    expect(ALL_COUNTRIES.slice(0, COUNTRY_CODES.length).map((c) => c.code)).toEqual(COUNTRY_CODES);
  });
  it("gives any country region rules with its own name, currency and time zone", () => {
    const pl = rule("PL");
    expect(pl.name).toBe("Poland");
    expect(pl.prompt).toContain("Poland");
    expect(pl.prompt).toContain("PLN");
    expect(pl.timeZone).toBe("Europe/Warsaw");
    expect(rule("JP").photo).toBe(true);
    expect(money(5000, "FR")).toBe("€5,000");
    expect(portals("QA")).toContain("Bayt");
    for (const w of WORLD) expect(rule(w.code).rules.length).toBeGreaterThan(0);
  });
  it("keeps the hand-written rules and old codes", () => {
    expect(rule("DE").doc).toBe("CV");
    expect(rule("DE").checklist.join(" ")).toContain("Anschreiben");
    expect(cname("US")).toBe("USA");
    expect(cc("uk")).toBe("GB");
    expect(cc("XX")).toBe("XX");
    expect(cc("nope")).toBe("BD");
  });
});

describe("languagesRequired", () => {
  it("finds required languages and ads written in German", () => {
    expect(languagesRequired("Fluent German and English required.")).toEqual(["german"]);
    expect(languagesRequired("Italian (C1) is a must. Spanish is a plus.")).toEqual(["italian"]);
    expect(languagesRequired("Wir suchen für unser Team eine Buchhalterin mit Erfahrung und Sie haben die Fähigkeit, bei der Arbeit mit uns")).toEqual(["german"]);
    expect(languagesRequired("Senior accountant, strong Excel skills, London.")).toEqual([]);
  });
});
