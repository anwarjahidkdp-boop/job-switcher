"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/ui";
import { setCountryAction } from "../actions";
import type { PersonalDetails, Preferences } from "@/lib/types";

const MAX_PAGES = 4; // keep in sync with MAX_PAGES in src/lib/cv/browser-read.ts and MAX_SCAN_PAGES on the server

async function post(url: string, body: unknown) {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "Something went wrong. Try again.");
  return j;
}

export function CountryStep(props: { current: string; needsVisa: boolean; demo: boolean; countries: { code: string; name: string; doc: string; pages: string; photo: boolean; rules: string[] }[] }) {
  const router = useRouter();
  const [cur, setCur] = useState(props.current);
  const [visa, setVisa] = useState(props.needsVisa);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const c = props.countries.find((x) => x.code === cur)!;
  return (
    <>
      <div className="cgrid" role="radiogroup" aria-label="Target country" style={{ marginTop: 20 }}>
        {props.countries.map((k) => (
          <button key={k.code} type="button" className={`ccard ${cur === k.code ? "on" : ""}`} role="radio" aria-checked={cur === k.code} onClick={() => setCur(k.code)}>
            <b>{k.name}</b><span className="small muted">{k.doc} · {k.pages} · {k.photo ? "with photo" : "no photo"}</span>
            {k.code === "BD" ? <span className="pill p-ex" style={{ marginTop: 6 }}>Launching first</span> : null}
          </button>
        ))}
      </div>
      <div className="card panel" style={{ marginTop: 16 }}>
        <h3>{c.name} conventions we will apply</h3>
        <ul className="why-list">{c.rules.map((x) => <li key={x}><span className="mk ok">✓</span><span>{x}</span></li>)}</ul>
        {cur !== "BD" ? <label className="row small" style={{ marginTop: 12, gap: 8, flexWrap: "nowrap", fontWeight: 500 }}><input type="checkbox" checked={visa} onChange={(e) => setVisa(e.target.checked)} /> I will need the employer to sponsor my work visa</label> : null}
      </div>
      {err ? <p className="err" style={{ marginTop: 12 }}>{err}</p> : null}
      <div className="row" style={{ marginTop: 20 }}>
        <button className="btn btn-primary" disabled={busy} onClick={async () => {
          setBusy(true); setErr("");
          try {
            await setCountryAction(cur, visa);
            if (props.demo) await post("/api/cv/upload", { demo: true });
            router.refresh();
          } catch (e) { setErr((e as Error).message); setBusy(false); }
        }}>{busy ? <><Spinner /> Saving</> : "Continue"}</button>
      </div>
    </>
  );
}

type Review = { text: string; truncated: boolean; file: File | null; pages: number };

