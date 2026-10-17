import { NextResponse } from "next/server";
import { apiCtx, apiError, unauthorized } from "@/lib/server/api";

/** CV photo upload (already resized to 320x320 JPEG in the browser). Stored in the private bucket. */
export async function POST(req: Request) {
  const c = await apiCtx();
  if (!c) return unauthorized();
  try {
    const f = (await req.formData()).get("photo");
    if (!(f instanceof File) || f.size > 1_000_000) return NextResponse.json({ error: "Use an image under 1 MB." }, { status: 400 });
    const bytes = new Uint8Array(await f.arrayBuffer());
    if (!(bytes[0] === 0xff && bytes[1] === 0xd8)) return NextResponse.json({ error: "Upload a JPEG image." }, { status: 400 });
    const path = `${c.userId}/photo.jpg`;
    const up = await c.db.storage.from("cv-files").upload(path, bytes, { contentType: "image/jpeg", upsert: true });
    if (up.error) throw new Error(up.error.message);
    await c.db.from("profiles").update({ photo_path: path }).eq("id", c.userId);
    return NextResponse.json({ ok: true });
  } catch (e) { return apiError(e); }
}
