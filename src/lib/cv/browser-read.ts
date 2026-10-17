// Browser-side CV reading. PDF and DOCX text extraction runs on the user's device so the PDF and Word parsers
// stay out of the Cloudflare Worker bundle (size limit) and out of the server's per-request CPU budget.
// Image-only PDFs and photos are rendered to downscaled JPEG pages for AI transcription on the server.
// The heavy libraries are loaded with dynamic import() only when a file is chosen.
import { loadMammoth, loadPdfjs } from "cv-browser-libs";
import { MAX_CV_BYTES, MIN_CV_CHARS, sniffKind, tidy, CvReadError, type CvKind } from "./sniff";

export const MAX_PAGES = 4;
export const PAGE_LONG_EDGE = 1600;
const JPEG_QUALITY = 0.85;

export type BrowserRead =
  | { kind: CvKind; text: string }
  | { kind: "scan"; pages: Blob[]; totalPages: number } // image-only PDF, rendered pages
  | { kind: "image"; pages: Blob[] }; // photos / image files

const IMAGE_RE = /^image\/(jpeg|png|webp|heic|heif|gif|bmp)$/i;
export const isImageFile = (f: File) => IMAGE_RE.test(f.type) || /\.(jpe?g|png|webp|heic|heif)$/i.test(f.name);

/** Extract text from a PDF with pdf.js (unpdf build). Returns the text and the document for page rendering. */
export async function pdfText(bytes: Uint8Array) {
  const { getDocumentProxy, extractText } = await loadPdfjs();
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  const res = await extractText(pdf, { mergePages: true });
  return { pdf, text: tidy(res.text as string) };
}

/** Extract raw text from a DOCX with mammoth's browser build. */
export async function docxText(buf: ArrayBuffer): Promise<string> {
  const mammoth = (await loadMammoth()).default;
  // The browser build reads `arrayBuffer`; the Node build (used by unit tests) reads `buffer`. JSZip accepts either.
  const res = await mammoth.extractRawText({ arrayBuffer: buf, buffer: buf } as unknown as { arrayBuffer: ArrayBuffer });
  return tidy(res.value);
}

function scaleFor(w: number, h: number, longEdge = PAGE_LONG_EDGE) {
  return Math.min(1, longEdge / Math.max(w, h));
}

function canvasToJpeg(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new CvReadError("Could not prepare the page image."))), "image/jpeg", JPEG_QUALITY));
}

/** Decode any image the browser can display (HEIC works where the browser supports it, e.g. Safari) and downscale to JPEG. */
export async function imageToJpeg(file: Blob): Promise<Blob> {
  let src: CanvasImageSource & { width: number; height: number };
  let cleanup = () => {};
  try {
    src = await createImageBitmap(file, { imageOrientation: "from-image" } as ImageBitmapOptions);
    cleanup = () => (src as ImageBitmap).close();
  } catch {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    try { await img.decode(); } catch {
      URL.revokeObjectURL(url);
      throw new CvReadError("This browser cannot open that image format. Take a JPG photo instead, or use the camera button.");
    }
    src = Object.assign(img, { width: img.naturalWidth, height: img.naturalHeight });
    cleanup = () => URL.revokeObjectURL(url);
  }
  try {
    const s = scaleFor(src.width, src.height);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(src.width * s));
    canvas.height = Math.max(1, Math.round(src.height * s));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new CvReadError("Could not prepare the image.");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
    return await canvasToJpeg(canvas);
  } finally {
    cleanup();
  }
}

type PdfDoc = Awaited<ReturnType<typeof pdfText>>["pdf"];

/** Render the first pages of a PDF to JPEG (long edge ~1600 px). */
export async function renderPdfPages(pdf: PdfDoc, max = MAX_PAGES): Promise<Blob[]> {
  const out: Blob[] = [];
  for (let n = 1; n <= Math.min(max, pdf.numPages); n++) {
    const page = await pdf.getPage(n);
    const base = page.getViewport({ scale: 1 });
    // Scale so the long edge is ~1600 px (PDF pages are ~842 pt tall, so this usually scales up for legibility).
    const viewport = page.getViewport({ scale: PAGE_LONG_EDGE / Math.max(base.width, base.height) });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new CvReadError("Could not render the PDF page.");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvas, canvasContext: ctx, viewport }).promise;
    out.push(await canvasToJpeg(canvas));
    page.cleanup();
  }
  return out;
}

/**
 * Read a CV file in the browser.
 * - PDF/DOCX/TXT with a text layer -> the text.
 * - PDF without enough text (scanned) -> up to 4 rendered page images.
 * - Image files -> one downscaled JPEG each (callers pass several photos as pages).
 */
export async function readCvFile(file: File): Promise<BrowserRead> {
  if (file.size > MAX_CV_BYTES) throw new CvReadError("That file is larger than 10 MB.");
  if (isImageFile(file)) return { kind: "image", pages: [await imageToJpeg(file)] };
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  const kind = sniffKind(bytes, file.name);
  try {
    if (kind === "pdf") {
      const { pdf, text } = await pdfText(bytes);
      if (text.length >= MIN_CV_CHARS) return { kind, text };
      return { kind: "scan", pages: await renderPdfPages(pdf), totalPages: pdf.numPages };
    }
    if (kind === "docx") return { kind, text: await docxText(buf) };
    return { kind, text: tidy(new TextDecoder("utf-8").decode(bytes)) };
  } catch (e) {
    if (e instanceof CvReadError) throw e;
    throw new CvReadError("We could not read this file. Try a photo of each page, or paste the text instead.");
  }
}
