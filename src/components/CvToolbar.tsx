"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ACCENTS, TEMPLATES, type CvTemplate } from "@/lib/countries";
import { removePhotoAction, setCvStyleAction } from "@/app/actions";

async function shrinkPhoto(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const sz = Math.min(img.width, img.height);
    const c = document.createElement("canvas");
    c.width = c.height = 320;
    c.getContext("2d")!.drawImage(img, (img.width - sz) / 2, ((img.height - sz) / 2) * 0.5, sz, sz, 0, 0, 320, 320);
    return await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("encode"))), "image/jpeg", 0.85));
  } finally { URL.revokeObjectURL(url); }
}

export function CvToolbar(props: { tpl: CvTemplate; accent: string; photoAllowed: boolean; hasPhoto: boolean; countryLabel: string; rules: string[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");
  const set = (patch: { tpl?: CvTemplate; accent?: string }) => start(async () => { await setCvStyleAction(patch); router.refresh(); });
  return (
    <>
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
              <label className="btn btn-ghost btn-sm" style={{ marginLeft: 4 }}>
                {props.hasPhoto ? "Change photo" : "Add photo"}
                <input type="file" accept="image/*" className="hide" onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  try {
                    const blob = await shrinkPhoto(f);
                    const fd = new FormData();
                    fd.append("photo", blob, "photo.jpg");
                    const r = await fetch("/api/photo", { method: "POST", body: fd });
                    if (!r.ok) throw new Error();
                    setMsg("Photo added. It is stored privately.");
                    router.refresh();
                  } catch { setMsg("Could not read that image."); }
                }} />
              </label>
              {props.hasPhoto ? <button type="button" className="btn-text small" onClick={() => start(async () => { await removePhotoAction(); router.refresh(); })}>Remove</button> : null}
            </>
          ) : null}
        </div>
      </div>
      <p className="small muted" style={{ marginBottom: 10 }}>
        {props.countryLabel} format: {props.rules.join(" · ")}.{!props.photoAllowed && props.hasPhoto ? " Your photo is hidden for this country." : ""}
        {msg ? ` ${msg}` : ""}
      </p>
    </>
  );
}
