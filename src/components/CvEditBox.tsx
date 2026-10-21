"use client";
// "Ask AI to change your CV": the person types one change; the server applies it to their facts and Master CV.
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/ui";
import { MAX_EDIT_CHARS } from "@/lib/cv-edit";
import type { SpeechLang } from "@/lib/speech-langs";

const EXAMPLES = "For example: remove the skill Tally · change my end date at ABC Ltd to March 2024 · update my HSC result to GPA 4.00 · add that I passed ACCA F5.";

// The browser's own speech-to-text (Chrome, Edge, Safari). Not every browser has it, so the mic shows only where it works.
type Rec = { lang: string; interimResults: boolean; continuous: boolean; start(): void; stop(): void; abort?(): void; onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null; onend: (() => void) | null; onerror: ((e: { error: string }) => void) | null };
const speechApi = (): (new () => Rec) | null => {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
};
const noSub = () => () => {};

/** `after` shows once a change is saved, so the person knows where to go next. */
/** `langs` are the languages offered for speaking or writing the change (English first), from where the person lives. */
export function CvEditBox({ aiReady, style, after, langs }: { aiReady: boolean; style?: React.CSSProperties; after?: React.ReactNode; langs: SpeechLang[] }) {
  const router = useRouter();
  const [v, setV] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState("");
  const canSpeak = useSyncExternalStore(noSub, () => !!speechApi(), () => false);
  const [lang, setLang] = useState(langs[0]?.code || "en-GB");
  const local = langs.find((l) => !l.english);
  const [listening, setListening] = useState(false);
  const rec = useRef<Rec | null>(null);
  useEffect(() => () => { try { rec.current?.abort?.(); } catch { /* ignore */ } }, []);

  // Stop: ask the browser to finish (it sends the last words), and end it ourselves if it does not.
  function stopListening() {
    const r = rec.current;
    setListening(false);
    if (!r) return;
    try { r.stop(); } catch { /* already stopped */ }
    setTimeout(() => { if (rec.current === r) { try { r.abort?.(); } catch { /* ignore */ } rec.current = null; } }, 1500);
  }

  function speak() {
    if (listening) { stopListening(); return; }
    const Api = speechApi();
    if (!Api) return;
    const r = new Api();
    // Words show in the box while the person speaks (interim), and keep coming until they press Stop.
    r.lang = lang; r.interimResults = true; r.continuous = true;
    const start = v.trim();
    let heard = false;
    r.onresult = (e) => {
      let said = "";
      for (let i = 0; i < e.results.length; i++) said += e.results[i][0].transcript;
      if (said.trim()) { heard = true; setV(`${start ? start + " " : ""}${said.trim()}`.slice(0, MAX_EDIT_CHARS)); }
    };
    r.onerror = (e) => { if (e.error === "aborted") return; setErr(e.error === "not-allowed" || e.error === "service-not-allowed" ? "Allow the microphone for jobpao.app in your browser (the icon in the address bar), then tap the mic again." : e.error === "no-speech" ? "We did not hear anything. Tap the mic and speak again." : e.error === "network" ? "Voice needs an internet connection to your browser's speech service. Try again, or type your change." : e.error === "language-not-supported" ? "Your browser cannot listen in that language. Type your change instead." : "Voice input stopped. Try again or type your change."); };
    r.onend = () => {
      if (rec.current === r) rec.current = null;
      setListening(false);
      if (!heard) setErr((x) => x || "We could not turn your voice into text in this browser. Try Chrome, or type your change.");
    };
    rec.current = r;
    setErr(""); setListening(true);
    try { r.start(); } catch { rec.current = null; setListening(false); setErr("Voice input could not start in this browser. Type your change instead."); }
  }

  async function submit() {
    if (!v.trim() || busy) return;
    setBusy(true); setErr(""); setDone("");
    try {
      const r = await fetch("/api/cv/edit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ instruction: v.trim(), lang }) });
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
            {langs.length > 1 ? <span className="seg-group" role="group" aria-label="Language you speak">
              {langs.map((l) => <button key={l.code} type="button" className={`seg ${lang === l.code ? "on" : ""}`} aria-pressed={lang === l.code} disabled={listening} onClick={() => setLang(l.code)}>{l.label}</button>)}
            </span> : null}
            {listening ? <span className="small muted">Listening… speak now, then press Stop.</span> : null}
          </div> : null}
          <p className="small muted">One change at a time.{local ? ` ${local.label} is fine: we translate it and write it on your CV in professional English.` : ""} We only add what you write here; we never invent qualifications or jobs.</p>
          {err ? <p className="err">{err}</p> : null}
          {done ? <div className="note" role="status"><b>✓ Your CV is updated.</b> {done}{after ? <div className="row" style={{ marginTop: 10 }}>{after}</div> : null}</div> : null}
          <div className="row"><button className="btn btn-primary" disabled={busy || !v.trim()}>{busy ? <><Spinner /> Updating your CV…</> : "Update my CV"}</button></div>
        </form>
      )}
    </div>
  );
}
