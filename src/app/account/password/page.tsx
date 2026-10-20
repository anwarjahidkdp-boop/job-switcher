import { SiteHeader } from "@/components/SiteHeader";
import { PasswordForm } from "./PasswordForm";

export const metadata = { title: "Set your password" };

export default function SetPassword() {
  return (
    <>
      <SiteHeader inApp={false} signedIn />
      <main><div className="wrap"><div className="ob" style={{ maxWidth: 460 }}>
        <h1 style={{ fontSize: 28 }}>Set your password</h1>
        <p className="muted" style={{ marginTop: 6 }}>Next time, log in with your email and this password.</p>
        <PasswordForm />
      </div></div></main>
    </>
  );
}
