import { describe, expect, it } from "vitest";
import { proAmounts, renderCvHtml } from "./render";
import { cvDocHtml, cvPrintHtml, pageCss } from "./doc";
import { DEMO_MASTER } from "../demo";

describe("CV templates", () => {
  it("renders the modern template with sidebar and accent for Bangladesh, with initials placeholder", () => {
    const h = renderCvHtml({ master: DEMO_MASTER, country: "BD", style: { tpl: "modern", accent: "#1E3A5F" } });
    expect(h).toContain('class="cv t-modern"');
    expect(h).toContain("--cva:#1E3A5F");
    expect(h).toContain("ph-empty");
    expect(h).toContain("Professional Experience");
  });
  it("hides photo and personal details for the UK and uses the corporate template by default", () => {
    const h = renderCvHtml({ master: DEMO_MASTER, country: "GB", personal: { nationality: "Bangladeshi", dob: "1 Jan 1990" }, photoUrl: "data:image/jpeg;base64,AAAA" });
    expect(h).toContain("t-corp");
    expect(h).not.toContain("<img");
    expect(h).not.toContain("Bangladeshi");
    expect(h).toContain("Open to relocate to UK");
  });
  it("shows personal details and photo where the country expects them", () => {
    const h = renderCvHtml({ master: DEMO_MASTER, country: "AE", personal: { nationality: "Bangladeshi", visa: "Requires employment visa" }, photoUrl: "data:image/jpeg;base64,AAAA" });
    expect(h).toContain("Bangladeshi");
    expect(h).toContain("Visa status");
    expect(h).toContain("<img");
  });
  it("uses Résumé headings and trims to one page in the US", () => {
    const h = renderCvHtml({ master: DEMO_MASTER, country: "US" });
    expect(h).toContain("Work Experience");
    expect(h).toContain(">Executive Summary<");
  });
  it("escapes user content and rejects unsafe photo URLs", () => {
    const h = renderCvHtml({ master: { ...DEMO_MASTER, name: "<script>x</script>" }, country: "BD", photoUrl: "javascript:alert(1)" });
    expect(h).not.toContain("<script>");
    expect(h).not.toContain("javascript:");
  });
  it("highlights tailored summary on screen but not in Word", () => {
    const t = { summary: "Tailored summary.", top_bullets: ["A"], skills_order: ["VAT & withholding tax"] };
    expect(renderCvHtml({ master: DEMO_MASTER, tailored: t, country: "BD" })).toContain("<mark>Tailored summary.</mark>");
    const doc = cvDocHtml({ master: DEMO_MASTER, tailored: t, country: "BD" });
    expect(doc).toContain("Tailored summary.");
    expect(doc).not.toContain("<mark>");
    expect(doc).toContain("<table");
  });
  it("produces a printable A4 page", () => {
    const p = cvPrintHtml({ master: DEMO_MASTER, country: "BD" });
    expect(p).toContain("@page{size:A4");
    expect(p).toContain("<!doctype html>");
  });
  it("corporate template lifts measurable results into Career Highlights without repeating them", async () => {
    const { careerHighlights } = await import("./render");
    const exp = [{ bullets: ["Cut month-end close from 10 to 5 working days across 3 entities", "Managed the team"] }, { bullets: ["Recovered BDT 2.4 million in overpayments through supplier audits", "Prepared VAT returns"] }];
    expect(careerHighlights(exp)).toHaveLength(2);
    expect(careerHighlights([{ bullets: ["No numbers here at all, only duties listed"] }])).toEqual([]);
    const h = renderCvHtml({ master: DEMO_MASTER, country: "GB" });
    expect(h).toContain("Areas of Expertise");
    expect(h).toContain("Executive Profile");
    for (const b of careerHighlights(DEMO_MASTER.experience)) expect(h.split(b.replace(/&/g, "&amp;")).length - 1).toBeLessThanOrEqual(1);
    expect(cvDocHtml({ master: DEMO_MASTER, country: "GB" })).toContain('class="corp"');
  });
});

