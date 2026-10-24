"use client";
import { useSave } from "@/components/useSave";
import { ACCENTS, TEMPLATES, type CvTemplate } from "@/lib/countries";
import { CvPhotoPicker } from "./CvPhotoPicker";
import { removePhotoAction } from "@/app/actions";

export function CvToolbar(props: { tpl: CvTemplate; accent: string; photoAllowed: boolean; hasPhoto: boolean; countryLabel: string; rules: string[]; downloads?: { doc: string; pdf: string; label?: string } }) {
  const { pending, err, save } = useSave();
  const set = (patch: { tpl?: CvTemplate; accent?: string }) => save(async () => {
    const r = await fetch("/api/cv/style", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
    if (!r.ok) throw new Error("save failed");
  });
  return (
    <>
      <div className="cvbar-card">
      <div className="cv-design-heading"><h3>CV design studio</h3><span className="pill p-neutral">4 professional layouts</span></div>
      <div className="cvbar" aria-busy={pending}>
        <div className="row" style={{ gap: 6 }}>
          {TEMPLATES.map(([k, l]) => (
            <button key={k} type="button" className={`seg ${props.tpl === k ? "on" : ""}`} aria-pressed={props.tpl === k} onClick={() => set({ tpl: k })}>{l}</button>
          ))}
        </div>
        <div className="row" style={{ gap: 6 }}>
          {ACCENTS.map(([c, l]) => (
            <button key={c} type="button" className={`sw ${props.accent === c ? "on" : ""}`} style={{ background: c }} aria-label={`${l} colour`} aria-pressed={props.accent === c} onClick={() => set({ accent: c })} />
          ))}
          {props.photoAllowed ? (
            <>
              <CvPhotoPicker hasPhoto={props.hasPhoto}/>
              {props.hasPhoto ? <button type="button" className="btn-text small" onClick={() => save(() => removePhotoAction())}>Remove</button> : null}
            </>
          ) : null}
        </div>
      </div>
      <p className="small muted cv-design-hint">{props.tpl === "corporate" ? "Corporate: structured typography and a clean column for corporate roles." : props.tpl === "classic" ? "Classic: refined serif headings with a clean, traditional layout." : props.tpl === "executive" ? "Executive: a bold colour header with a clear leadership profile." : "Modern: a colour sidebar with a distinctive visual layout."} Choose a layout and accent colour; your downloads use the same design.</p>
      {props.downloads ? (
        <div className="cvbar-dl">
          <a className="btn btn-primary btn-sm" href={props.downloads.pdf} target="_blank" rel="noopener">Download PDF</a>
          <a className="btn btn-ghost btn-sm" href={props.downloads.doc}>Download Word</a>
          {props.downloads.label ? <span className="small muted">{props.downloads.label}</span> : null}
        </div>
      ) : null}
      <p className="small muted" style={{ margin: 0 }}>
        {props.countryLabel} format: {props.rules.join(" · ")}.{!props.photoAllowed && props.hasPhoto ? " Your photo is hidden for this country." : ""}
        {err ? ` ${err}` : ""}
      </p>
      </div>
    </>
  );
}
