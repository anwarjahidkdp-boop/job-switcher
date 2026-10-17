import { NextResponse } from "next/server";
import { apiCtx, apiError, unauthorized } from "@/lib/server/api";
import { runAI } from "@/lib/ai";
import { ROADMAP_PROMPT, SYSTEM_RULES } from "@/lib/prompts";
import { loadState } from "@/lib/server/state";
import { skillLabel, normSkill } from "@/lib/taxonomy";

export const maxDuration = 60;

export async function POST(req: Request) {
  const c = await apiCtx();
  if (!c) return unauthorized();
  try {
    const { skill } = (await req.json()) as { skill: string };
    const st = await loadState(c.db, c.userId);
    if (!st?.P) throw new Error("Finish your profile first.");
    const res = await runAI(c.admin, c.userId, "roadmap", (p) => p.generateText({ tier: "fast", system: SYSTEM_RULES, prompt: ROADMAP_PROMPT(st.P!.currentTitle, skillLabel(normSkill(skill)).slice(0, 60), st.P!.targetRoles, st.country), maxTokens: 2000 }));
    return NextResponse.json({ text: res.text });
  } catch (e) { return apiError(e); }
}
