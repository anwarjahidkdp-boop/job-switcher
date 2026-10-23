"use client";
import { useState, useTransition } from "react";
import { saveCareerSafetyAction } from "@/app/actions";
import { APPLICATION_FIELDS, missingApplicationFields } from "@/lib/application-profile";
import type { AnswerLibrary, DealBreakers } from "@/lib/career-safety";

const EXCLUSIONS = [['excludedCompanies','Excluded companies'],['excludedIndustries','Excluded industries'],['excludedRoleTypes','Excluded role types']] as const;
const SWITCHES = [['remoteOnly','Remote only'],['noRelocation','No relocation'],['noContract','No contract / temporary work'],['sponsorshipRequired','Visa sponsorship required'],['workAuthorizationRequired','Require confirmed work authorization before preparing']] as const;
const exclusionsMode = (d: DealBreakers, key: typeof EXCLUSIONS[number][0]) => d[key]?.length ? 'list' : d[`${key}Set`] ? 'none' : '';

export function ApplicationSafetyForm({ answers, rules }: { answers: AnswerLibrary; rules: DealBreakers }) {
  const [a,setA] = useState(answers), [d,setD] = useState(rules);
  const [saved,setSaved] = useState({a:answers,d:rules});
  const [editing,setEditing] = useState<string[]>([]);
  const [salaryMode,setSalaryMode] = useState(answers.salaryNegotiable ? 'negotiable' : Number(answers.expectedSalary)>0 ? 'amount' : '');
  const [minimumMode,setMinimumMode] = useState(Number(rules.minSalary)>0 ? 'amount' : rules.minSalarySet ? 'none' : '');
  const [modes,setModes] = useState(Object.fromEntries(EXCLUSIONS.map(([key])=>[key,exclusionsMode(rules,key)])));
  const [lists,setLists] = useState(Object.fromEntries(EXCLUSIONS.map(([key])=>[key,(rules[key]||[]).join(', ')])));
  const [pending,start] = useTransition(), [message,setMessage] = useState(''), [error,setError] = useState('');
  const missing = missingApplicationFields(saved.a,saved.d), missingNames = new Set(missing.map(f=>f.name));
  const visible = (name: string) => missingNames.has(name) || editing.includes(name);
  const edit = (name: string) => {setEditing(x=>[...x,name]);setMessage('');};
  const summary: [string,string,string][] = [
    ['minSalary','Minimum salary',saved.d.minSalarySet && saved.d.minSalary==null ? 'No fixed minimum' : String(saved.d.minSalary??'')] as [string,string,string],
    ...EXCLUSIONS.map(([key,label]):[string,string,string]=>[key,label,saved.d[key]?.length ? saved.d[key]!.join(', ') : 'No exclusions']),
    ...APPLICATION_FIELDS.map(f=>{
      const value=saved.a[f.key];
      return [f.name,f.label,f.key==='expectedSalary' && saved.a.salaryNegotiable ? 'Negotiable' : typeof value==='boolean' ? value ? 'Yes' : 'No' : String(value??'')] as [string,string,string];
    }),
    ...(saved.a.currentSalary!=null ? [['currentSalary','Current salary',String(saved.a.currentSalary)] as [string,string,string]] : []),
  ].filter(([name])=>!missingNames.has(name));
  async function save() {
    const f=new FormData();
    f.set('minimumMode',minimumMode);f.set('salaryMode',salaryMode);
    if(minimumMode==='amount' && d.minSalary!=null) f.set('minSalary',String(d.minSalary));
    if(salaryMode==='amount' && a.expectedSalary!=null) f.set('expectedSalary',String(a.expectedSalary));
    for(const [key] of SWITCHES) if(d[key]) f.set(key,'on');
    for(const [key] of EXCLUSIONS){f.set(`${key}Mode`,modes[key]);if(modes[key]==='list')f.set(key,lists[key]);}
    for(const spec of APPLICATION_FIELDS){if(spec.key==='expectedSalary')continue;const value=a[spec.key];f.set(spec.name,typeof value==='boolean' ? value ? 'yes':'no' : value==null || value==='unknown' ? '' : String(value));}
    if(a.currentSalary!=null)f.set('currentSalary',String(a.currentSalary));
    setError('');setMessage('');
    try {
      await saveCareerSafetyAction(f);
      const cleanA={...a,expectedSalary:salaryMode==='negotiable' ? null : a.expectedSalary,salaryNegotiable:salaryMode==='negotiable'};
      const cleanD={...d,minSalary:minimumMode==='none' ? null : d.minSalary,minSalarySet:minimumMode==='none' || Number(d.minSalary)>0};
      for(const [key] of EXCLUSIONS){cleanD[key]=modes[key]==='list' ? lists[key].split(',').map(s=>s.trim()).filter(Boolean):[];cleanD[`${key}Set`]=modes[key]==='none'||cleanD[key]!.length>0;}
      setA(cleanA);setD(cleanD);setSaved({a:cleanA,d:cleanD});setEditing([]);setMessage('Saved. Completed answers have moved to Saved information.');
    } catch(e) {setError(e instanceof Error && e.message.length<180 ? e.message : 'Could not save. Your changes are still here.');}
  }
  const cardStyle={padding:10,border:'1px solid var(--warn)',borderRadius:8,background:'var(--warn-soft)',scrollMarginTop:90};
  return <section id="application-safety" className="card panel" style={{scrollMarginTop:90}}>
    <h3>Application details <span className={`pill ${missing.length ? 'p-warn':'p-st'}`}>{missing.length ? `${missing.length} incomplete`:'Complete'}</span></h3>
    <p className="small muted" style={{marginTop:6}}>Save your answers below. Completed fields move into your summary, where you can edit them anytime.</p>
    {summary.length ? <div style={{marginTop:12}}><h3>Saved information</h3>{summary.map(([name,label,value])=><div className="qitem" key={name}><div className="small"><b>{label}</b><div>{value}</div></div><button type="button" className="btn btn-text btn-sm" disabled={editing.includes(name)} onClick={()=>edit(name)}>Edit</button></div>)}</div>:null}
    <form noValidate action={()=>start(save)} className="stack" style={{marginTop:12}}>
      <fieldset disabled={pending} className="stack" style={{border:0,padding:0,margin:0,minWidth:0,gap:12}}>
        {missing.length ? <div className="note" role="status"><b>{missing.length} details still incomplete</b><p className="small">Complete the highlighted fields and save. Choose “No exclusions”, “No fixed minimum” or “Negotiable” when that is your preference. Blank is not treated as an answer.</p></div>:null}
        {visible('minSalary') ? <label className="f" id="answer-minSalary" style={cardStyle}>Minimum salary preference <span className="pill p-warn">Needs an answer</span>
          <select value={minimumMode} onChange={e=>{const v=e.target.value;setMinimumMode(v);setD({...d,minSalary:v==='none' ? null:d.minSalary});}}><option value="">Choose a preference</option><option value="amount">Set my minimum salary</option><option value="none">I have no fixed minimum</option></select>
          {minimumMode==='amount' ? <input aria-label="Minimum salary amount" type="number" min="1" value={d.minSalary??''} onChange={e=>setD({...d,minSalary:e.target.value==='' ? null:Number(e.target.value)})}/>:null}
          <small className="muted">The lowest salary you accept, in the selected country’s currency.</small>
        </label>:null}
        {EXCLUSIONS.filter(([key])=>visible(key)).map(([key,label])=><label className="f" id={`answer-${key}`} style={cardStyle} key={key}>{label} <span className="pill p-warn">Needs an answer</span><select value={modes[key]} onChange={e=>setModes({...modes,[key]:e.target.value})}><option value="">Choose a preference</option><option value="list">I want to exclude some</option><option value="none">No exclusions</option></select>{modes[key]==='list' ? <input aria-label={`${label} names`} value={lists[key]} placeholder="Names, separated by commas" onChange={e=>setLists({...lists,[key]:e.target.value})}/>:null}<small className="muted">List exclusions or explicitly confirm that there are none.</small></label>)}
        {APPLICATION_FIELDS.filter(f=>visible(f.name)).map(f=>{
          const value=a[f.key];
          if(f.key==='expectedSalary')return <label className="f" id="answer-expectedSalary" key={f.key} style={cardStyle}>Expected salary <span className="pill p-warn">Needs an answer</span><select value={salaryMode} onChange={e=>setSalaryMode(e.target.value)}><option value="">Choose a preference</option><option value="amount">Set my expected salary</option><option value="negotiable">Negotiable / open to discussion</option></select>{salaryMode==='amount' ? <input aria-label="Expected salary amount" type="number" min="1" value={a.expectedSalary??''} onChange={e=>setA({...a,expectedSalary:e.target.value==='' ? null:Number(e.target.value)})}/>:null}<small className="muted">{f.hint}</small></label>;
          return <label className="f" key={f.key} id={`answer-${f.name}`} style={cardStyle}>{f.label} <span className="pill p-warn">Needs an answer</span>{f.type==='number' ? <input type="number" min="0" step={f.key==='managementYears' ? '0.5':'1'} value={typeof value==='number' ? value:''} onChange={e=>setA({...a,[f.key]:e.target.value==='' ? null:Number(e.target.value)})}/> : <select value={value==='yes'||value===true ? 'yes':value==='no'||value===false ? 'no':''} onChange={e=>{const v=e.target.value;setA({...a,[f.key]:f.key==='workAuthorization' ? v||'unknown':v==='yes' ? true:v==='no' ? false:null});}}><option value="">Choose an answer</option><option value="yes">Yes</option><option value="no">No</option></select>}<small className="muted">{f.hint}</small></label>;
        })}
        {editing.includes('currentSalary') ? <label className="f" style={cardStyle}>Current salary (optional)<input type="number" min="0" value={a.currentSalary??''} onChange={e=>setA({...a,currentSalary:e.target.value==='' ? null:Number(e.target.value)})}/></label>:saved.a.currentSalary==null ? <button type="button" className="btn btn-text btn-sm" onClick={()=>edit('currentSalary')}>Add current salary (optional)</button>:null}
        <details><summary>Other application safety settings</summary><div className="stack small" style={{marginTop:8}}>{SWITCHES.map(([key,label])=><label key={key}><input type="checkbox" checked={d[key]===true} onChange={e=>setD({...d,[key]:e.target.checked})}/> {label}</label>)}</div></details>
        <button className="btn btn-primary btn-sm">{pending ? 'Saving…':'Save answers'}</button>
      </fieldset>
      {message ? <p className="note small" role="status">{message}</p>:null}{error ? <p className="err small" role="alert">{error}</p>:null}
    </form>
  </section>;
}
