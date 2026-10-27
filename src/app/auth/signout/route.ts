import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PUSH_COOKIE } from "@/lib/server/push";

export async function POST(request: Request) {
  const supabase = await createClient();
  // A signed-out phone stops getting this account's alerts (it may be a shared phone).
  const push = (await cookies()).get(PUSH_COOKIE)?.value;
  if (push) {
    const { data } = await supabase.auth.getUser();
    if (data.user) await createAdminClient().from("push_subscriptions").delete().eq("id", push).eq("user_id", data.user.id).then(() => {}, (e) => console.error("push signout", e));
  }
  await supabase.auth.signOut();
  const res = NextResponse.redirect(new URL("/", request.url), { status: 303 });
  if (push) res.cookies.delete(PUSH_COOKIE);
  return res;
}
