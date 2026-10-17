// Server-side CV text extraction for PDF / DOCX / TXT. Validates by magic bytes, not by file name.
// Scanned (image-only) PDFs yield little text; callers ask the user to paste text instead (no OCR in the MVP).
import "server-only";
import { extractText, getDocumentProxy } from "unpdf";
import mammoth from "mammoth";

export const MAX_CV_BYTES = 10 * 1024 * 1024;
export const MIN_CV_CHARS = 200;
export type CvKind = "pdf" | "docx" | "txt";

export const MIME: Record<CvKind, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain",
};

export class CvReadError extends Error {}

export function sniffKind(buf: Uint8Array, fileName = ""): CvKind {
  if (buf.length >= 4 && buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46) return "pdf"; // %PDF
  if (buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04) {
    if (/\.docx$/i.test(fileName) || fileName === "") return "docx";
    throw new CvReadError("Please upload a PDF, DOCX or TXT file.");
  }
  if (/\.txt$/i.test(fileName) || fileName === "") {
    // Plain text: reject binary content.
    const sample = buf.subarray(0, 2048);
    let ctrl = 0;
    for (const b of sample) if (b < 9 || (b > 13 && b < 32)) ctrl++;
    if (ctrl / Math.max(1, sample.length) < 0.02) return "txt";
  }
  throw new CvReadError("Please upload a PDF, DOCX or TXT file.");
}

export function tidy(text: string): string {
  return text.replace(/\r/g, "").replace(/[ \t ]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

export async function extractCvText(buf: Uint8Array, fileName = ""): Promise<{ kind: CvKind; text: string }> {
  if (buf.byteLength > MAX_CV_BYTES) throw new CvReadError("That file is larger than 10 MB.");
  const kind = sniffKind(buf, fileName);
  let text = "";
  try {
    if (kind === "pdf") {
      const pdf = await getDocumentProxy(new Uint8Array(buf));
      const res = await extractText(pdf, { mergePages: true });
      text = res.text;
    } else if (kind === "docx") {
      const res = await mammoth.extractRawText({ buffer: Buffer.from(buf) });
      text = res.value;
    } else {
      text = new TextDecoder("utf-8").decode(buf);
    }
  } catch {
    throw new CvReadError("We could not read this file. If it is a scanned image, paste the text instead.");
  }
  return { kind, text: tidy(text) };
}
