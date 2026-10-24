"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { careerHeadline, closeEarlierRoles } from "@/lib/cv/experience";
import { roleSuggestions, experienceNeedsDetails } from "@/lib/cv/role-suggestions";
import { ManualCvSchema, type ManualCv } from "@/lib/manual-cv";

export function ManualCvEditor({ initial, baseId, country, revision, application, defaultOpen=false }: { initial: ManualCv; baseId: string; country: string; revision: number; application?:{jobId:string;updatedAt:string};defaultOpen?:boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen);
  const [cv, setCv] = useState(initial);
  const [savedId, setSavedId] = useState(baseId);
  const [savedVersion,setSavedVersion]=useState(application?.updatedAt);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selectedResponsibilities,setSelectedResponsibilities]=useState<Record<number,string[]>>({});
  const [focusRole,setFocusRole]=useState<number|null>(null);
  const incompleteRoles=initial.experience.map((e,i)=>({e,i})).filter(({e})=>experienceNeedsDetails(e));
  useEffect(()=>{if(open && focusRole!=null)document.getElementById(`cv-role-${focusRole}`)?.scrollIntoView({behavior:"smooth",block:"start"});},[open,focusRole]);
  const dirty = open && JSON.stringify(cv) !== JSON.stringify(initial);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  function start(roleIndex?:number) { setFocusRole(roleIndex??null);setSelectedResponsibilities({}); setCv(structuredClone(initial)); setSavedId(baseId); setError(""); setNotice(""); setOpen(true); }
  function cancel() { if (dirty && !window.confirm("Discard your unsaved CV changes?")) return; setOpen(false); setError(""); }
  async function save() {
    const tidy = (s: string[]) => s.map(v => v.trim()).filter(Boolean);
    const check = ManualCvSchema.safeParse({ ...cv, skills_core: tidy(cv.skills_core), skills_tools: tidy(cv.skills_tools), languages: tidy(cv.languages), experience: cv.experience.map(e => ({ ...e, bullets: tidy(e.bullets) })) });
    if (!check.success) { const i = check.error.issues[0]; setError(`${i.path.join(" → ")}: ${i.message}`); return; }
    setBusy(true); setError("");
    try {
      const r = await fetch(application?`/api/applications/${application.jobId}/documents`:"/api/cv/manual", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(application?{document:"cv",baseUpdatedAt:savedVersion,cv:check.data}:{ baseId: savedId, country, revision, cv: check.data }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Could not save. Your edits are still here; try again.");
      if(j.id)setSavedId(j.id);if(j.updatedAt)setSavedVersion(j.updatedAt); setOpen(false); setNotice(j.message); router.refresh();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  const field = (label: string, value: string, change: (v: string) => void, multiline = false, type = "text") => <label className="stack small" style={{ gap: 4 }}><span>{label}</span>{multiline ? <textarea rows={4} value={value} onChange={e => change(e.target.value)} /> : <input type={type} value={value} onChange={e => change(e.target.value)} />}</label>;
  return <section className={open ? "card panel" : undefined} style={{ marginBottom: open ? 14 : 8 }} aria-label="Edit your CV">
    {!open ? <><div className="row" style={{ justifyContent: "flex-end" }}><button type="button" className="btn btn-primary btn-sm" aria-expanded={open} onClick={()=>start()}><svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m16 3 5 5-12 12-6 1 1-6Z"/><path d="m14 5 5 5"/></svg>Edit CV</button></div>{incompleteRoles.length ? <div className="note small cv-role-notice" role="status"><b>Experience details need attention</b><p>{incompleteRoles.map(({e})=>e.title).join(" · ")}</p><button type="button" className="btn btn-ghost btn-sm" onClick={()=>start(incompleteRoles[0].i)}>Choose responsibilities to add</button></div> : null}{notice ? <p role="status" className="note" style={{ marginTop: 8 }}>{notice}</p> : null}</> : <form onSubmit={e => { e.preventDefault(); save(); }}>
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 12 }}><h3>Edit your CV</h3><span className="small muted">{application?"This application only · No AI charge":"No AI charge"}</span></div>
      <fieldset disabled={busy} className="stack" style={{ border: 0, padding: 0, margin: 0, minWidth: 0, gap: 14 }}>
        {field("Full name", cv.name, name => setCv({ ...cv, name }))}
        <label className="stack small">Professional headline<input value={careerHeadline(cv.experience,cv.headline)} readOnly /><span className="muted">Updates automatically from your latest role and department.</span></label>
        {field("Contact line (email · phone · city)", cv.contact, contact => setCv({ ...cv, contact }))}
        {field("Profile summary", cv.summary, summary => setCv({ ...cv, summary }), true)}
        <h3>Experience</h3>
        {cv.experience.map((e, i) => {
          const change = (patch: Partial<typeof e>) => setCv({ ...cv, experience: closeEarlierRoles(cv.experience.map((x, k) => k === i ? { ...x, ...patch } : x)) });
          return <div className="stack card panel" style={{ gap: 10, scrollMarginTop:90 }} id={`cv-role-${i}`} key={i}>
            {field("Job title", e.title, title => change({ title }))}{field("Department", e.department || "", department => change({ department: department || null }))}{field("Employer", e.company, company => change({ company }))}{field("Location", e.location || "", location => change({ location: location || null }))}
            <div className="row" style={{ alignItems: "start" }}>{field("Start month", e.start || "", start => change({ start: start || null }), false, "month")}{field("End month (blank = Present)", e.end || "", end => change({ end: end || null, autoEnd: false, concurrent: !end }), false, "month")}</div>
            {e.autoEnd ? <p className="small muted" role="status">End month set automatically to the month before your next role starts. You can edit it.</p> : null}
            <label className="small row"><input type="checkbox" checked={!!e.concurrent} onChange={v => change({ concurrent: v.target.checked, ...(v.target.checked ? { end: null, autoEnd: false } : {}) })} />Concurrent role — keep Present alongside another role</label>
            {experienceNeedsDetails(e) ? <p className="note small" role="status"><b>Add details for this role.</b> Select relevant responsibilities below, or write what you did.</p> : null}
            {field("Responsibilities and achievements (one bullet per line)", e.bullets.join("\n"), value => change({ bullets: value.split("\n") }), true)}
            {roleSuggestions([e.title,e.department].filter(Boolean).join(" "), e.bullets).length ? <div className="stack" style={{ gap: 6 }} aria-label={`Suggested responsibilities for ${e.title}`}>
              <b className="small">Suggested responsibilities</b><p className="small muted">Add only the work you actually did. You can edit each line after adding it. No AI charge.</p>
              {roleSuggestions([e.title,e.department].filter(Boolean).join(" "),e.bullets).map(suggestion=><label className="small row cv-responsibility-choice" key={suggestion}><input type="checkbox" checked={(selectedResponsibilities[i]||[]).includes(suggestion)} onChange={event=>setSelectedResponsibilities({...selectedResponsibilities,[i]:event.target.checked ? [...(selectedResponsibilities[i]||[]),suggestion] : (selectedResponsibilities[i]||[]).filter(s=>s!==suggestion)})}/><span>{suggestion}</span></label>)}
              <button type="button" className="btn btn-ghost btn-sm" disabled={!roleSuggestions([e.title,e.department].filter(Boolean).join(" "),e.bullets).some(s=>(selectedResponsibilities[i]||[]).includes(s))} onClick={()=>{const picked=roleSuggestions([e.title,e.department].filter(Boolean).join(" "),e.bullets).filter(s=>(selectedResponsibilities[i]||[]).includes(s));change({bullets:[...e.bullets.filter(b=>b.trim()),...picked]});setSelectedResponsibilities({...selectedResponsibilities,[i]:[]});}}>Add selected responsibilities</button>
            </div> : null}
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setCv({ ...cv, experience: closeEarlierRoles(cv.experience.filter((_, k) => k !== i)) })}>Remove this role</button>
          </div>;
        })}
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setCv({ ...cv, experience: [...cv.experience, { title: "", department:null, company: "", location: null, start: null, end: null, bullets: [] }] })}>Add a role</button>
        <h3>Education</h3>
        {cv.education.map((e, i) => {
          const change = (patch: Partial<typeof e>) => setCv({ ...cv, education: cv.education.map((x, k) => k === i ? { ...x, ...patch } : x) });
          return <div className="stack card panel" style={{ gap: 10 }} key={i}>
            {field("Degree / qualification", e.degree, degree => change({ degree }))}{field("Field of study", e.field, field => change({ field }))}{field("Institution", e.institution, institution => change({ institution }))}{field("Year", e.year, year => change({ year }))}{field("Result", e.result || "", result => change({ result: result || null }))}
            <label className="stack small">Education level<select value={e.level} onChange={v => change({ level: v.target.value as typeof e.level })}>{["hsc", "diploma", "bachelors", "masters", "phd"].map(l => <option key={l} value={l}>{l === "hsc" ? "HSC / secondary" : l === "phd" ? "PhD" : l[0].toUpperCase() + l.slice(1)}</option>)}</select></label>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setCv({ ...cv, education: cv.education.filter((_, k) => k !== i) })}>Remove education</button>
          </div>;
        })}
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setCv({ ...cv, education: [...cv.education, { degree: "", field: "", institution: "", year: "", level: "bachelors", result: null }] })}>Add education</button>
        <h3>Certifications</h3>
        {cv.certifications.map((c, i) => {
          const change = (patch: Partial<typeof c>) => setCv({ ...cv, certifications: cv.certifications.map((x, k) => k === i ? { ...x, ...patch } : x) });
          return <div className="stack card panel" style={{ gap: 10 }} key={i}>
            {field("Certification", c.name, name => change({ name }))}{field("Details", c.detail || "", detail => change({ detail: detail || null }))}
            <label className="stack small">Status<select value={c.status} onChange={v => change({ status: v.target.value as typeof c.status })}><option value="qualified">Qualified</option><option value="partly">Partly qualified</option><option value="in_progress">In progress</option></select></label>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setCv({ ...cv, certifications: cv.certifications.filter((_, k) => k !== i) })}>Remove certification</button>
          </div>;
        })}
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setCv({ ...cv, certifications: [...cv.certifications, { name: "", status: "qualified", detail: null }] })}>Add certification</button>
        {field("Core skills (one per line)", cv.skills_core.join("\n"), value => setCv({ ...cv, skills_core: value.split("\n") }), true)}
        {field("Tools and software (one per line)", cv.skills_tools.join("\n"), value => setCv({ ...cv, skills_tools: value.split("\n") }), true)}
        {field("Languages (one per line)", cv.languages.join("\n"), value => setCv({ ...cv, languages: value.split("\n") }), true)}
        <div className="row"><button className="btn btn-primary">{busy ? "Saving…" : "Save changes"}</button><button type="button" className="btn btn-ghost" onClick={cancel}>Cancel</button></div>
      </fieldset>
      {error ? <p className="err" role="alert" style={{ marginTop: 10 }}>{error}</p> : null}
    </form>}
  </section>;
}
