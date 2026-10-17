import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/** Magic-link landing: verifies the token hash from the email and signs the user in. */
export async function GET(request: NextRequest) {
  const u = request.nextUrl;
  const token_hash = u.searchParams.get("token_hash");
  const type = u.searchParams.get("type") as EmailOtpType | null;
  const nextParam = u.searchParams.get("next") || "/onboarding";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/onboarding";
  const code = u.searchParams.get("code");
  if (token_hash && type) {
    // Recommended email template link: works even when the link opens in another browser.
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) return NextResponse.redirect(new URL(next, request.url));
  } else if (code) {
    // Default Supabase template ({{ .ConfirmationURL }}) with PKCE: only works in the browser that asked for the link.
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, request.url));
  }
  return NextResponse.redirect(new URL("/login?error=link", request.url));
}
