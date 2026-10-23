import { NextResponse } from "next/server";
import { apiCtx, unauthorized } from "@/lib/server/api";
import { loadState } from "@/lib/server/state";
import { isPro } from "@/lib/server/page";
import { trialApplyRoom, unlockedReady } from "@/lib/pack-limits";
import { cvDocHtml, cvPrintHtml, safeFileName } from "@/lib/cv/doc";
import { coverLetterDocHtml, coverLetterPrintHtml } from "@/lib/cv/cover-letter";

/** GET ?format=doc|print&jobId=<optional, for the tailored CV>. "print" opens a printable page (Save as PDF). */
export async function GET(req: Request) {
  const c = await apiCtx();
  if (!c) return unauthorized();
  const u = new URL(req.url);
  const format = u.searchParams.get("format") === "print" ? "print" : "doc";
  const jobId = u.searchParams.get("jobId");
  const cover = u.searchParams.get("document") === "cover";
  // Downloads need the saved CV and trial/application checks, not a fresh job-market ranking.
  const st = await loadState(c.db, c.userId, undefined, { skipMatching: true });
  if (!st?.master) return NextResponse.json({ error: "No CV yet." }, { status: 404 });
  if (!["done", "reveal"].includes(st.profile.onboarding_step)) return NextResponse.json({ error: "Complete your current country's setup and rebuild your CV before downloading." }, { status: 409 });
  const app = jobId ? st.apps[jobId] : null;
  if (jobId && !app?.pack) return NextResponse.json({ error: "No application pack for this job." }, { status: 404 });
  // Free trial: a ready application beyond today's one stays locked behind Pro here too (same rule as the job page).
  if (app && (app.status === "ready" || app.status === "reminder") && !(await isPro(c.db, c.userId))) {
    const apps = Object.values(st.apps);
    if (!unlockedReady(apps, trialApplyRoom(apps)).has(app.job_id)) return NextResponse.redirect(new URL("/upgrade?from=trial", req.url));
  }
  if (cover) {
    if (!app?.pack?.cover_letter) return NextResponse.json({ error: 'No cover letter for this application.' }, { status: 404 });
    const headers = { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex' };
    if (format === 'print') return new NextResponse(coverLetterPrintHtml(st.master.content.name, app.pack.cover_letter, st.country, u.searchParams.get('auto') === '1'), { headers: { ...headers, 'Content-Type': 'text/html; charset=utf-8' } });
    return new NextResponse(coverLetterDocHtml(st.master.content.name, app.pack.cover_letter), { headers: { ...headers, 'Content-Type': 'application/msword', 'Content-Disposition': `attachment; filename="${safeFileName(st.master.content.name)}-Cover-Letter.doc"` } });
  }
  let photoUrl: string | null = null;
  if (st.profile.photo_path) {
    // Embed as a data URL so the file works offline and no long-lived link to the private bucket is created.
    const { data } = await c.db.storage.from("cv-files").download(st.profile.photo_path);
    if (data) photoUrl = "data:image/jpeg;base64," + Buffer.from(await data.arrayBuffer()).toString("base64");
  }
  const input = { master: st.master.content, tailored: app?.pack ?? null, country: st.country, homeCountry: st.homeCountry, style: st.profile.cv_style, personal: st.profile.personal, noticeDays: st.profile.preferences?.notice ?? null, photoUrl };
  const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex" };
  if (format === "print") return new NextResponse(cvPrintHtml(input, { autoPrint: u.searchParams.get("auto") === "1" }), { headers: { ...headers, "Content-Type": "text/html; charset=utf-8" } });
  let company = "";
  if (jobId) { const { data } = await c.db.from("jobs").select("company").eq("id", jobId).maybeSingle(); company = data?.company || ""; }
  const name = safeFileName(st.master.content.name) + (company ? "-" + safeFileName(company) : "") + "-CV.doc";
  return new NextResponse(cvDocHtml(input), { headers: { ...headers, "Content-Type": "application/msword", "Content-Disposition": `attachment; filename="${name}"` } });
}
