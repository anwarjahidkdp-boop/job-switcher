import "server-only";
import { NextResponse } from "next/server";
import { createClient } from "../supabase/server";
import { createAdminClient } from "../supabase/admin";
import { AIError, aiErrCopy } from "../ai/provider";
import { CvReadError } from "../cv/sniff";

export async function apiCtx() {
  const db = await createClient();
  const { data } = await db.auth.getUser();
  if (!data.user) return null;
  return { db, admin: createAdminClient(), userId: data.user.id, email: data.user.email ?? null };
}

export const unauthorized = () => NextResponse.json({ error: "Please sign in again." }, { status: 401 });

export function apiError(e: unknown) {
  if (e instanceof AIError) {
    const status = e.code === "over_cap" || e.code === "trial_expired" || e.code === "plan_expired" ? 402 : e.code === "rate_limited" ? 429 : e.code === "not_configured" ? 503 : 502;
    return NextResponse.json({ error: aiErrCopy(e), code: e.code }, { status });
  }
  if (e instanceof CvReadError) return NextResponse.json({ error: e.message }, { status: 400 });
  console.error(e);
  // Database and other internal errors carry table and constraint names: keep those in the log, not in the reply.
  const code = (e as { code?: unknown } | null)?.code;
  if (code === "P0001") return NextResponse.json({ error: (e as Error).message }, { status: 400 }); // our own database rule, written for people
  if (code === "23505") return NextResponse.json({ error: "This is already saved." }, { status: 409 });
  if (isInternal(e)) return NextResponse.json({ error: "Something went wrong on our side. Try again in a minute." }, { status: 500 });
  const msg = e instanceof Error && e.message && e.message.length < 200 ? e.message : "Something went wrong. Try again.";
  return NextResponse.json({ error: msg }, { status: 400 });
}

/** A Supabase/PostgREST error (code + details/hint) or a non-Error throw: never shown to the user as is. */
export function isInternal(e: unknown): boolean {
  if (!e || typeof e !== "object") return true;
  const o = e as Record<string, unknown>;
  return typeof o.code === "string" && ("details" in o || "hint" in o) || !(e instanceof Error);
}

/** Constant-time comparison for shared secrets. */
export function safeEqual(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
