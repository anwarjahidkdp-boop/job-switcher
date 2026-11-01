import { NextResponse } from "next/server";
import { apiCtx, apiError, unauthorized } from "@/lib/server/api";
import { normalisePhone, validEmail } from "@/lib/cv/contact";
import type { PersonalDetails } from "@/lib/types";

/** Profile → Contact details: the phone used on the CV, and which email the CV shows (login email or another). */
export async function POST(req: Request) {
  const c = await apiCtx();
  if (!c) return unauthorized();
  try {
    const b = (await req.json().catch(() => ({}))) as { phone?: unknown; cvEmail?: unknown };
    const phone = normalisePhone(typeof b.phone === "string" ? b.phone : "");
    if (!phone) return NextResponse.json({ error: "Enter a valid phone number, for example +880 1711-000000." }, { status: 400 });
    const cvEmail = typeof b.cvEmail === "string" ? b.cvEmail.trim() : "";
    if (cvEmail && !validEmail(cvEmail)) return NextResponse.json({ error: "Enter a valid email for your CV." }, { status: 400 });
    const { data, error } = await c.db.from("profiles").select("personal").eq("id", c.userId).maybeSingle();
    if (error) throw error;
    const personal: PersonalDetails = { ...((data?.personal as PersonalDetails | null) || {}) };
    if (cvEmail && cvEmail.toLowerCase() !== (c.email || "").toLowerCase()) personal.cvEmail = cvEmail; else delete personal.cvEmail;
    const saved = await c.db.from("profiles").update({ phone, personal }).eq("id", c.userId);
    if (saved.error) throw saved.error;
    return NextResponse.json({ ok: true });
  } catch (e) { return apiError(e); }
}
