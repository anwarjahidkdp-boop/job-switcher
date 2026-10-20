"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { Spinner } from "@/components/ui";

export function PasswordForm() {
  const router = useRouter();
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr("");
    const { error } = await createClient().auth.updateUser({ password: pw });
    setBusy(false);
    if (error) setErr(/same|different/i.test(error.message) ? "Choose a password different from your old one." : "Could not save it. Use at least 8 characters.");
    else { router.replace("/inbox"); router.refresh(); }
  }
  return (
    <form className="card panel stack" style={{ marginTop: 20 }} onSubmit={save}>
      <label className="f" htmlFor="pw">New password<input id="pw" type="password" autoComplete="new-password" minLength={8} required value={pw} onChange={(e) => setPw(e.target.value)} placeholder="At least 8 characters" /></label>
      {err ? <p className="err">{err}</p> : null}
      <button className="btn btn-primary" disabled={busy || pw.length < 8}>{busy ? <><Spinner /> Saving</> : "Save password"}</button>
    </form>
  );
}
