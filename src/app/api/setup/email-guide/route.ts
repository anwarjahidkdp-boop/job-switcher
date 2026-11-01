import { NextResponse } from "next/server";
import { apiCtx, apiError, unauthorized } from "@/lib/server/api";
import { deliverEmail } from "@/lib/server/email-outbox";
import { emailProvider } from "@/lib/email/send";
import { setupGuideEmail } from "@/lib/email/templates";
import { PORTAL_HELP } from "@/lib/portalHelp";
import { FILTER_HASNOT } from "@/lib/setup";
import { publicEnv } from "@/lib/env";

/** Emails the Gmail half of the job-alert setup to the person, to finish on a computer. Once per site per day. */
export async function POST(req: Request) {
  const c = await apiCtx();
  if (!c) return unauthorized();
  try {
    const { site } = (await req.json().catch(() => ({}))) as { site?: string };
    const help = site ? PORTAL_HELP[site] : undefined;
    if (!site || !help) return NextResponse.json({ error: "Unknown job site." }, { status: 400 });
    if (!c.email) return NextResponse.json({ error: "Your account has no email address." }, { status: 400 });
    if (!emailProvider()) return NextResponse.json({ error: "Email is not available right now. Open this page on a computer instead." }, { status: 503 });
    const { data: prof } = await c.db.from("profiles").select("full_name").eq("id", c.userId).maybeSingle();
    const { data: fwd, error } = await c.db.rpc("ensure_forwarding_address", { p_hint: null });
    if (error) throw error;
    const alias = (Array.isArray(fwd) ? fwd[0] : fwd)?.alias as string | undefined;
    if (!alias) return NextResponse.json({ error: "Could not find your JobPao address. Reload the page." }, { status: 500 });
    const base = publicEnv.appUrl.replace(/\/$/, "");
    const msg = setupGuideEmail({ name: prof?.full_name || "", site, address: `${alias}@${publicEnv.inboundDomain}`, from: help.from, hasnot: FILTER_HASNOT, link: `${base}/setup?site=${encodeURIComponent(site)}` });
    const sent = await deliverEmail(c.admin, c.userId, `setup-guide:${site}:${new Date().toISOString().slice(0, 10)}`, { to: c.email, ...msg });
    if (sent === "failed") return NextResponse.json({ error: "The email could not be sent. Try again in a minute." }, { status: 502 });
    return NextResponse.json({ to: c.email });
  } catch (e) {
    return apiError(e);
  }
}
