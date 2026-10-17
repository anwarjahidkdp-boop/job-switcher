// CV file checks shared by the browser (reading) and the server (storage). No parsers here: PDF and DOCX text
// extraction runs in the browser (src/lib/cv/browser-read.ts) to keep the Worker bundle and CPU time small.
export const MAX_CV_BYTES = 10 * 1024 * 1024;
export const MIN_CV_CHARS = 200;
export const MAX_CV_TEXT = 60000;
export type CvKind = "pdf" | "docx" | "txt";

export const MIME: Record<CvKind, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain",
};

export class CvReadError extends Error {}

/** Validate by magic bytes, not by file name. */
export function sniffKind(buf: Uint8Array, fileName = ""): CvKind {
  if (buf.length >= 4 && buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46) return "pdf"; // %PDF
  if (buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04) {
    if (/\.docx$/i.test(fileName) || fileName === "") return "docx";
    throw new CvReadError("Please upload a PDF, DOCX or TXT file, or a photo of your CV.");
  }
  if (/\.txt$/i.test(fileName) || fileName === "") {
    // Plain text: reject binary content.
    const sample = buf.subarray(0, 2048);
    let ctrl = 0;
    for (const b of sample) if (b < 9 || (b > 13 && b < 32)) ctrl++;
    if (ctrl / Math.max(1, sample.length) < 0.02) return "txt";
  }
  throw new CvReadError("Please upload a PDF, DOCX or TXT file, or a photo of your CV.");
}

/** JPEG / PNG / WebP by magic bytes (page images sent for transcription). */
export function sniffImage(buf: Uint8Array): "image/jpeg" | "image/png" | "image/webp" | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  if (buf.length >= 12 && buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 && buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return "image/webp";
  return null;
}

export function tidy(text: string): string {
  return text.replace(/\r/g, "").replace(/[ \t ]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}
