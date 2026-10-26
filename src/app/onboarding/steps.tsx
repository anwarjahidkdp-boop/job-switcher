"use client";
import { setupRequirements } from "@/lib/eligibility";
import type { AnswerLibrary } from "@/lib/career-safety";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/ui";
import { CountrySelect } from "@/components/CountrySelect";
import { popularFor, rule } from "@/lib/countries";
import { setCountryAction } from "../actions";
import type { PersonalDetails, Preferences, Referee } from "@/lib/types";
import { patientFetch, patientPost } from "@/lib/patient-post";

const MAX_PAGES = 4; // keep in sync with MAX_PAGES in src/lib/cv/browser-read.ts and MAX_SCAN_PAGES on the server

async function post(url: string, body: unknown) {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "Something went wrong. Try again.");
  return j;
}

export function CountryStep(props: { current: string; home: string; needsVisa: boolean; demo: boolean; billingLocked: boolean }) {
  const router = useRouter();
  const [cur, setCur] = useState(props.current);
  const [visa, setVisa] = useState(props.needsVisa);
  const [home, setHome] = useState(props.home);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const c = rule(cur);
  // Where they live comes first, so a UK visitor sees the UK on top and a Bangladeshi visitor Bangladesh.
  const cards = popularFor(props.home);
  const popular = cards.includes(cur);
  return (
    <>
      <div className="cgrid" role="radiogroup" aria-label="Popular target countries">
        {cards.map((code) => { const k = rule(code); return (
          <button key={code} type="button" className={`ccard ${cur === code ? "on" : ""}`} role="radio" aria-checked={cur === code} onClick={() => setCur(code)}>
            <span className="cc-code" aria-hidden="true">{code}</span><span className="cc-txt"><b>{k.name}</b><span className="small muted">{k.doc} · {k.pages} · {k.photo ? "with photo" : "no photo"}</span></span><span className="cc-tick" aria-hidden="true">✓</span>
          </button>
        ); })}
      </div>
      <div className="card panel" style={{ marginTop: 12, borderColor: popular ? undefined : "var(--accent)" }}>
        <label className="f" htmlFor="obany">Or pick any country in the world
          <CountrySelect id="obany" value={cur} onChange={setCur} label="Target country" first={props.home} />
        </label>
      </div>
      <div className="card panel" style={{ marginTop: 16 }}>
        <h3>{c.name} conventions we will apply</h3>
        <p className="small muted" style={{ marginTop: -4 }}>{c.doc} · {c.pages} · {c.photo ? "with photo" : "no photo"} · salary per {c.per}</p>
        <ul className="why-list">{c.rules.map((x) => <li key={x}><span className="mk ok">✓</span><span>{x}</span></li>)}</ul>
        <label className="f" htmlFor="obhome" style={{ marginTop: 14 }}>I live in
          <CountrySelect id="obhome" value={home} disabled={props.billingLocked} onChange={setHome} label="Country you live in" first={props.home} />
        </label>
        <p className="small muted" style={{ marginTop: 4 }}>Confirm where you live. Your subscription country is fixed after this step, even if you search for jobs abroad.</p>
        {cur !== home ? <label className="row small" style={{ marginTop: 12, gap: 8, flexWrap: "nowrap", fontWeight: 500 }}><input type="checkbox" checked={visa} onChange={(e) => setVisa(e.target.checked)} /> I will need the employer to sponsor my work visa</label> : null}
      </div>
      {err ? <p role="alert" className="err" style={{ marginTop: 12 }}>{err}</p> : null}
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
  const [picked, setPicked] = useState("");
  const started = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const camInput = useRef<HTMLInputElement>(null);
  useEffect(() => () => shots.forEach((s) => URL.revokeObjectURL(s.url)), [shots]);

  async function send(label: string, f: () => Promise<Response>) {
    setBusy(label); setErr("");
    try {
      await patientFetch(f, setBusy);
      router.refresh();
    } catch (e) { setErr((e as Error).message); setBusy(""); }
  }
  const READING = "AI is reading your CV: roles, education, skills. This can take up to a minute.";
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
    setPicked(files.length > 1 ? `${files.length} pages` : files[0].name);
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
        {err ? <p role="alert" className="err">{err}</p> : null}
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
      {err ? <p role="alert" className="err" style={{ marginTop: 14 }}>{err}</p> : null}
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
        <span><em className="nocv-tag">No CV? Tap here</em><b>No CV yet? We will build one for you.</b><span className="small">Answer a few simple questions about your studies, skills and projects. Made for freshers.</span></span>
        <span className="nocv-go nocv-btn">Build my CV <i aria-hidden="true">→</i></span>
      </button>
      <div className="drop" style={{ marginTop: 14 }}>
        <p style={{ fontWeight: 600 }}>Upload your CV (PDF, DOCX, TXT or a photo)</p>
        <p className="small muted" style={{ margin: "4px 0 14px" }}>Your file is read on this device and stored privately; only you can open it. Scanned PDFs and photos are read by our AI and shown to you to check first.</p>
        <label className={`btn btn-gold drop-pick${off ? " disabled" : ""}`} aria-disabled={off}>
          {busy && picked ? <><Spinner /> Reading your CV…</> : picked ? "Choose another file" : "Choose your CV file"}
          <input ref={fileInput} type="file" hidden accept=".pdf,.docx,.txt,image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif" multiple aria-label="CV file" disabled={off} onChange={(e) => { onFiles(e.target.files); e.target.value = ""; }} />
        </label>
        {picked ? <p className="drop-file" role="status"><b>{picked}</b>{busy ? <span className="small"><Spinner /> {busy}</span> : err ? <span className="small err">Not read. See the message below.</span> : null}</p> : null}
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
        <textarea style={{ marginTop: 10 }} aria-label="CV text" placeholder="Paste the full text of your CV" value={text} onChange={(e) => setText(e.target.value)} />
        <button className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} disabled={off} onClick={() => {
          if (text.trim().length < 200) { setErr("That looks too short for a CV. Paste the full text."); return; }
          send(READING, () => fetch("/api/cv/upload", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) }));
        }}>Use this text</button>
      </details>
      {busy && !picked ? <p style={{ marginTop: 18 }}><Spinner /> {busy}</p> : null}
      {err ? <p role="alert" className="err" style={{ marginTop: 14 }}>{err}</p> : null}
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
      {err ? <p role="alert" className="err">{err}</p> : null}
      <div className="row" style={{ justifyContent: "space-between" }}>
        <button type="button" className="btn btn-text" onClick={onBack}>← I have a CV to upload</button>
        <button className="btn btn-primary" disabled={disabled}>Build my CV</button>
      </div>
    </form>
  );
}

