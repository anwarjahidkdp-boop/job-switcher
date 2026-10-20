"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { Spinner } from "@/components/ui";

type Mode = "login" | "signup" | "code" | "forgot";
type Sent = null | "code" | "signup" | "forgot";

/** Log in with email + password, sign up with a password, or get a one-time email code (older accounts and forgotten passwords). */
export function LoginForm({ next, initial }: { next: string; initial: Mode }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initial);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState<Sent>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const confirmUrl = (to: string) => `${window.location.origin}/auth/confirm?next=${encodeURIComponent(to)}`;
  const go = (m: Mode) => { setMode(m); setErr(""); setSent(null); };
  const rate = (m: string) => /rate|too many/i.test(m);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr("");
    const supabase = createClient();
    const addr = email.trim();
    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email: addr, password });
      setBusy(false);
      if (!error) { router.replace(next); router.refresh(); return; }
      setErr(rate(error.message) ? "Too many attempts. Wait a minute and try again." : /confirm/i.test(error.message) ? "Confirm your email first: open the link we sent you." : "Email or password is wrong. If you used to sign in with an email code, click \"Forgot password?\" to set one.");
    } else if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({ email: addr, password, options: { emailRedirectTo: confirmUrl(next) } });
      setBusy(false);
      if (error) { setErr(rate(error.message) ? "Too many attempts. Wait a minute and try again." : /password/i.test(error.message) ? "Choose a stronger password: at least 8 characters." : "Could not create the account. Check the email address."); return; }
      if (data.session) { router.replace(next); router.refresh(); } else setSent("signup");
    } else if (mode === "forgot") {
      const { error } = await supabase.auth.resetPasswordForEmail(addr, { redirectTo: confirmUrl("/account/password") });
      setBusy(false);
      if (error) setErr(rate(error.message) ? "Too many attempts. Wait a minute and try again." : "Could not send the email. Check the address.");
      else setSent("forgot");
    } else {
      const { error } = await supabase.auth.signInWithOtp({ email: addr, options: { emailRedirectTo: confirmUrl(next), shouldCreateUser: true } });
      setBusy(false);
      if (error) setErr(rate(error.message) ? "Too many attempts. Wait a minute and try again." : "Could not send the code. Check the email address.");
      else setSent("code");
    }
  }
  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr("");
    const { error } = await createClient().auth.verifyOtp({ email: email.trim(), token: code.trim(), type: "email" });
    setBusy(false);
    if (error) setErr("That code did not work. Check it, or request a new one.");
    else { router.replace(next); router.refresh(); }
  }

  if (sent === "code") return (
    <form className="card panel stack" style={{ marginTop: 20 }} onSubmit={verify}>
      <p className="small">We sent a code to <b>{email}</b>. Enter it below, or tap the link in the email.</p>
      <label className="f" htmlFor="code">Sign-in code<input id="code" className="code-input" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={10} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} /></label>
      {err ? <p className="err">{err}</p> : null}
      <button className="btn btn-primary" disabled={busy || code.length < 6}>{busy ? <><Spinner /> Checking</> : "Sign in"}</button>
      <button type="button" className="btn-text" onClick={() => go("login")}>Back to log in</button>
    </form>
  );
  if (sent) return (
    <div className="card panel stack" style={{ marginTop: 20 }}>
      <p>{sent === "signup" ? <>Almost done. We sent a link to <b>{email}</b>. Open it to confirm your email, and you are in.</> : <>We sent a link to <b>{email}</b>. Open it to set a new password.</>}</p>
      <p className="small muted">Open the link in this same browser. Not there? Check Spam or Promotions.</p>
      <button type="button" className="btn-text" onClick={() => go("login")}>Back to log in</button>
    </div>
  );

  const needsPw = mode === "login" || mode === "signup";
  return (
    <div style={{ marginTop: 20 }}>
      {mode === "login" || mode === "signup" ? (
        <div className="auth-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={mode === "login"} className={mode === "login" ? "on" : ""} onClick={() => go("login")}>Log in</button>
          <button type="button" role="tab" aria-selected={mode === "signup"} className={mode === "signup" ? "on" : ""} onClick={() => go("signup")}>Sign up</button>
        </div>
      ) : null}
      <form className="card panel stack" onSubmit={submit} style={mode === "login" || mode === "signup" ? { borderTopLeftRadius: 0, borderTopRightRadius: 0 } : undefined}>
        {mode === "forgot" ? <p className="small">Enter your email and we send you a link to set a new password.</p> : null}
        {mode === "code" ? <p className="small">We email you a one-time sign-in code. No password needed.</p> : null}
        <label className="f" htmlFor="email">Email address<input id="email" type="text" inputMode="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" /></label>
        {needsPw ? <label className="f" htmlFor="password">{mode === "signup" ? "Choose a password" : "Password"}<input id="password" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} required minLength={mode === "signup" ? 8 : undefined} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={mode === "signup" ? "At least 8 characters" : ""} aria-describedby={mode === "signup" ? "pw-hint" : undefined} /></label> : null}
        {needsPw && mode === "signup" ? <p id="pw-hint" className="small" style={{ marginTop: -4, color: password.length >= 8 ? "var(--good)" : "var(--ink-2)" }}>{password.length >= 8 ? "✓ Password is long enough" : `Password must be at least 8 characters (${password.length}/8)`}</p> : null}
        {err ? <p className="err">{err}</p> : null}
        <button className="btn btn-primary" disabled={busy || !email.includes("@") || (needsPw && password.length < (mode === "signup" ? 8 : 1))}>
          {busy ? <><Spinner /> Please wait</> : mode === "login" ? "Log in" : mode === "signup" ? "Create my account" : mode === "forgot" ? "Send me the link" : "Send me a code"}
        </button>
        {mode === "login" ? <div className="row" style={{ justifyContent: "space-between" }}><button type="button" className="btn-text small" onClick={() => go("forgot")}>Forgot password?</button><button type="button" className="btn-text small" onClick={() => go("code")}>Email me a code instead</button></div> : null}
        {mode === "signup" ? <p className="small muted">Starts your 7-day Pro trial. We never ask for your job-site passwords.</p> : null}
        {mode === "forgot" || mode === "code" ? <button type="button" className="btn-text" onClick={() => go("login")}>Back to log in</button> : null}
      </form>
    </div>
  );
}
