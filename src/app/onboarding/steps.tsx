"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/ui";
import { CountrySelect } from "@/components/CountrySelect";
import { COUNTRY_CODES, rule } from "@/lib/countries";
import { setCountryAction } from "../actions";
import type { PersonalDetails, Preferences } from "@/lib/types";

const MAX_PAGES = 4; // keep in sync with MAX_PAGES in src/lib/cv/browser-read.ts and MAX_SCAN_PAGES on the server

async function post(url: string, body: unknown) {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "Something went wrong. Try again.");
  return j;
}

export function CountryStep(props: { current: string; home: string; needsVisa: boolean; demo: boolean }) {
  const router = useRouter();
  const [cur, setCur] = useState(props.current);
  const [visa, setVisa] = useState(props.needsVisa);
  const [home, setHome] = useState(props.home);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const c = rule(cur);
  const popular = COUNTRY_CODES.includes(cur);
  return (
    <>
      <div className="cgrid" role="radiogroup" aria-label="Popular target countries">
        {COUNTRY_CODES.map((code) => { const k = rule(code); return (
          <button key={code} type="button" className={`ccard ${cur === code ? "on" : ""}`} role="radio" aria-checked={cur === code} onClick={() => setCur(code)}>
            <span className="cc-code" aria-hidden="true">{code}</span><span className="cc-txt"><b>{k.name}</b><span className="small muted">{k.doc} · {k.pages} · {k.photo ? "with photo" : "no photo"}</span></span><span className="cc-tick" aria-hidden="true">✓</span>
          </button>
        ); })}
      </div>
      <div className="card panel" style={{ marginTop: 12, borderColor: popular ? undefined : "var(--accent)" }}>
        <label className="f" htmlFor="obany">Or pick any country in the world
          <CountrySelect id="obany" value={cur} onChange={setCur} label="Target country" />
        </label>
      </div>
      <div className="card panel" style={{ marginTop: 16 }}>
        <h3>{c.name} conventions we will apply</h3>
        <p className="small muted" style={{ marginTop: -4 }}>{c.doc} · {c.pages} · {c.photo ? "with photo" : "no photo"} · salary per {c.per}</p>
        <ul className="why-list">{c.rules.map((x) => <li key={x}><span className="mk ok">✓</span><span>{x}</span></li>)}</ul>
        <label className="f" htmlFor="obhome" style={{ marginTop: 14 }}>I live in
          <CountrySelect id="obhome" value={home} onChange={setHome} label="Country you live in" />
        </label>
        <p className="small muted" style={{ marginTop: 4 }}>Your Pro price and how you pay follow the country you live in.</p>
        {cur !== home ? <label className="row small" style={{ marginTop: 12, gap: 8, flexWrap: "nowrap", fontWeight: 500 }}><input type="checkbox" checked={visa} onChange={(e) => setVisa(e.target.checked)} /> I will need the employer to sponsor my work visa</label> : null}
      </div>
      {err ? <p className="err" style={{ marginTop: 12 }}>{err}</p> : null}
      <div className="row" style={{ marginTop: 20 }}>
        <button className="btn btn-primary" disabled={busy} onClick={async () => {
          setBusy(true); setErr("");
          try {
            await setCountryAction(cur, visa, home);
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
  const [fresh, setFresh] = useState(false);
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
  if (fresh) return (
    <>
      <NoCvForm disabled={off} onSubmit={(cv) => send(READING, () => fetch("/api/cv/upload", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: cv }) }))} onBack={() => { setFresh(false); setErr(""); }} />
      {busy ? <p style={{ marginTop: 18 }}><Spinner /> {busy}</p> : null}
      {err ? <p className="err" style={{ marginTop: 14 }}>{err}</p> : null}
      {!aiReady ? <p className="note" style={{ marginTop: 18 }}>Building a CV from your answers opens as soon as our AI is switched on. Meanwhile you can try every step with a sample CV.</p> : null}
    </>
  );
  return (
    <>
      {!aiReady ? (
        <div className="ob-wait">
          <div><b>AI reading of your own CV is being switched on.</b><p className="small muted">Uploading opens as soon as it is ready. Meanwhile you can go through every step with a sample CV and see how JobPao works.</p></div>
          <button className="btn btn-primary" disabled={!!busy} onClick={demo}>Continue with a sample CV →</button>
        </div>
      ) : null}
      <button type="button" className="nocv-cta" onClick={() => { setFresh(true); setErr(""); }}>
        <span className="nocv-ic" aria-hidden="true">✎</span>
        <span><b>No CV yet? We will build one for you.</b><span className="small">Answer a few simple questions about your studies, skills and projects. Made for freshers.</span></span>
        <span className="nocv-go" aria-hidden="true">→</span>
      </button>
      <div className="drop" style={{ marginTop: 14 }}>
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
      {aiReady ? <div className="row" style={{ marginTop: 22 }}><button className="btn btn-text" disabled={!!busy} onClick={demo}>Try with a sample CV instead</button></div> : null}
    </>
  );
}

const NO_CV_FIELDS: { k: string; label: string; hint: string; rows?: number; req?: boolean; head?: string }[] = [
  { k: "name", label: "Full name", hint: "e.g. Nusrat Jahan", req: true },
  { k: "contact", label: "Email, phone and city", hint: "e.g. nusrat@gmail.com, 01711-000000, Dhaka", req: true },
  { k: "goal", label: "What kind of job do you want?", hint: "e.g. Junior accountant or banking officer, full time", rows: 2, req: true, head: "CAREER OBJECTIVE" },
  { k: "education", label: "Education, latest first", hint: "Degree, subject, institution, year, result. e.g. BBA in Accounting, University of Dhaka, 2025, CGPA 3.45\nHSC, Dhaka College, 2020, GPA 5.00", rows: 4, req: true, head: "EDUCATION" },
  { k: "skills", label: "Skills", hint: "e.g. MS Excel, Tally, English communication, social media marketing", rows: 2, req: true, head: "SKILLS" },
  { k: "projects", label: "Projects, internships, part-time work or tuition", hint: "What you did, where and when. e.g. Internship, BRAC Bank, Jun-Aug 2025: helped prepare loan files. Leave empty if none.", rows: 4, head: "EXPERIENCE AND PROJECTS" },
  { k: "training", label: "Training and certificates", hint: "e.g. Google Digital Marketing certificate, 2024", rows: 2, head: "TRAINING AND CERTIFICATES" },
  { k: "activities", label: "Clubs, volunteering and achievements", hint: "e.g. Debate club secretary; BNCC; 2nd prize in a business case contest", rows: 2, head: "ACTIVITIES AND ACHIEVEMENTS" },
  { k: "languages", label: "Languages", hint: "e.g. Bangla (native), English (good)", head: "LANGUAGES" },
];

/** For people with no CV: a few plain questions, turned into CV text that goes through the normal reading step. Only what they type is used. */
function NoCvForm({ disabled, onSubmit, onBack }: { disabled: boolean; onSubmit: (cv: string) => void; onBack: () => void }) {
  const [v, setV] = useState<Record<string, string>>({});
  const [err, setErr] = useState("");
  const val = (k: string) => (v[k] || "").trim();
  return (
    <form className="card panel stack nocv" style={{ marginTop: 22 }} onSubmit={(e) => {
      e.preventDefault(); setErr("");
      const miss = NO_CV_FIELDS.find((f) => f.req && !val(f.k));
      if (miss) { setErr(`Please fill in: ${miss.label}.`); return; }
      const cv = [val("name"), val("contact"), ...NO_CV_FIELDS.filter((f) => f.head && val(f.k)).map((f) => `\n${f.head}\n${val(f.k)}`)].join("\n");
      if (cv.length < 200) { setErr("Add a little more about your education, skills or projects so we can build a good CV."); return; }
      onSubmit(cv);
    }}>
      <div>
        <h3 style={{ margin: 0 }}>Let&apos;s build your first CV</h3>
        <p className="small muted" style={{ marginTop: 4 }}>Write in English or Bangla. We only use what you write here and never add anything you did not do. Next, we may ask a few short questions to make it stronger.</p>
      </div>
      {NO_CV_FIELDS.map((f) => (
        <label key={f.k} className="f" htmlFor={`nocv-${f.k}`}>{f.label}{f.req ? null : <span className="muted small"> (optional)</span>}
          {f.rows ? <textarea id={`nocv-${f.k}`} rows={f.rows} placeholder={f.hint} value={v[f.k] || ""} onChange={(e) => setV({ ...v, [f.k]: e.target.value })} />
            : <input id={`nocv-${f.k}`} type="text" placeholder={f.hint} value={v[f.k] || ""} onChange={(e) => setV({ ...v, [f.k]: e.target.value })} />}
        </label>
      ))}
      {err ? <p className="err">{err}</p> : null}
      <div className="row" style={{ justifyContent: "space-between" }}>
        <button type="button" className="btn btn-text" onClick={onBack}>← I have a CV to upload</button>
        <button className="btn btn-primary" disabled={disabled}>Build my CV</button>
      </div>
    </form>
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
