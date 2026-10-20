import { SiteHeader } from "@/components/SiteHeader";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string; mode?: string }> }) {
  const sp = await searchParams;
  const signup = sp.mode === "signup";
  const next = sp.next && sp.next.startsWith("/") && !sp.next.startsWith("//") ? sp.next : "/onboarding";
  return (
    <>
      <SiteHeader inApp={false} />
      <main><div className="wrap"><div className="ob" style={{ maxWidth: 460 }}>
        <h1 style={{ fontSize: 28 }}>{signup ? "Create your JobPao account" : "Welcome back"}</h1>
        <p className="muted" style={{ marginTop: 6 }}>{signup ? "Your own job assistant, ready in a minute." : "Log in with your email and password."}</p>
        {sp.error ? <p className="err" style={{ marginTop: 12 }}>That link has expired. Log in, or ask for a new link.</p> : null}
        <LoginForm next={next} initial={signup ? "signup" : "login"} />
      </div></div></main>
    </>
  );
}
