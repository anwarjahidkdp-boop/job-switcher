import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safe-next";

const TYPES: EmailOtpType[] = ["email", "signup", "magiclink", "recovery", "invite", "email_change"];

/** Email-link landing. A token link only opens a "Continue" page: mail scanners and link previews open links too,
 *  and verifying on that first open would spend the one-time token before the person taps it. */
export async function GET(request: NextRequest) {
  const u = request.nextUrl;
  const token_hash = u.searchParams.get("token_hash");
  const type = u.searchParams.get("type");
  const next = safeNext(u.searchParams.get("next"));
  const code = u.searchParams.get("code");
  if (token_hash && type) {
    const to = new URL("/auth/continue", request.url);
    to.search = new URLSearchParams({ token_hash, type, next }).toString();
    return NextResponse.redirect(to);
  } else if (code) {
    // Default Supabase template ({{ .ConfirmationURL }}) with PKCE: only works in the browser that asked for the link.
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, request.url));
    return NextResponse.redirect(new URL("/login?error=browser", request.url));
  }
  return NextResponse.redirect(new URL("/login?error=link", request.url));
}

/** The "Continue" button: verifies the token hash and signs the person in. Works in any browser. */
export async function POST(request: NextRequest) {
  const f = await request.formData();
  const token_hash = String(f.get("token_hash") || "");
  const type = String(f.get("type") || "") as EmailOtpType;
  const next = safeNext(String(f.get("next") || ""));
  const supabase = await createClient();
  if (token_hash && TYPES.includes(type)) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) return NextResponse.redirect(new URL(next, request.url), 303);
  }
  // Already used (a double tap, or the same link opened twice) but this browser is signed in: carry on.
  const { data } = await supabase.auth.getUser();
  if (data.user) return NextResponse.redirect(new URL(next, request.url), 303);
  return NextResponse.redirect(new URL("/login?error=link", request.url), 303);
}
