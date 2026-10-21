import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { apiCtx } from "@/lib/server/api";
import { connectGmail, gmailConfigured } from "@/lib/server/gmail";
import { publicEnv } from "@/lib/env";
import { safeNext } from "@/lib/safe-next";

export async function GET(req: Request) {
  const u = new URL(req.url);
  const store = await cookies();
  let saved: { state?: string; next?: string } = {};
  try { saved = JSON.parse(store.get("gmail_oauth")?.value || "{}"); } catch { /* treated as a mismatch below */ }
  store.delete({ name: "gmail_oauth", path: "/api/gmail" });
  const next = safeNext(saved.next, "/profile");
  const back = (status: string) => {
    const to = new URL(next, publicEnv.appUrl);
    to.searchParams.set("gmail", status);
    return NextResponse.redirect(to);
  };
  const c = await apiCtx();
  if (!c) return NextResponse.redirect(new URL("/login?next=/profile", publicEnv.appUrl));
  if (!gmailConfigured()) return back("unavailable");
  if (u.searchParams.get("error")) return back("cancelled");
  const code = u.searchParams.get("code");
  if (!code || !saved.state || u.searchParams.get("state") !== saved.state) return back("failed");
  try { await connectGmail(c.admin, c.userId, code); return back("connected"); }
  catch (e) { console.error("gmail connect", e); return back("failed"); }
}
