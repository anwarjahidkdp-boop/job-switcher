"use client";
// "Ask AI to change your CV": the person types one change; the server applies it to their facts and Master CV.
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/ui";
import { MAX_EDIT_CHARS } from "@/lib/cv-edit";

const EXAMPLES = "For example: remove the skill Tally · change my end date at ABC Ltd to March 2024 · update my HSC result to GPA 4.00 · add that I passed ACCA F5. You can write or speak in English or Bangla.";

// The browser's own speech-to-text (Chrome, Edge, Safari). Not every browser has it, so the mic shows only where it works.
type Rec = { lang: string; interimResults: boolean; continuous: boolean; start(): void; stop(): void; onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null; onend: (() => void) | null; onerror: ((e: { error: string }) => void) | null };
const speechApi = (): (new () => Rec) | null => {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
};
const noSub = () => () => {};

/** `after` shows once a change is saved, so the person knows where to go next. */
export function CvEditBox({ aiReady, style, after }: { aiReady: boolean; style?: React.CSSProperties; after?: React.ReactNode }) {
  const router = useRouter();
  const [v, setV] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState("");
  const canSpeak = useSyncExternalStore(noSub, () => !!speechApi(), () => false);
  const [lang, setLang] = useState<"en-GB" | "bn-BD">("en-GB");
  const [listening, setListening] = useState(false);
  const rec = useRef<Rec | null>(null);
  useEffect(() => () => rec.current?.stop(), []);

  function speak() {
    if (listening) { rec.current?.stop(); return; }
    const Api = speechApi();
    if (!Api) return;
    const r = new Api();
    r.lang = lang; r.interimResults = false; r.continuous = false;
    const start = v.trim();
    r.onresult = (e) => {
      let said = "";
      for (let i = 0; i < e.results.length; i++) if (e.results[i].isFinal) said += e.results[i][0].transcript;
      if (said.trim()) setV(`${start ? start + " " : ""}${said.trim()}`.slice(0, MAX_EDIT_CHARS));
    };
    r.onerror = (e) => setErr(e.error === "not-allowed" ? "Allow the microphone in your browser to speak your change." : e.error === "no-speech" ? "We did not hear anything. Tap the mic and speak again." : "Voice input stopped. Try again or type your change.");
    r.onend = () => setListening(false);
    rec.current = r;
    setErr(""); setListening(true);
    try { r.start(); } catch { setListening(false); }
  }

  async function submit() {
    if (!v.trim() || busy) return;
    setBusy(true); setErr(""); setDone("");
    try {
      const r = await fetch("/api/cv/edit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ instruction: v.trim() }) });
      const j = await r.json().catch(() => null);
      // A non-JSON answer means the server stopped mid-way; the change may already be saved.
      if (!j) { router.refresh(); throw new Error("The server was busy. Check your CV above: if the change is not there, try again."); }
      if (!r.ok) throw new Error(j.error || "Your CV could not be updated. Try again.");
      setDone(j.message || "Your CV was updated.");
      setV("");
      router.refresh();
    } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  }

  return (
    <div className="card panel" style={style}>
      <h3>Ask AI to change your CV</h3>
      {!aiReady ? <p className="note">AI changes are not set up on this server yet.</p> : (
        <form className="stack" style={{ gap: 10 }} onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <label className="f" htmlFor="cvedit">Tell us what to change in your CV
            <textarea id="cvedit" rows={3} value={v} maxLength={MAX_EDIT_CHARS} disabled={busy} placeholder={EXAMPLES} onChange={(e) => setV(e.target.value)} />
          </label>
          {canSpeak ? <div className="row" style={{ gap: 8 }}>
            <button type="button" className={`btn btn-sm ${listening ? "btn-primary" : "btn-ghost"}`} disabled={busy} onClick={speak} aria-pressed={listening}>{listening ? "■ Stop, I'm done" : "🎤 Speak your change"}</button>
            <span className="seg-group" role="group" aria-label="Language you speak">
              <button type="button" className={`seg ${lang === "en-GB" ? "on" : ""}`} aria-pressed={lang === "en-GB"} disabled={listening} onClick={() => setLang("en-GB")}>English</button>
              <button type="button" className={`seg ${lang === "bn-BD" ? "on" : ""}`} aria-pressed={lang === "bn-BD"} disabled={listening} onClick={() => setLang("bn-BD")}>বাংলা</button>
            </span>
            {listening ? <span className="small muted">Listening…</span> : null}
          </div> : null}
          <p className="small muted">One change at a time. Bangla is fine: we translate it and write it on your CV in professional English. We only add what you write here; we never invent qualifications or jobs.</p>
          {err ? <p className="err">{err}</p> : null}
          {done ? <div className="note" role="status"><b>✓ Your CV is updated.</b> {done}{after ? <div className="row" style={{ marginTop: 10 }}>{after}</div> : null}</div> : null}
          <div className="row"><button className="btn btn-primary" disabled={busy || !v.trim()}>{busy ? <><Spinner /> Updating your CV…</> : "Update my CV"}</button></div>
        </form>
      )}
    </div>
  );
}