describe("CV print polish", () => {
  it("writes lakh/crore shorthand out in full without changing the figure", () => {
    expect(proAmounts("Managed 2 lacs+ transactions")).toBe("Managed more than 200,000 transactions");
    expect(proAmounts("Budget of 1.5 crore")).toBe("Budget of 15,000,000");
    expect(proAmounts("Tally ERP 9")).toBe("Tally ERP 9");
  });
  it("groups promotions at the same company under one company header in the corporate layout", () => {
    const m = { ...DEMO_MASTER, experience: [
      { title: "Senior Officer", company: "Acme Ltd", start: "2020-01", end: null, bullets: ["Led closing"] },
      { title: "Officer", company: "Acme Ltd", start: "2017-01", end: "2019-12", bullets: ["Booked journals"] },
    ] } as never;
    const h = renderCvHtml({ master: m, country: "GB" });
    expect(h).toContain("role grp");
    expect(h.match(/Acme Ltd/g)!.length).toBe(1);
  });
  it("uses Letter paper with US margins in the US and Canada, A4 elsewhere, and no margin on full-bleed layouts", () => {
    expect(pageCss({ master: DEMO_MASTER, country: "US" })).toContain("size:Letter;margin:0.7in 0.75in");
    expect(pageCss({ master: DEMO_MASTER, country: "CA" })).toContain("size:Letter");
    expect(pageCss({ master: DEMO_MASTER, country: "GB" })).toContain("size:A4;margin:18mm");
    expect(pageCss({ master: DEMO_MASTER, country: "DE" })).toContain("margin:20mm 20mm 18mm 25mm");
    expect(pageCss({ master: DEMO_MASTER, country: "GB", style: { tpl: "modern" } })).toContain("margin:0");
  });
  it("adds a references section for Australia and the GDPR consent line and signature for Italy", () => {
    expect(renderCvHtml({ master: DEMO_MASTER, country: "AU" })).toContain("<h3>References</h3><p>Available on request.</p>");
    const itc = renderCvHtml({ master: DEMO_MASTER, country: "IT", today: new Date("2026-10-21T00:00:00Z") });
    expect(itc).toContain("GDPR");
    expect(itc).toContain('class="sign"');
    expect(itc).toContain("21/10/2026");
  });
});

describe("country conventions on the CV", () => {
  const refs = [{ name: "Md. Rafiqul Islam", title: "Finance Director", org: "Gentle Park Ltd.", phone: "+880 1711 000000", email: "r@x.com", relation: "Former line manager" }, { name: "No Contact" }];
  const bd = { fatherName: "Abdul Karim", motherName: "Rokeya Begum", religion: "Islam", dob: "1 Jan 1990", references: refs };
  it("Bangladesh: parents' names, two listed referees, declaration and signature on every template", () => {
    for (const tpl of ["corporate", "modern", "executive", "classic"] as const) {
      const h = renderCvHtml({ master: DEMO_MASTER, country: "BD", personal: bd, style: { tpl }, today: new Date("2026-10-21T00:00:00Z") });
      expect(h).toContain("Father&#39;s name");
      expect(h).toContain("Abdul Karim");
      expect(h).toContain("Md. Rafiqul Islam");
      expect(h).not.toContain("No Contact");
      expect(h).toContain("I hereby declare");
      expect(h).toContain("Date: 21/10/2026");
    }
  });
  it("UK: no personal details or referee contacts, right to work shown, references on request", () => {
    const h = renderCvHtml({ master: DEMO_MASTER, country: "GB", personal: { ...bd, visa: "British citizen" } });
    expect(h).not.toContain("Abdul Karim");
    expect(h).not.toContain("Rafiqul");
    expect(h).toContain("Right to work");
    expect(h).toContain("Available on request.");
    expect(h).not.toContain("I hereby declare");
  });
  it("US: no references section at all", () => {
    expect(renderCvHtml({ master: DEMO_MASTER, country: "US", personal: bd })).not.toContain("References");
  });
  it("Gulf: notice period from preferences and driving licence", () => {
    const h = renderCvHtml({ master: DEMO_MASTER, country: "AE", personal: { licence: "UAE driving licence" }, noticeDays: 30 });
    expect(h).toContain("30 days");
    expect(h).toContain("UAE driving licence");
  });
  it("Word export carries the same closing block", () => {
    const h = cvDocHtml({ master: DEMO_MASTER, country: "BD", personal: bd });
    expect(h).toContain("Md. Rafiqul Islam");
    expect(h).toContain("I hereby declare");
  });
});
