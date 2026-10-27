import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PUSH_COOKIE } from "@/lib/server/push";

export async function POST(request: Request) {
  // Do not make a successful sign-out depend on rendering the marketing homepage.
  const destination = new URL("/login", request.url);
  try {
    const supabase = await createClient();
    const push = (await cookies()).get(PUSH_COOKIE)?.value;
    // Notification cleanup is best effort; configuration or lookup errors must not prevent sign-out.
    if (push) {
      try {
        const { data } = await supabase.auth.getUser();
        if (data.user) {
          const { error } = await createAdminClient().from("push_subscriptions").delete().eq("id", push).eq("user_id", data.user.id);
          if (error) console.error("push signout cleanup failed");
        }
      } catch { console.error("push signout cleanup unavailable"); }
    }
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    destination.searchParams.set("signedout", "1");
    const response = NextResponse.redirect(destination, { status: 303 });
    response.headers.set("Cache-Control", "no-store");
    if (push) response.cookies.delete(PUSH_COOKIE);
    return response;
  } catch {
    // Do not claim a session was revoked when Auth rejected or could not finish the request.
    console.error("signout unavailable");
    destination.searchParams.set("logout", "retry");
    const response = NextResponse.redirect(destination, { status: 303 });
    response.headers.set("Cache-Control", "no-store");
    return response;
  }
}
