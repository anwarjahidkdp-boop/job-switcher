"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { Spinner } from "@/components/ui";

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr("");
    const supabase = createClient();
    const redirect = `${window.location.origin}/auth/confirm?next=${encodeURIComponent(next)}`;
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: redirect, shouldCreateUser: true } });
    setBusy(false);
    if (error) setErr(error.message.includes("rate") ? "Too many attempts. Wait a minute and try again." : "Could not send the code. Check the email address.");
    else setSent(true);
  }
  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr("");
    const { error } = await createClient().auth.verifyOtp({ email: email.trim(), token: code.trim(), type: "email" });
    setBusy(false);
    if (error) setErr("That code did not work. Check it, or request a new one.");
    else { router.replace(next); router.refresh(); }
  }

  if (!sent) return (
    <form className="card panel stack" style={{ marginTop: 20 }} onSubmit={send}>
      <label className="f" htmlFor="email">Email address<input id="email" type="text" inputMode="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" /></label>
      {err ? <p className="err">{err}</p> : null}
      <button className="btn btn-primary" disabled={busy || !email.includes("@")}>{busy ? <><Spinner /> Sending</> : "Send me a sign-in code"}</button>
      <p className="small muted">New here? This creates your account and starts your 7-day Pro trial.</p>
    </form>
  );
  return (
    <form className="card panel stack" style={{ marginTop: 20 }} onSubmit={verify}>
      <p className="small">We sent a code to <b>{email}</b>. Enter it below, or tap the link in the email.</p>
      <label className="f" htmlFor="code">Sign-in code<input id="code" className="code-input" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={10} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} /></label>
      {err ? <p className="err">{err}</p> : null}
      <button className="btn btn-primary" disabled={busy || code.length < 6}>{busy ? <><Spinner /> Checking</> : "Sign in"}</button>
      <button type="button" className="btn-text" onClick={() => { setSent(false); setCode(""); }}>Use a different email</button>
    </form>
  );
}
