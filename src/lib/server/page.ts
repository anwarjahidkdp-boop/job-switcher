// Helpers for server components: auth gate, state, trial label, signed photo URL.
import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "../supabase/server";
import { createAdminClient } from "../supabase/admin";
import { loadState, type UserState } from "./state";
import { DAY } from "../dates";

export async function requireUser(next = "/inbox") {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return { supabase, user: data.user };
}

export async function ctx(next = "/inbox") {
  const { supabase, user } = await requireUser(next);
  return { db: supabase, admin: createAdminClient(), userId: user.id, user };
}

export async function trialLabel(db: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<string | null> {
  const { data } = await db.from("subscriptions").select("plan_code, status, trial_ends_at, current_period_end").eq("user_id", userId).maybeSingle();
  if (!data) return null;
  if (data.status === "trialing" && data.trial_ends_at) {
    const left = Math.max(0, Math.ceil((Date.parse(data.trial_ends_at) - Date.now()) / DAY));
    return left ? `Pro Trial · ${left} day${left === 1 ? "" : "s"} remaining` : "Trial ended";
  }
  if (data.status === "active") {
    if (data.current_period_end && Date.parse(data.current_period_end) < Date.now()) return "Pro ended · Renew";
    return data.current_period_end ? `Pro · until ${new Date(data.current_period_end).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : "Pro";
  }
  return "Free";
}

export async function photoUrl(db: Awaited<ReturnType<typeof createClient>>, path: string | null): Promise<string | null> {
  if (!path) return null;
  const { data } = await db.storage.from("cv-files").createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? null;
}

/** For app pages: signed-in, onboarded user with a Master CV. */
export async function requireAppState(next: string): Promise<{ st: UserState & { P: NonNullable<UserState["P"]>; master: NonNullable<UserState["master"]> }; db: Awaited<ReturnType<typeof createClient>>; userId: string }> {
  const { supabase, user } = await requireUser(next);
  const st = await loadState(supabase, user.id);
  if (!st) redirect("/login");
  if (!st.P || !st.master || st.profile.onboarding_step !== "done") redirect("/onboarding");
  return { st: st as never, db: supabase, userId: user.id };
}
