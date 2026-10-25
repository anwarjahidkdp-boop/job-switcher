import {readLimitedText} from "@/lib/request-security";
import {revalidatePath} from "next/cache";
import { refreshMatches } from "@/lib/server/matches";
import { NextResponse } from "next/server";
import { apiCtx, apiError, unauthorized } from "@/lib/server/api";
import { manualContent, ManualSaveSchema } from "@/lib/manual-cv";
import { loadFacts } from "@/lib/server/state";
import type { MasterCV } from "@/lib/types";

export async function POST(req: Request) {
  const c = await apiCtx();
  if (!c) return unauthorized();
  let raw:string;try{raw=await readLimitedText(req,200000);}catch{return NextResponse.json({error:"This CV is too large. Shorten it and try again."},{status:413});}
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: "Invalid CV data." }, { status: 400 }); }
  const parsed = ManualSaveSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Check your CV fields." }, { status: 400 });
  try {
    const input = parsed.data;
    const { data: current, error } = await c.db.from("master_cvs").select("id,content").eq("user_id", c.userId).eq("is_current", true).maybeSingle();
    if (error) throw error;
    if (!current || current.id !== input.baseId) return NextResponse.json({ error: "Your CV changed in another tab. Reload before editing again." }, { status: 409 });
    const facts = await loadFacts(c.db, c.userId);
    const updated = manualContent(input.cv, current.content as MasterCV, facts);
    const { data: id, error: saveError } = await c.db.rpc("save_manual_cv", { p_base_id: input.baseId, p_country: input.country, p_revision: input.revision, p_content: updated.master, p_facts: updated.facts });
    if (saveError) throw saveError;
    revalidatePath("/", "layout");
    let matchingRefreshed=true;
    try { await refreshMatches(c.admin,c.userId,{invalidateAi:true}); }
    catch(e) { matchingRefreshed=false;console.error("CV saved; full match refresh pending",e); }
    return NextResponse.json({ id, matchingRefreshed, message: matchingRefreshed ? "CV saved. Existing jobs have been rechecked against your updated profile." : "CV saved. Your updated profile is active. The full stored-match refresh is temporarily unavailable." }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) { return apiError(e); }
}
