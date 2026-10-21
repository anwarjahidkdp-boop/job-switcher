// Helpers for server components: auth gate, state, trial label, signed photo URL.
import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "../supabase/server";
import { createAdminClient } from "../supabase/admin";
import { loadProfile, loadState, type UserState } from "./state";
import { DAY } from "../dates";

// Once per request: the layout and the page both need the user and profile, and each lookup is a round trip.
const currentUser = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return { supabase, user: data.user };
});
export const profileOf = cache((db: Awaited<ReturnType<typeof createClient>>, userId: string) => loadProfile(db, userId));

export async function requireUser(next = "/inbox") {
  const { supabase, user } = await currentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return { supabase, user };
}

export async function ctx(next = "/inbox") {
  const { supabase, user } = await requireUser(next);
  return { db: supabase, admin: createAdminClient(), userId: user.id, user };
}

/** Is the person on paid Pro (not the trial)? Cached per request. */
export const isPro = cache(async (db: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<boolean> => {
  const { data } = await db.from("subscriptions").select("plan_code, status, current_period_end").eq("user_id", userId).maybeSingle();
  return !!data && data.plan_code === "pro" && data.status === "active" && (!data.current_period_end || Date.parse(data.current_period_end) > Date.now());
});

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
  const st = await loadState(supabase, user.id, profileOf(supabase, user.id));
  if (!st) redirect("/login");
  if (!st.P || !st.master) redirect("/onboarding");
  // On the last step the CV is built, so opening any app page (e.g. "My dashboard") finishes onboarding.
  if (st.profile.onboarding_step === "reveal") {
    await supabase.from("profiles").update({ onboarding_step: "done" }).eq("id", user.id);
    st.profile.onboarding_step = "done";
  }
  if (st.profile.onboarding_step !== "done") redirect("/onboarding");
  return { st: st as never, db: supabase, userId: user.id };
}
