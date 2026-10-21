import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { apiCtx } from "@/lib/server/api";
import { authUrl, gmailConfigured } from "@/lib/server/gmail";
import { publicEnv } from "@/lib/env";
import { safeNext } from "@/lib/safe-next";

/** GET ?next=/jobs/<id>: start Google sign-in for the gmail.send permission. */
export async function GET(req: Request) {
  const c = await apiCtx();
  if (!c) return NextResponse.redirect(new URL("/login?next=/profile", publicEnv.appUrl));
  if (!gmailConfigured()) return NextResponse.redirect(new URL("/profile?gmail=unavailable", publicEnv.appUrl));
  const next = new URL(req.url).searchParams.get("next") || "/profile";
  const state = crypto.randomUUID();
  (await cookies()).set("gmail_oauth", JSON.stringify({ state, next: safeNext(next, "/profile") }), { httpOnly: true, secure: true, sameSite: "lax", path: "/api/gmail", maxAge: 600 });
  return NextResponse.redirect(authUrl(state, c.email));
}
