import { describe, expect, it } from "vitest";
import { renderCvHtml } from "./render";
import { cvDocHtml, cvPrintHtml } from "./doc";
import { DEMO_MASTER } from "../demo";

describe("CV templates", () => {
  it("renders the modern template with sidebar and accent for Bangladesh, with initials placeholder", () => {
    const h = renderCvHtml({ master: DEMO_MASTER, country: "BD", style: { tpl: "modern", accent: "#1E3A5F" } });
    expect(h).toContain('class="cv t-modern"');
    expect(h).toContain("--cva:#1E3A5F");
    expect(h).toContain("ph-empty");
    expect(h).toContain("Professional Experience");
  });
  it("hides photo and personal details for the UK and uses the classic template by default", () => {
    const h = renderCvHtml({ master: DEMO_MASTER, country: "GB", personal: { nationality: "Bangladeshi", dob: "1 Jan 1990" }, photoUrl: "data:image/jpeg;base64,AAAA" });
    expect(h).toContain("t-classic");
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
    expect(h).toContain(">Summary<");
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
});
