// Refreshes the Supabase session cookie on every request and keeps signed-out visitors out of app pages.
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PROTECTED = ["/onboarding", "/inbox", "/jobs", "/queue", "/applications", "/insights", "/profile", "/setup", "/upgrade", "/admin", "/account"];

export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.next({ request });
  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
      },
    },
  });
  // getClaims refreshes the session like getUser, but verifies the token locally when the project signs with
  // asymmetric keys (one round trip less per page). Pages still check the user themselves.
  const { data } = await supabase.auth.getClaims();
  const path = request.nextUrl.pathname;
  if (!data?.claims?.sub && PROTECTED.some((p) => path === p || path.startsWith(p + "/"))) {
    const to = request.nextUrl.clone();
    to.pathname = "/login";
    to.search = `?next=${encodeURIComponent(path + request.nextUrl.search)}`;
    return NextResponse.redirect(to);
  }
  return response;
}

export const config = {
  // Skip static assets and the machine-to-machine endpoints (they authenticate with shared secrets).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|sw.js|manifest.webmanifest|api/inbound|api/cron|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)"],
};
