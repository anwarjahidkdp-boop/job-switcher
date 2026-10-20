import { PageHead } from "@/components/PageHead";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { PasswordForm } from "./PasswordForm";

export const metadata = { title: "Set your password" };

export default function SetPassword() {
  return (
    <>
      <SiteHeader inApp={false} signedIn />
      <main><div className="wrap">
        <PageHead kicker="Your account" title={<>Set your <span>password</span></>} sub="Next time, log in with your email and this password." />
        <div className="ob card panel pg-form"><PasswordForm /></div>
      </div></main>
      <SiteFooter signedIn />
    </>
  );
}
