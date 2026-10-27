import { PageHead } from "@/components/PageHead";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { LoginForm } from "./LoginForm";
import { safeNext } from "@/lib/safe-next";

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  return { title: (await searchParams).mode === "signup" ? "Create your account" : "Log in" };
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string; mode?: string; signedout?:string; logout?:string }> }) {
  const sp = await searchParams;
  const signup = sp.mode === "signup";
  const next = safeNext(sp.next);
  return (
    <>
      <SiteHeader inApp={false} />
      <main><div className="wrap">
        <PageHead kicker={signup ? "5 days free · No card needed" : "JobPao"} title={signup ? <>Create your <span>account</span></> : <>Welcome <span>back</span></>} sub={signup ? "Your own job assistant, ready in a minute." : "Log in with your email and password."} />
        <div className="ob card panel pg-form">
          {sp.error ? <p role="alert" className="err" style={{ marginBottom: 12 }}>{sp.error === "browser" ? "Open the link in the same browser where you asked for it, or log in here." : "That link was old or already used. Get a fresh 6-digit code below: it confirms your email and logs you in."}</p> : null}
          {sp.signedout === "1" ? <p className="note" role="status">You have signed out. You can log in again below.</p> : null}
          {sp.logout === "retry" ? <div role="alert"><p className="err">Sign-out could not finish. Your session may still be active. Please try again.</p><form action="/auth/signout" method="post" style={{marginTop:12}}><button className="btn btn-primary btn-sm">Try signing out again</button></form></div> : null}
          <LoginForm next={next} initial={sp.error === "link" ? "code" : signup ? "signup" : "login"} />
        </div>
      </div></main>
      <SiteFooter />
    </>
  );
}
