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
type Msg = { who: "you" | "ai"; text: string; tone?: "ok" | "ask" };

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
  // The conversation: what the person asked and what the AI answered, one after another (kept for this browser tab).
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const listRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = listRef.current; if (el) el.scrollTop = el.scrollHeight;
  }, [msgs, busy]);
  const say = (m: Msg) => setMsgs((x) => [...x, m]);
  const canSpeak = useSyncExternalStore(noSub, () => !!speechApi(), () => false);
  const [lang, setLang] = useState(langs[0]?.code || "en-GB");
  const local = langs.find((l) => !l.english);
  const [listening, setListening] = useState(false);
  const rec = useRef<Rec | null>(null);
  const wantOn = useRef(false);
  const [finishing, setFinishing] = useState(false);
  useEffect(() => () => { wantOn.current = false; try { rec.current?.abort?.(); } catch { /* ignore */ } }, []);

  // Voice: the browser's recogniser can end on its own mid-sentence (pauses, ~1 minute limits), so while the person
  // has not pressed Stop we start it again and keep what was already heard. Stop waits for the last words.

  function stopListening() {
    const r = rec.current;
    wantOn.current = false;
    setFinishing(true);
    if (!r) { setListening(false); setFinishing(false); return; }
    try { r.stop(); } catch { /* already stopped */ }
    // The last words arrive just before the recogniser ends; only give up on it after a generous wait.
    setTimeout(() => { if (rec.current === r) { try { r.abort?.(); } catch { /* ignore */ } rec.current = null; setListening(false); setFinishing(false); } }, 5000);
  }

  /** Joins one session's results. Some phones send each result as the whole sentence so far, so overlaps are merged. */
  const joinResults = (results: ArrayLike<ArrayLike<{ transcript: string }>>) => {
    let acc = "";
    for (let i = 0; i < results.length; i++) {
      const t = results[i][0].transcript.trim();
      if (!t) continue;
      if (acc && t.toLowerCase().startsWith(acc.toLowerCase())) acc = t;
      else if (!acc.toLowerCase().endsWith(t.toLowerCase())) acc = acc ? `${acc} ${t}` : t;
    }
    return acc;
  };

  function speak() {
    if (listening) { stopListening(); return; }
    const Api = speechApi();
    if (!Api) return;
    const before = v.trim();
    let kept = ""; // finished sessions' text
    let heard = false;
    wantOn.current = true;
    const startSession = () => {
      const r = new Api();
      r.lang = lang; r.interimResults = true; r.continuous = true;
      let current = "";
      r.onresult = (e) => {
        current = joinResults(e.results);
        const all = [before, kept, current].filter(Boolean).join(" ");
        if (current) { heard = true; setV(all.slice(0, MAX_EDIT_CHARS)); }
      };
      r.onerror = (e) => {
        if (e.error === "aborted" || (e.error === "no-speech" && heard)) return;
        wantOn.current = false;
        setErr(e.error === "not-allowed" || e.error === "service-not-allowed" ? "Allow the microphone for jobpao.app in your browser (the icon in the address bar), then tap the mic again." : e.error === "no-speech" ? "We did not hear anything. Tap the mic and speak again." : e.error === "network" ? "Voice needs an internet connection to your browser's speech service. Try again, or type your change." : e.error === "language-not-supported" ? "Your browser cannot listen in that language. Type your change instead." : "Voice input stopped. Try again or type your change.");
      };
      r.onend = () => {
        kept = [kept, current].filter(Boolean).join(" ");
        if (wantOn.current) { try { startSession(); return; } catch { /* fall through and stop */ } }
        if (rec.current === r) rec.current = null;
        setListening(false); setFinishing(false);
        if (!heard) setErr((x) => x || "We could not turn your voice into text in this browser. Try Chrome, or type your change.");
      };
      rec.current = r;
      r.start();
    };
    setErr(""); setListening(true);
    try { startSession(); } catch { wantOn.current = false; rec.current = null; setListening(false); setErr("Voice input could not start in this browser. Type your change instead."); }
  }

  async function submit() {
    if (!v.trim() || busy) return;
    const asked = v.trim();
    // Answering the AI's question: send it together with what the person asked before, so the AI has the whole request.
    const last = msgs[msgs.length - 1], prev = msgs[msgs.length - 2];
    const instruction = last?.tone === "ask" && prev?.who === "you" ? `${prev.text}. ${asked}`.slice(0, MAX_EDIT_CHARS) : asked;
    setBusy(true); setErr("");
    say({ who: "you", text: asked }); setV("");
    try {
      const r = await fetch("/api/cv/edit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ instruction, lang }) });
      const j = await r.json().catch(() => null);
      // A non-JSON answer means the server stopped mid-way; the change may already be saved.
      if (!j) { router.refresh(); throw new Error("The server was busy. Check your CV: if the change is not there, send it again."); }
      if (!r.ok) throw new Error(j.error || "Your CV could not be updated. Try again.");
      say({ who: "ai", text: j.message || "Your CV was updated.", tone: "ok" });
      router.refresh();
    } catch (e) { say({ who: "ai", text: (e as Error).message, tone: "ask" }); }
    setBusy(false);
  }

  return (
    <div className="card panel" style={style}>
      <h3>Ask AI to change your CV</h3>
      {!aiReady ? <p className="note">AI changes are not set up on this server yet.</p> : (
        <form className="stack" style={{ gap: 10 }} onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <div className="chat" ref={listRef} aria-live="polite">
            <div className="msg ai"><span className="who">JobPao AI</span>Tell me one change to make to your CV and I will write it in professional style. {EXAMPLES.replace("For example: ", "For example: ")}</div>
            {msgs.map((m, i) => (
              <div key={i} className={`msg ${m.who}${m.tone ? " " + m.tone : ""}`}>
                {m.who === "ai" ? <span className="who">JobPao AI</span> : null}
                {m.tone === "ok" ? <b>✓ Your CV is updated. </b> : null}{m.text}
                {m.tone === "ok" && after && i === msgs.length - 1 ? <div className="row" style={{ marginTop: 10 }}>{after}</div> : null}
              </div>
            ))}
            {busy ? <div className="msg ai typing"><span className="who">JobPao AI</span><Spinner /> Updating your CV…</div> : null}
          </div>
          <label className="sr-only" htmlFor="cvedit">Tell us what to change in your CV</label>
          <div className="chat-input">
            <textarea id="cvedit" rows={2} value={v} maxLength={MAX_EDIT_CHARS} disabled={busy} placeholder={msgs.length ? "Type your reply or the next change…" : "Type the change you want…"} onChange={(e) => setV(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }} />
            <button className="btn btn-primary" disabled={busy || !v.trim()} aria-label="Send">{busy ? <Spinner /> : "Send ➤"}</button>
          </div>
          {canSpeak ? <div className="row" style={{ gap: 8 }}>
            <button type="button" className={`btn btn-sm ${listening ? "btn-primary" : "btn-ghost"}`} disabled={busy} onClick={speak} aria-pressed={listening}>{listening ? "■ Stop, I'm done" : "🎤 Speak your change"}</button>
            {langs.length > 1 ? <span className="seg-group" role="group" aria-label="Language you speak">
              {langs.map((l) => <button key={l.code} type="button" className={`seg ${lang === l.code ? "on" : ""}`} aria-pressed={lang === l.code} disabled={listening} onClick={() => setLang(l.code)}>{l.label}</button>)}
            </span> : null}
            {finishing ? <span className="small muted">Adding your last words…</span> : listening ? <span className="small muted">Listening… speak now, then press Stop.</span> : null}
          </div> : null}
          <p className="small muted">One change at a time.{local ? ` ${local.label} is fine: we translate it and write it on your CV in professional English.` : ""} We only add what you write here; we never invent qualifications or jobs.</p>
          {err ? <p className="small chat-hint">{err}</p> : null}
        </form>
      )}
    </div>
  );
}
