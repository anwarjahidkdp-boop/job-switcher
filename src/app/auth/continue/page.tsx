import { PageHead } from "@/components/PageHead";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { safeNext } from "@/lib/safe-next";

export const metadata = { title: "Continue", robots: { index: false } };

/** One tap after an email link: the token is spent only when the person presses Continue, never by a mail scanner. */
export default async function ContinuePage({ searchParams }: { searchParams: Promise<{ token_hash?: string; type?: string; next?: string }> }) {
  const sp = await searchParams;
  const recovery = sp.type === "recovery";
  const ok = !!sp.token_hash && !!sp.type;
  return (
    <>
      <SiteHeader inApp={false} />
      <main><div className="wrap">
        <PageHead kicker="JobPao" title={recovery ? <>Set a new <span>password</span></> : <>Almost <span>there</span></>} sub={recovery ? "Tap Continue to choose your new password." : "Tap Continue to finish. One tap and you are in."} />
        <div className="ob card panel pg-form">
          {ok ? (
            <form method="post" action="/auth/confirm" className="stack">
              <input type="hidden" name="token_hash" value={sp.token_hash} />
              <input type="hidden" name="type" value={sp.type} />
              <input type="hidden" name="next" value={safeNext(sp.next)} />
              <button className="btn btn-primary">{recovery ? "Continue to new password" : "Continue to JobPao →"}</button>
            </form>
          ) : <p className="err">That link is not complete. <a href="/login">Log in</a>, or ask for a new link.</p>}
        </div>
      </div></main>
      <SiteFooter />
    </>
  );
}
