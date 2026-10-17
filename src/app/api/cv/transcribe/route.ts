import { NextResponse } from "next/server";
import { apiCtx, apiError, unauthorized } from "@/lib/server/api";
import { MAX_PAGE_BYTES, MAX_SCAN_PAGES, transcribeCv } from "@/lib/server/onboarding";

export const maxDuration = 120;

/**
 * POST multipart with up to 4 `page` parts (JPEG pages rendered and downscaled in the browser).
 * Returns the transcribed text for the user to check; nothing is stored and no CV is created here.
 */
export async function POST(req: Request) {
  const c = await apiCtx();
  if (!c) return unauthorized();
  try {
    const len = Number(req.headers.get("content-length") || 0);
    if (len > MAX_SCAN_PAGES * MAX_PAGE_BYTES + 64 * 1024) return NextResponse.json({ error: "Those pages are too large." }, { status: 413 });
    const fd = await req.formData();
    const parts = fd.getAll("page").filter((p): p is File => p instanceof File);
    const pages = await Promise.all(parts.map(async (p) => new Uint8Array(await p.arrayBuffer())));
    return NextResponse.json(await transcribeCv(c, pages));
  } catch (e) {
    return apiError(e);
  }
}
