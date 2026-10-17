import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { extractCvText, sniffKind, CvReadError } from "./extract-text";
import { DEMO_CV_TEXT } from "../demo";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Build a minimal, valid single-page PDF containing the given lines.
function makePdf(lines: string[]): Uint8Array {
  const content = "BT /F1 11 Tf 50 780 Td 14 TL " + lines.map((l) => `(${l.replace(/[()\\]/g, "\\$&")}) '`).join(" ") + " ET";
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objs.forEach((o, i) => { offsets.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offsets.map((n) => String(n).padStart(10, "0") + " 00000 n \n").join("");
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(out);
}

describe("CV text extraction", () => {
  it("reads text from a PDF", async () => {
    const pdf = makePdf(["MD. RAHIM UDDIN", "Senior Executive, Accounts", "Meghna Textile Mills Ltd. (Jan 2021 - Present)"]);
    const r = await extractCvText(pdf, "cv.pdf");
    expect(r.kind).toBe("pdf");
    expect(r.text).toContain("RAHIM UDDIN");
    expect(r.text).toContain("Meghna Textile");
  });
  it("reads text from a DOCX", async () => {
    const buf = readFileSync(fileURLToPath(new URL("./__fixtures__/sample.docx", import.meta.url)));
    const r = await extractCvText(new Uint8Array(buf), "cv.docx");
    expect(r.kind).toBe("docx");
    expect(r.text).toContain("Nirman Holdings");
  });
  it("reads plain text", async () => {
    const r = await extractCvText(new TextEncoder().encode(DEMO_CV_TEXT), "cv.txt");
    expect(r.kind).toBe("txt");
    expect(r.text).toContain("ACADEMIC QUALIFICATION");
  });
  it("rejects files that are not PDF/DOCX/TXT by content", () => {
    expect(() => sniffKind(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 1, 2, 3]), "photo.pdf")).toThrow(CvReadError);
  });
  it("rejects a broken docx", async () => {
    await expect(extractCvText(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3]), "cv.docx")).rejects.toThrow(CvReadError);
  });
});
