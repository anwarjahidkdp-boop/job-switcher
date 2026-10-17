import { NextResponse } from "next/server";
import { apiCtx, apiError, unauthorized } from "@/lib/server/api";
import { ingestCv } from "@/lib/server/onboarding";
import { MAX_CV_BYTES } from "@/lib/cv/extract-text";

export const maxDuration = 120;

/** POST multipart (file) or JSON ({text} | {demo:true}). Stores the CV privately, extracts and grounds facts. */
export async function POST(req: Request) {
  const c = await apiCtx();
  if (!c) return unauthorized();
  try {
    const type = req.headers.get("content-type") || "";
    if (type.includes("multipart/form-data")) {
      const fd = await req.formData();
      const f = fd.get("file");
      if (!(f instanceof File)) return NextResponse.json({ error: "Choose a file." }, { status: 400 });
      if (f.size > MAX_CV_BYTES) return NextResponse.json({ error: "That file is larger than 10 MB." }, { status: 400 });
      const r = await ingestCv(c, { file: { name: f.name, bytes: new Uint8Array(await f.arrayBuffer()) } });
      return NextResponse.json(r);
    }
    const body = (await req.json().catch(() => ({}))) as { text?: string; demo?: boolean };
    const r = await ingestCv(c, body.demo ? { demo: true } : { text: String(body.text || "").slice(0, 60000) });
    return NextResponse.json(r);
  } catch (e) {
    return apiError(e);
  }
}
