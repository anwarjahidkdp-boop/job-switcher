import { NextResponse } from "next/server";
import { apiCtx, apiError, unauthorized } from "@/lib/server/api";
import { writeUkStatement } from "@/lib/server/uk-writing";

export const maxDuration = 120;

/** POST {spec?}: write the UK supporting statement for this application from the CV used for it, against the
 *  person specification the person pasted (spec), or the one saved with the application when spec is left out. */
export async function POST(req: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const c = await apiCtx();
  if (!c) return unauthorized();
  const { jobId } = await params;
  const body = await req.json().catch(() => ({}));
  const spec = body && typeof body === "object" && "spec" in body ? (body as { spec: unknown }).spec : undefined;
  try { return NextResponse.json(await writeUkStatement(c, jobId, spec)); } catch (e) { return apiError(e); }
}