export type PersonalField = { k: Exclude<keyof PersonalDetails, "references">; label: string; hint: string };
const emptyRef = (): Referee => ({ name: "", title: "", org: "", phone: "", email: "", relation: "" });
export function PrefsStep(props: { answers?:AnswerLibrary; editing: boolean; initial: Preferences; personal: PersonalDetails; countryLabel: string; currency: string; fields: PersonalField[]; personalCountry: boolean; refs: { mode: "list" | "request" | "none"; count: number }; isBD: boolean; country: string; revision: number; needsVisa: boolean; abroad: boolean }) {
  const [p, setP] = useState({ roles: props.initial.roles || "", locations: props.initial.locations || "", salaryMin: props.initial.salaryMin ?? "", salaryMax: props.initial.salaryMax ?? "", notice: props.initial.notice ?? "", mode: props.initial.mode || "On-site" });
  const [authorization,setAuthorization]=useState(props.answers?.workAuthorization||(!props.abroad?"yes":"unknown"));
  const [sponsor,setSponsor]=useState<boolean|null>(props.answers?.sponsorshipRequired??(!props.abroad?false:null));
  const [pd, setPd] = useState<Record<string, string>>(Object.fromEntries(props.fields.map((f) => [f.k, String(props.personal[f.k] || (f.k==="dob"?props.answers?.birthDate:"") || "")])));
  const [personalEdits,setPersonalEdits]=useState<string[]>([]);
  const initialPersonal=Object.fromEntries(props.fields.map(f=>[f.k,String(props.personal[f.k]||(f.k==="dob"?props.answers?.birthDate:"")||"")]));
  const knownPersonal=props.fields.filter(f=>initialPersonal[f.k]);
  const personalInput=(f:PersonalField)=><label key={f.k} className="f" htmlFor={`pd_${f.k}`}>{f.label}{f.k==="dob"&&props.isBD?" · Required":""}<input type={f.k==="dob"?"date":"text"} required={f.k==="dob"&&props.isBD} id={`pd_${f.k}`} value={pd[f.k]||""} onChange={e=>setPd({...pd,[f.k]:e.target.value})} placeholder={f.hint} maxLength={f.k==="address"?200:120}/></label>;
  const [refs, setRefs] = useState<Referee[]>(() => { const r = (props.personal.references || []).map((x) => ({ ...emptyRef(), ...x })); while (r.length < props.refs.count) r.push(emptyRef()); return r.slice(0, props.refs.count); });
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const upd = (k: keyof typeof p) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setP({ ...p, [k]: e.target.value });
  async function submit() {
    setErr("");
    try {
      const missing=setupRequirements({target_country:props.country,personal:pd,preferences:{salaryMin:Number(p.salaryMin)||null},answer_library:{workAuthorization:authorization,sponsorshipRequired:sponsor,willingToRelocate:props.answers?.willingToRelocate}});
      if(missing.length)throw new Error(`Complete required matching details: ${missing.join(", ")}.`);
      setBusy("Saving your preferences");
      await post("/api/onboarding/prefs", { prefs: p, country: props.country, revision: props.revision, needsVisa: sponsor===true,readiness:{workAuthorization:authorization,sponsorshipRequired:sponsor,willingToRelocate:props.answers?.willingToRelocate}, personal: { ...pd, ...(props.refs.mode === "list" ? { references: refs } : {}) } });
      // Route-handler saves do not clear prefetched client redirects. Read the saved state in a fresh navigation.
      if (props.editing) { window.location.replace("/profile"); return; }
      setBusy("AI is reading your CV…");
      await patientPost("/api/cv/build", {}, setBusy);
      window.location.replace("/onboarding");
    } catch (e) { setErr((e as Error).message); setBusy(""); }
  }
  return (
    <>
      <div className="card panel stack" style={{ marginTop: 22 }}>
        <p className="note small"><b>Required for accurate job recommendations</b><br/>Set your expected salary. Your career target is read automatically from your CV. {props.isBD?"Date of birth is also required for Bangladesh age limits.":"Age does not determine your fit for ordinary jobs in this market."}</p>
        {props.abroad ? <><label className="f">Do you have permission to work in {props.countryLabel}? <select value={authorization} onChange={e=>setAuthorization(e.target.value as "yes"|"no"|"unknown")}><option value="unknown">Choose an answer</option><option value="yes">Yes</option><option value="no">No</option></select></label>
        <label className="f">Do you need employer sponsorship? <select value={sponsor===null?'':sponsor?'yes':'no'} onChange={e=>setSponsor(e.target.value==='yes'?true:e.target.value==='no'?false:null)}><option value="">Choose an answer</option><option value="yes">Yes</option><option value="no">No</option></select></label>
        </> : <p className="small muted">Local search: work permission defaults to Yes and sponsorship to No. You can edit these in your application details.</p>}
        <div className="note small"><b>Career target from your CV</b><div>{p.roles||"Based on your verified experience and skills"} · equivalent or higher level</div><span className="muted">A lower title is considered only when published pay, senior experience and responsibilities establish comparable scope.</span></div>
        <label className="f" htmlFor="p_locs">Preferred cities in {props.countryLabel} (leave blank for anywhere)<input type="text" id="p_locs" value={p.locations} onChange={upd("locations")} /></label>
        <div className="row" style={{ alignItems: "flex-end" }}>
          <label className="f" htmlFor="p_smin" style={{ flex: 1, minWidth: 140 }}>Expected salary from ({props.currency}) · Required<input required min="1" type="number" id="p_smin" value={p.salaryMin} onChange={upd("salaryMin")} placeholder={props.isBD ? "e.g. 70000" : ""} /></label>
          <label className="f" htmlFor="p_smax" style={{ flex: 1, minWidth: 140 }}>to ({props.currency})<input type="number" id="p_smax" value={p.salaryMax} onChange={upd("salaryMax")} placeholder={props.isBD ? "e.g. 85000" : ""} /></label>
        </div>
        <div className="row" style={{ alignItems: "flex-end" }}>
          <label className="f" htmlFor="p_notice" style={{ flex: 1, minWidth: 140 }}>Notice period (days)<input type="number" id="p_notice" value={p.notice} onChange={upd("notice")} placeholder="e.g. 30" /></label>
          <label className="f" htmlFor="p_mode" style={{ flex: 1, minWidth: 140 }}>Work mode<select id="p_mode" value={p.mode} onChange={upd("mode")}>{["On-site", "Hybrid", "Remote", "Any"].map((o) => <option key={o}>{o}</option>)}</select></label>
        </div>
      </div>
      {props.fields.length ? (
        <div className="card panel stack" style={{ marginTop: 14 }}>
          <h3 style={{ margin: 0 }}>Personal details for your {props.countryLabel} CV</h3>
          <p className="small muted">Details found in your uploaded CV are filled automatically. Saved edits take priority.</p>
          {knownPersonal.length ? <div className="stack small" style={{gap:8}}>{knownPersonal.map(f=><div className="qitem" key={f.k}><div><b>{f.label}</b><div>{pd[f.k]}</div></div><button type="button" className="btn btn-text btn-sm" onClick={()=>setPersonalEdits(x=>x.includes(f.k)?x:[...x,f.k])}>Edit</button></div>)}</div>:null}
          <div className="pd-grid">{props.fields.filter(f=>personalEdits.includes(f.k)||f.k==='dob'&&props.isBD&&!initialPersonal[f.k]).map(personalInput)}</div>
          {props.fields.some(f=>!initialPersonal[f.k]&&!(f.k==='dob'&&props.isBD)) ? <details><summary>Add other personal details (optional)</summary><div className="pd-grid" style={{marginTop:12}}>{props.fields.filter(f=>!initialPersonal[f.k]&&!(f.k==='dob'&&props.isBD)&&!personalEdits.includes(f.k)).map(personalInput)}</div></details>:null}
        </div>
      ) : null}
      {props.refs.mode === "list" ? (
        <details className="card panel reference-card" style={{ marginTop: 14 }}>
          <summary className="reference-toggle"><span>References <span className="muted">(optional)</span></span><span className="small muted">Open to add or edit</span></summary>
          <p className="small muted">You can skip this and continue. Add referees only with their permission. A specific vacancy may request references later. Until you add them, your CV says &quot;Available on request&quot;.</p>
          {refs.map((r, i) => (
            <fieldset key={i} className="ref-box">
              <legend>Referee {i + 1}</legend>
              <div className="pd-grid">
                {([["name", "Full name", "e.g. Md. Rafiqul Islam"], ["title", "Designation", "e.g. Finance Director"], ["org", "Organisation", "e.g. Gentle Park Ltd."], ["phone", "Phone", "e.g. +880 1711 000000"], ["email", "Email", "e.g. rafiq@company.com"], ["relation", "Relation", "e.g. Former line manager"]] as const).map(([k, l, h]) => (
                  <label key={k} className="f" htmlFor={`ref${i}_${k}`}>{l}<input type={k === "email" ? "email" : "text"} id={`ref${i}_${k}`} value={r[k] || ""} placeholder={h} maxLength={120} onChange={(e) => setRefs(refs.map((x, n) => (n === i ? { ...x, [k]: e.target.value } : x)))} /></label>
                ))}
              </div>
            </fieldset>
          ))}
        </details>
      ) : null}
      {!props.fields.length ? <p className="note" style={{ marginTop: 14 }}>{props.countryLabel} CVs leave out photo, date of birth and marital status, so we will not add them.</p> : null}
      {busy ? <p style={{ marginTop: 18 }}><Spinner /> {busy}</p> : null}
      {err ? <p role="alert" className="err" style={{ marginTop: 14 }}>{err}</p> : null}
      <div className="row" style={{ marginTop: 20 }}><button className="btn btn-primary" disabled={!!busy} onClick={submit}>{props.editing ? "Save preferences" : `Create my ${props.countryLabel} CV`}</button></div>
    </>
  );
}
