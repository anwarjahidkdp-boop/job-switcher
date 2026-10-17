import { NextResponse } from "next/server";
import { apiCtx, unauthorized } from "@/lib/server/api";

/** Redirects to a 60-second signed URL for the user's own uploaded CV (the bucket is private). */
export async function GET() {
  const c = await apiCtx();
  if (!c) return unauthorized();
  const { data } = await c.db.from("cv_documents").select("storage_path").eq("user_id", c.userId).eq("is_current", true).maybeSingle();
  if (!data?.storage_path) return NextResponse.json({ error: "No uploaded file." }, { status: 404 });
  const { data: s } = await c.db.storage.from("cv-files").createSignedUrl(data.storage_path, 60, { download: true });
  if (!s?.signedUrl) return NextResponse.json({ error: "Could not create a link." }, { status: 500 });
  return NextResponse.redirect(s.signedUrl);
}
