import { PageHead } from "@/components/PageHead";
import { SiteFooter } from "@/components/SiteFooter";
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
      <main><div className="wrap">
        <PageHead kicker={signup ? "5 days free · No card needed" : "JobPao"} title={signup ? <>Create your <span>account</span></> : <>Welcome <span>back</span></>} sub={signup ? "Your own job assistant, ready in a minute." : "Log in with your email and password."} />
        <div className="ob card panel pg-form">
          {sp.error ? <p className="err" style={{ marginBottom: 12 }}>That link has expired. Log in, or ask for a new link.</p> : null}
          <LoginForm next={next} initial={signup ? "signup" : "login"} />
        </div>
      </div></main>
      <SiteFooter />
    </>
  );
}
