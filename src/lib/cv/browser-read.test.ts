// pdf.js (unpdf) and mammoth run in the browser in production; their text paths also run under Node, so we test them here.
import { describe, expect, it } from "vitest";
import { docxText, pdfText, readCvFile } from "./browser-read";
import { sniffKind, sniffImage, CvReadError } from "./sniff";
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

const asFile = (bytes: Uint8Array, name: string, type = "") => new File([bytes as BlobPart], name, { type });

describe("CV text extraction (browser module)", () => {
  it("reads text from a PDF", async () => {
    const pdf = makePdf(["MD. RAHIM UDDIN", "Senior Executive, Accounts", "Meghna Textile Mills Ltd. (Jan 2021 - Present)"]);
    const r = await pdfText(pdf);
    expect(r.text).toContain("RAHIM UDDIN");
    expect(r.text).toContain("Meghna Textile");
    expect(r.pdf.numPages).toBe(1);
  });
  it("reads text from a DOCX", async () => {
    const buf = readFileSync(fileURLToPath(new URL("./__fixtures__/sample.docx", import.meta.url)));
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
    expect(await docxText(ab)).toContain("Nirman Holdings");
    const r = await readCvFile(asFile(new Uint8Array(buf), "cv.docx"));
    expect(r.kind).toBe("docx");
  });
  it("reads plain text", async () => {
    const r = await readCvFile(asFile(new TextEncoder().encode(DEMO_CV_TEXT), "cv.txt", "text/plain"));
    expect(r.kind).toBe("txt");
    expect("text" in r && r.text).toContain("ACADEMIC QUALIFICATION");
  });
  it("rejects files that are not PDF/DOCX/TXT by content", () => {
    expect(() => sniffKind(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 1, 2, 3]), "photo.pdf")).toThrow(CvReadError);
  });
  it("rejects a broken docx", async () => {
    await expect(readCvFile(asFile(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3]), "cv.docx"))).rejects.toThrow(CvReadError);
  });
  it("recognises page images by content", () => {
    expect(sniffImage(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(sniffImage(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png");
    expect(sniffImage(new TextEncoder().encode("%PDF-1.4"))).toBeNull();
  });
});