export function UploadStep({ aiReady, autoDemo }: { aiReady: boolean; autoDemo: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [text, setText] = useState("");
  const [shots, setShots] = useState<{ blob: Blob; url: string }[]>([]);
  const [review, setReview] = useState<Review | null>(null);
  const started = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const camInput = useRef<HTMLInputElement>(null);
  useEffect(() => () => shots.forEach((s) => URL.revokeObjectURL(s.url)), [shots]);

  async function send(label: string, f: () => Promise<Response>) {
    setBusy(label); setErr("");
    try {
      const r = await f();
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Could not read this file.");
      router.refresh();
    } catch (e) { setErr((e as Error).message); setBusy(""); }
  }
  const READING = "Reading your CV: roles, education, skills. This can take up to a minute.";
  const demo = () => send("Loading the sample CV", () => fetch("/api/cv/upload", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ demo: true }) }));
  useEffect(() => { if (autoDemo && !started.current) { started.current = true; demo(); } });

  /** Send page images for transcription, then show the text for the user to check. */
  async function transcribe(pages: Blob[], file: File | null) {
    setBusy(`Reading ${pages.length} page${pages.length === 1 ? "" : "s"} from your ${file ? "scan" : "photos"}. This can take up to a minute.`); setErr("");
    try {
      const fd = new FormData();
      pages.slice(0, MAX_PAGES).forEach((p, i) => fd.append("page", p, `page-${i + 1}.jpg`));
      const r = await fetch("/api/cv/transcribe", { method: "POST", body: fd });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Could not read these pages.");
      setReview({ text: j.text, truncated: !!j.truncated, file, pages: j.pages });
      setBusy("");
    } catch (e) { setErr((e as Error).message); setBusy(""); }
  }

  async function onFiles(list: FileList | null) {
    const files = [...(list || [])];
    if (!files.length) return;
    setErr(""); setBusy("Opening your file on this device");
    try {
      const { readCvFile, isImageFile, imageToJpeg } = await import("@/lib/cv/browser-read");
      if (files.every(isImageFile)) {
        const pages = await Promise.all(files.slice(0, MAX_PAGES).map((f) => imageToJpeg(f)));
        if (files.length > MAX_PAGES) setErr(`Only the first ${MAX_PAGES} pages are read.`);
        await transcribe(pages, null);
        return;
      }
      const f = files[0];
      const r = await readCvFile(f);
      if (r.kind === "scan") {
        if (r.totalPages > MAX_PAGES) setErr(`This PDF has ${r.totalPages} pages; only the first ${MAX_PAGES} are read.`);
        await transcribe(r.pages, f);
        return;
      }
      if (r.kind === "image") { await transcribe(r.pages, null); return; }
      const fd = new FormData(); fd.append("file", f); fd.append("text", r.text); fd.append("source", "file");
      await send(READING, () => fetch("/api/cv/upload", { method: "POST", body: fd }));
    } catch (e) { setErr((e as Error).message); setBusy(""); }
  }

  async function addShot(list: FileList | null) {
    const files = [...(list || [])];
    if (!files.length) return;
    setErr("");
    try {
      const { imageToJpeg } = await import("@/lib/cv/browser-read");
      const room = MAX_PAGES - shots.length;
      const blobs = await Promise.all(files.slice(0, room).map((f) => imageToJpeg(f)));
      setShots((s) => [...s, ...blobs.map((blob) => ({ blob, url: URL.createObjectURL(blob) }))]);
      if (files.length > room) setErr(`You can add up to ${MAX_PAGES} pages.`);
    } catch (e) { setErr((e as Error).message); }
    if (camInput.current) camInput.current.value = "";
  }

  if (review) {
    return (
      <div className="card panel stack" style={{ marginTop: 22 }}>
        <h3 style={{ margin: 0 }}>Check the text we read from your {review.file ? "scan" : "photos"}</h3>
        <p className="small muted">We read {review.pages} page{review.pages === 1 ? "" : "s"}. Fix anything we misread, especially names, dates and numbers. Words we could not read are marked [unclear]: correct them or delete them. We use only the text in this box.</p>
        {review.truncated ? <p className="note" style={{ borderColor: "var(--warn)" }}>The text may be cut off at the end. Add anything missing before you continue.</p> : null}
        <textarea aria-label="Transcribed CV text" style={{ minHeight: 360 }} value={review.text} onChange={(e) => setReview({ ...review, text: e.target.value })} />
        {busy ? <p><Spinner /> {busy}</p> : null}
        {err ? <p className="err">{err}</p> : null}
        <div className="row">
          <button className="btn btn-primary" disabled={!!busy} onClick={() => {
            const t = review.text.replace(/\[unclear\]/gi, "").trim();
            if (t.length < 200) { setErr("That looks too short for a CV. Add the missing text or paste it."); return; }
            if (review.file) {
              const fd = new FormData(); fd.append("file", review.file); fd.append("text", review.text); fd.append("source", "ocr");
              send(READING, () => fetch("/api/cv/upload", { method: "POST", body: fd }));
            } else send(READING, () => fetch("/api/cv/upload", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: review.text, source: "ocr" }) }));
          }}>The text is correct, continue</button>
          <button className="btn btn-text" disabled={!!busy} onClick={() => { setReview(null); setShots([]); setErr(""); }}>Start again</button>
        </div>
      </div>
    );
  }

  const off = !!busy || !aiReady;
  return (
    <>
      <div className="drop" style={{ marginTop: 22 }}>
        <p style={{ fontWeight: 600 }}>Upload your CV (PDF, DOCX, TXT or a photo)</p>
        <p className="small muted" style={{ margin: "4px 0 14px" }}>Your file is read on this device and stored privately; only you can open it. Scanned PDFs and photos are read by our AI and shown to you to check first.</p>
        <input ref={fileInput} type="file" accept=".pdf,.docx,.txt,image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif" multiple aria-label="CV file" disabled={off} onChange={(e) => { onFiles(e.target.files); e.target.value = ""; }} />
      </div>
      <div className="card panel stack" style={{ marginTop: 14 }}>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div><p style={{ fontWeight: 600 }}>Take a photo of your CV</p><p className="small muted">One photo per page, up to {MAX_PAGES} pages. Lay the page flat in good light.</p></div>
          <label className={`btn btn-ghost btn-sm ${off || shots.length >= MAX_PAGES ? "disabled" : ""}`} aria-disabled={off || shots.length >= MAX_PAGES}>
            {shots.length ? "Add another page" : "Open camera"}
            <input ref={camInput} type="file" accept="image/*" capture="environment" hidden disabled={off || shots.length >= MAX_PAGES} onChange={(e) => addShot(e.target.files)} />
          </label>
        </div>
        {shots.length ? (
          <>
            <div className="row" style={{ alignItems: "flex-start" }}>
              {shots.map((s, i) => (
                <figure key={s.url} style={{ margin: 0, textAlign: "center" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s.url} alt={`Page ${i + 1}`} style={{ width: 96, height: 128, objectFit: "cover", border: "1px solid var(--line)", borderRadius: 6 }} />
                  <figcaption className="small">Page {i + 1} <button className="btn-text small" disabled={!!busy} onClick={() => setShots((x) => x.filter((_, j) => j !== i))}>Remove</button></figcaption>
                </figure>
              ))}
            </div>
            <div className="row"><button className="btn btn-primary btn-sm" disabled={off} onClick={() => transcribe(shots.map((s) => s.blob), null)}>Read {shots.length} page{shots.length === 1 ? "" : "s"}</button></div>
          </>
        ) : null}
      </div>
      <details style={{ marginTop: 14 }}>
        <summary style={{ cursor: "pointer", fontWeight: 600 }}>Or paste your CV text</summary>
        <textarea style={{ marginTop: 10 }} placeholder="Paste the full text of your CV" value={text} onChange={(e) => setText(e.target.value)} />
        <button className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} disabled={off} onClick={() => {
          if (text.trim().length < 200) { setErr("That looks too short for a CV. Paste the full text."); return; }
          send(READING, () => fetch("/api/cv/upload", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) }));
        }}>Use this text</button>
      </details>
      {busy ? <p style={{ marginTop: 18 }}><Spinner /> {busy}</p> : null}
      {err ? <p className="err" style={{ marginTop: 14 }}>{err}</p> : null}
      {!aiReady ? <p className="note" style={{ marginTop: 18 }}>AI analysis is not set up on this server yet (no AI key). The sample CV still shows the full flow.</p> : null}
      <div className="row" style={{ marginTop: 22 }}><button className="btn btn-text" disabled={!!busy} onClick={demo}>Try with a sample CV instead</button></div>
    </>
  );
}

