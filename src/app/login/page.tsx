import { SiteHeader } from "@/components/SiteHeader";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const sp = await searchParams;
  const next = sp.next && sp.next.startsWith("/") && !sp.next.startsWith("//") ? sp.next : "/onboarding";
  return (
    <>
      <SiteHeader inApp={false} />
      <main><div className="wrap"><div className="ob" style={{ maxWidth: 460 }}>
        <h1 style={{ fontSize: 28 }}>Sign in to JobPao</h1>
        <p className="muted" style={{ marginTop: 6 }}>Enter your email. We send you a sign-in code and link. No password to remember, and we never ask for your job-site passwords.</p>
        {sp.error ? <p className="err" style={{ marginTop: 12 }}>That sign-in link has expired. Request a new code.</p> : null}
        <LoginForm next={next} />
      </div></div></main>
    </>
  );
}