export function PrefsStep(props: { editing: boolean; initial: Preferences; personal: PersonalDetails; countryLabel: string; currency: string; showPersonal: boolean; visaField: boolean; isBD: boolean }) {
  const router = useRouter();
  const [p, setP] = useState({ roles: props.initial.roles || "", locations: props.initial.locations || "", salaryMin: props.initial.salaryMin ?? "", salaryMax: props.initial.salaryMax ?? "", notice: props.initial.notice ?? "", mode: props.initial.mode || "On-site" });
  const [pd, setPd] = useState({ nationality: props.personal.nationality || "", dob: props.personal.dob || "", visa: props.personal.visa || "" });
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [, start] = useTransition();
  const upd = (k: keyof typeof p) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setP({ ...p, [k]: e.target.value });
  async function submit() {
    setErr("");
    try {
      setBusy("Saving your preferences");
      await post("/api/onboarding/prefs", { prefs: p, personal: props.showPersonal ? pd : null });
      if (props.editing) { start(() => router.push("/profile")); return; }
      setBusy("Writing your professional CV. This usually takes under a minute.");
      await post("/api/cv/build", {});
      router.refresh();
    } catch (e) { setErr((e as Error).message); setBusy(""); }
  }
  return (
    <>
      <div className="card panel stack" style={{ marginTop: 22 }}>
        <label className="f" htmlFor="p_roles">Target roles (comma separated)<input type="text" id="p_roles" value={p.roles} onChange={upd("roles")} /></label>
        <label className="f" htmlFor="p_locs">Preferred cities in {props.countryLabel} (leave blank for anywhere)<input type="text" id="p_locs" value={p.locations} onChange={upd("locations")} /></label>
        <div className="row" style={{ alignItems: "flex-end" }}>
          <label className="f" htmlFor="p_smin" style={{ flex: 1, minWidth: 140 }}>Expected salary from ({props.currency})<input type="number" id="p_smin" value={p.salaryMin} onChange={upd("salaryMin")} placeholder={props.isBD ? "e.g. 70000" : ""} /></label>
          <label className="f" htmlFor="p_smax" style={{ flex: 1, minWidth: 140 }}>to ({props.currency})<input type="number" id="p_smax" value={p.salaryMax} onChange={upd("salaryMax")} placeholder={props.isBD ? "e.g. 85000" : ""} /></label>
        </div>
        <div className="row" style={{ alignItems: "flex-end" }}>
          <label className="f" htmlFor="p_notice" style={{ flex: 1, minWidth: 140 }}>Notice period (days)<input type="number" id="p_notice" value={p.notice} onChange={upd("notice")} placeholder="e.g. 30" /></label>
          <label className="f" htmlFor="p_mode" style={{ flex: 1, minWidth: 140 }}>Work mode<select id="p_mode" value={p.mode} onChange={upd("mode")}>{["On-site", "Hybrid", "Remote", "Any"].map((o) => <option key={o}>{o}</option>)}</select></label>
        </div>
      </div>
      {props.showPersonal ? (
        <div className="card panel stack" style={{ marginTop: 14 }}>
          <h3 style={{ margin: 0 }}>Personal details for your {props.countryLabel} CV (optional)</h3>
          <p className="small muted">{props.countryLabel} CVs often include these. Leave a box blank to keep it off your CV.</p>
          <div className="row" style={{ alignItems: "flex-end" }}>
            <label className="f" htmlFor="pd_nat" style={{ flex: 1, minWidth: 140 }}>Nationality<input type="text" id="pd_nat" value={pd.nationality} onChange={(e) => setPd({ ...pd, nationality: e.target.value })} placeholder="e.g. Bangladeshi" /></label>
            <label className="f" htmlFor="pd_dob" style={{ flex: 1, minWidth: 140 }}>Date of birth<input type="text" id="pd_dob" value={pd.dob} onChange={(e) => setPd({ ...pd, dob: e.target.value })} placeholder="e.g. 12 March 1992" /></label>
            {props.visaField ? <label className="f" htmlFor="pd_visa" style={{ flex: 1, minWidth: 140 }}>Visa status<input type="text" id="pd_visa" value={pd.visa} onChange={(e) => setPd({ ...pd, visa: e.target.value })} placeholder="e.g. Requires employment visa" /></label> : null}
          </div>
        </div>
      ) : <p className="note" style={{ marginTop: 14 }}>{props.countryLabel} CVs leave out photo, date of birth and marital status, so we will not add them.</p>}
      {busy ? <p style={{ marginTop: 18 }}><Spinner /> {busy}</p> : null}
      {err ? <p className="err" style={{ marginTop: 14 }}>{err}</p> : null}
      <div className="row" style={{ marginTop: 20 }}><button className="btn btn-primary" disabled={!!busy} onClick={submit}>{props.editing ? "Save preferences" : "Create my professional CV"}</button></div>
    </>
  );
}
